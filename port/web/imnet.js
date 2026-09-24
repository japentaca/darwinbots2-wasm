'use strict';
// E7 — cliente de Internet Mode (spec/PLAN-EXTENSIONES.md §E7).
//
// Hace, dentro del worker, lo que hacía DarwinbotsIM.exe al lado del EXE
// original (MDIForm1.frm:1347-1354): llevar los .dbo que el teleporter
// Internet deja en el outbox (Teleport.bas:175-178) a OTRA sim conectada, y
// traer los que llegan al inbox (Teleport.bas:418-446), más los .stats de
// writeIMdata (main.frm:2109-2111). No toca la sim: el worker le pasa bytes
// y recibe bytes.
//
// Dos transportes con el mismo protocolo:
//   'bc' — BroadcastChannel: pestañas del mismo navegador y origen, sin
//          servidor (sirve también en la demo estática de Pages).
//   'ws' — WebSocket contra tools/imrelay/relay.mjs (un hub por sala).
//
// Protocolo (JSON, v = 1; `from` = id de sesión del emisor):
//   hello {name, simId}           al conectar; los demás contestan `here`
//   here  {name, simId, to?}      latido cada 3 s (y respuesta a hello)
//   bye   {}                      al desconectar (el relay lo emite por el
//                                 que se cae sin avisar)
//   dbo   {to, file, data}        un organismo (registro SaveOrganism en
//                                 base64) para UN par; el destino lo sortea
//                                 el emisor entre los pares vivos
//   ack   {to, file}              el receptor lo metió en su inbox
//   stats {file, json, species}   cada 200 ciclos: el JSON de writeIMdata y
//                                 las especies con color (esquema de
//                                 SaveSimPopulation, HDRoutines.bas:445-490)
//
// Decisiones (capa host):
//  - El destino lo sortea el emisor con Math.random (jamás el RNG de la
//    sim). Sin pares vivos el .dbo espera en `pending` — como un archivo en
//    la carpeta outbound con el cliente IM desconectado.
//  - Un .dbo sin ack en 8 s vuelve a `pending` y se re-sortea (el par pudo
//    irse): un organismo no se pierde por una desconexión. El receptor
//    descarta duplicados por (from, file) y re-confirma. Un ack solo vale si
//    viene del par al que se mandó; uno tardío (el .dbo ya se había
//    re-encolado) lo saca de la cola. Queda un caso de clon posible y
//    contado en `late`: el ack tardío llega cuando la copia ya salió hacia
//    otro par.
//  - Apagar no pierde nada: la cola (y lo que estaba en camino) se conserva
//    para la próxima conexión, como la carpeta outbound con el cliente
//    cerrado.
//  - `pending` tiene tope (500); pasado el tope se descarta el más viejo y
//    se cuenta en `dropped`.
(function (root) {
  const PROTO = 1;
  const HEARTBEAT_MS = 3000;
  const PEER_TTL_MS = 10000;
  const ACK_TIMEOUT_MS = 8000;
  const MAX_PENDING = 500;
  const MAX_SEEN = 2000;
  const MAX_INTERNET_SPECIES = 500;   // provvisorio.bas:19

  function b64encode(u8) {
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000)
      s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64decode(str) {
    const s = atob(str);
    const u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }
  function newId() {
    const a = new Uint8Array(6);
    if (root.crypto && root.crypto.getRandomValues) root.crypto.getRandomValues(a);
    else for (let i = 0; i < 6; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  const ImNet = {
    on: false,
    id: newId(),
    name: '',
    simId: '',
    kind: 'bc',
    url: '',
    room: 'publica',
    status: 'apagado',
    peers: new Map(),     // id -> {name, simId, last, census}
    pending: [],          // {file, data(b64), label}
    inflight: new Map(),  // file -> {item, to, t}
    seen: new Map(),      // from|file -> true (duplicados)
    counters: { sent: 0, acked: 0, recv: 0, dropped: 0, resent: 0, late: 0,
                stats: 0 },
    fileSeq: 0,
    hooks: {},            // onDbo(bytes, from) -> bool · onChange() · onLog(s)
    _tr: null,
    _hb: 0,
    _retry: 0,
    _backoff: 1000,
  };

  // ---- transporte ---------------------------------------------------------
  function openTransport() {
    const im = ImNet;
    closeTransport();
    if (im.kind === 'ws') {
      let ws;
      const sep = im.url.includes('?') ? '&' : '?';
      try {
        ws = new WebSocket(im.url + sep + 'room=' + encodeURIComponent(im.room));
      } catch (e) {
        setStatus('error: ' + e.message);
        scheduleRetry();
        return;
      }
      im._tr = {
        send: (o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); },
        close: () => { try { ws.onclose = null; ws.close(); } catch { /* */ } },
      };
      setStatus('conectando…');
      ws.onopen = () => { im._backoff = 1000; setStatus('conectado'); hello(); };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch { return; }
        onMessage(m);
      };
      ws.onerror = () => {};
      ws.onclose = () => {
        im._tr = null;
        lostAllPeers();
        if (im.on) { setStatus('sin relay — reintentando'); scheduleRetry(); }
      };
    } else {
      const ch = new BroadcastChannel('darwinbots-im:' + im.room);
      im._tr = {
        send: (o) => ch.postMessage(o),
        close: () => ch.close(),
      };
      ch.onmessage = (ev) => onMessage(ev.data);
      setStatus('conectado (pestañas)');
      hello();
    }
  }

  function closeTransport() {
    if (ImNet._tr) {
      send({ t: 'bye' });
      ImNet._tr.close();
      ImNet._tr = null;
    }
  }

  function scheduleRetry() {
    clearTimeout(ImNet._retry);
    ImNet._retry = setTimeout(() => { if (ImNet.on) openTransport(); },
                              ImNet._backoff);
    ImNet._backoff = Math.min(ImNet._backoff * 2, 15000);
  }

  function send(o) {
    if (!ImNet._tr) return false;
    ImNet._tr.send({ v: PROTO, from: ImNet.id, ...o });
    return true;
  }

  function hello() {
    send({ t: 'hello', name: ImNet.name, simId: ImNet.simId });
  }

  function setStatus(s) {
    ImNet.status = s;
    changed();
  }
  function changed() { if (ImNet.hooks.onChange) ImNet.hooks.onChange(); }
  function logLine(s) { if (ImNet.hooks.onLog) ImNet.hooks.onLog(s); }

  // ---- pares --------------------------------------------------------------
  function touchPeer(m) {
    if (!m.from || m.from === ImNet.id) return null;
    let p = ImNet.peers.get(m.from);
    if (!p) {
      p = { name: '', simId: '', last: 0, census: null };
      ImNet.peers.set(m.from, p);
      p.last = Date.now();
      if (typeof m.name === 'string') p.name = m.name;
      logLine(`par conectado: ${p.name || m.from}`);
      changed();
      setTimeout(flush, 0);
    }
    p.last = Date.now();
    if (typeof m.name === 'string' && m.name !== p.name) { p.name = m.name; changed(); }
    if (typeof m.simId === 'string') p.simId = m.simId;
    return p;
  }

  function livePeers() {
    const now = Date.now();
    const out = [];
    for (const [id, p] of ImNet.peers) if (now - p.last < PEER_TTL_MS) out.push(id);
    return out;
  }

  function dropPeer(id, why) {
    const p = ImNet.peers.get(id);
    if (!p) return;
    ImNet.peers.delete(id);
    logLine(`par desconectado: ${p.name || id}${why ? ' (' + why + ')' : ''}`);
    // Lo que iba hacia él vuelve a la cola: se re-sortea.
    for (const [file, f] of ImNet.inflight)
      if (f.to === id) { ImNet.inflight.delete(file); requeue(f.item); }
    changed();
  }

  function lostAllPeers() {
    for (const id of [...ImNet.peers.keys()]) dropPeer(id, 'sin conexión');
  }

  function heartbeat() {
    send({ t: 'here', name: ImNet.name, simId: ImNet.simId });
    const now = Date.now();
    for (const [id, p] of ImNet.peers)
      if (now - p.last > PEER_TTL_MS) dropPeer(id, 'sin latido');
    for (const [file, f] of ImNet.inflight)
      if (now - f.t > ACK_TIMEOUT_MS) {
        ImNet.inflight.delete(file);
        ImNet.counters.resent += 1;
        requeue(f.item);
      }
    flush();
  }

  // ---- organismos -----------------------------------------------------------
  function requeue(item) {
    ImNet.pending.unshift(item);
    trimPending();
    changed();
  }
  function trimPending() {
    while (ImNet.pending.length > MAX_PENDING) {
      ImNet.pending.pop();
      ImNet.counters.dropped += 1;
    }
  }

  function flush() {
    if (!ImNet._tr || !ImNet.pending.length) return;
    const live = livePeers();
    if (!live.length) return;
    while (ImNet.pending.length) {
      const item = ImNet.pending.shift();
      const to = live[Math.floor(Math.random() * live.length)];
      ImNet.inflight.set(item.file, { item, to, t: Date.now() });
      send({ t: 'dbo', to, file: item.file, data: item.data });
      ImNet.counters.sent += 1;
      const p = ImNet.peers.get(to);
      logLine(`salió ${item.label} → ${p ? p.name || to : to}`);
    }
    changed();
  }

  function onMessage(m) {
    if (!m || m.v !== PROTO || m.from === ImNet.id) return;
    if (m.to && m.to !== ImNet.id) return;
    switch (m.t) {
      case 'hello':
        touchPeer(m);
        send({ t: 'here', to: m.from, name: ImNet.name, simId: ImNet.simId });
        break;
      case 'here':
        touchPeer(m);
        break;
      case 'bye':
        dropPeer(m.from, '');
        break;
      case 'dbo': {
        const p = touchPeer(m);
        if (typeof m.file !== 'string' || typeof m.data !== 'string') break;
        const key = m.from + '|' + m.file;
        if (ImNet.seen.has(key)) {           // duplicado: re-confirmar
          send({ t: 'ack', to: m.from, file: m.file });
          break;
        }
        let bytes;
        try { bytes = b64decode(m.data); } catch { break; }
        const ok = ImNet.hooks.onDbo ? ImNet.hooks.onDbo(bytes, p ? p.name : m.from) : false;
        if (!ok) break;                        // sin ack: el emisor re-sortea
        ImNet.seen.set(key, true);
        if (ImNet.seen.size > MAX_SEEN)
          ImNet.seen.delete(ImNet.seen.keys().next().value);
        ImNet.counters.recv += 1;
        send({ t: 'ack', to: m.from, file: m.file });
        changed();
        break;
      }
      case 'ack': {
        touchPeer(m);
        const f = ImNet.inflight.get(m.file);
        if (f && f.to === m.from) {
          ImNet.inflight.delete(m.file);
          ImNet.counters.acked += 1;
        } else {
          // Tardío: el .dbo había vuelto a la cola (sacarlo) o ya salió
          // hacia otro par (posible clon, se cuenta).
          const k = ImNet.pending.findIndex((it) => it.file === m.file);
          if (k >= 0) { ImNet.pending.splice(k, 1); ImNet.counters.acked += 1; }
          else if (f) ImNet.counters.late += 1;
        }
        changed();
        break;
      }
      case 'stats': {
        const p = touchPeer(m);
        if (!p) break;
        let pop = null;
        try { pop = JSON.parse(m.json); } catch { /* el JSON del original */ }
        const species = Array.isArray(m.species)
          ? m.species.filter((r) => Array.isArray(r) && typeof r[0] === 'string')
          : [];
        p.census = { file: m.file, cycle: pop ? pop.cycle : 0,
                     pop: pop && Array.isArray(pop.population) ? pop : null,
                     species };
        changed();
        break;
      }
    }
  }

  // ---- API para el worker ---------------------------------------------------
  // opts: {name, simId, kind:'bc'|'ws', url, room}
  ImNet.start = function (opts, hooks) {
    ImNet.stop();
    Object.assign(ImNet, {
      name: opts.name || '', simId: opts.simId || '',
      kind: opts.kind === 'ws' ? 'ws' : 'bc', url: opts.url || '',
      room: opts.room || 'publica',
    });
    ImNet.hooks = hooks || {};
    for (const k in ImNet.counters) ImNet.counters[k] = 0;
    ImNet.on = true;
    ImNet._backoff = 1000;
    openTransport();
    ImNet._hb = setInterval(heartbeat, HEARTBEAT_MS);
  };

  // CloseWindow(pid) del original: el cliente se va. Lo que estaba en
  // camino vuelve a la cola, y la cola se conserva para la próxima
  // conexión (la carpeta outbound seguía ahí). Devuelve cuántos esperan.
  ImNet.stop = function () {
    const had = ImNet.on;
    ImNet.on = false;
    clearInterval(ImNet._hb);
    clearTimeout(ImNet._retry);
    closeTransport();
    ImNet.peers.clear();
    for (const f of ImNet.inflight.values()) ImNet.pending.unshift(f.item);
    ImNet.inflight.clear();
    trimPending();
    ImNet.status = 'apagado';
    if (had) changed();
    return ImNet.pending.length;
  };

  ImNet.setIdentity = function (name, simId) {
    ImNet.name = name;
    ImNet.simId = simId;
    send({ t: 'here', name, simId });
  };

  // Un .dbo recién salido del outbox. `label` es para el registro.
  ImNet.push = function (bytes, label) {
    ImNet.fileSeq += 1;
    ImNet.pending.push({ file: ImNet.id + '-' + ImNet.fileSeq,
                         data: b64encode(bytes), label: label || 'organismo' });
    trimPending();
    flush();
    changed();
  };

  ImNet.pushStats = function (file, json, species) {
    ImNet.counters.stats += 1;
    send({ t: 'stats', file, json, species });
  };

  // InternetSpecies (provvisorio.bas:19-21): las especies de las OTRAS sims
  // conectadas, con su color, hasta MAXINTERNETSPECIES. El original la
  // declaraba y la leía (grafico.frm:3747) pero nunca la llenaba.
  ImNet.internetSpecies = function () {
    const out = new Map();
    for (const p of ImNet.peers.values()) {
      if (!p.census) continue;
      for (const [name, pop, veg, color] of p.census.species) {
        if (typeof name !== 'string') continue;
        if (out.size >= MAX_INTERNET_SPECIES && !out.has(name)) continue;
        const e = out.get(name) || { name, color, veg: !!veg, pop: 0 };
        e.pop += pop | 0;
        out.set(name, e);
      }
    }
    return [...out.values()];
  };

  ImNet.snapshot = function () {
    const now = Date.now();
    const peers = [];
    for (const [id, p] of ImNet.peers)
      peers.push({ id, name: p.name, simId: p.simId,
                   alive: now - p.last < PEER_TTL_MS,
                   census: p.census ? { cycle: p.census.cycle,
                                        pop: p.census.pop ? p.census.pop.population : [] }
                                    : null });
    return { on: ImNet.on, id: ImNet.id, name: ImNet.name, kind: ImNet.kind,
             room: ImNet.room, url: ImNet.url, status: ImNet.status, peers,
             pending: ImNet.pending.length, inflight: ImNet.inflight.size,
             counters: { ...ImNet.counters },
             internetSpecies: ImNet.internetSpecies() };
  };

  root.ImNet = ImNet;
})(typeof self !== 'undefined' ? self : globalThis);
