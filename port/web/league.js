'use strict';
// Ligas (E10, capa host, fuera de la fidelidad). Una liga junta lo que el
// Contest y el Canal tienen suelto: reglas (una foto del panel de opciones),
// formato del torneo, participantes con el ADN congelado, historial de
// partidos con su semilla y estadísticas derivadas de ese historial.
//
// Temporadas: las reglas y el formato se bloquean con el primer partido de la
// temporada; "New season" los desbloquea, copia los participantes y deja el
// historial anterior consultable. Las estadísticas son siempre de una
// temporada.
//
// Los partidos se juegan con contestLaunch (contest.js): reinicio, siembra,
// censo F1 y arranque. contest.js reenvía aquí los mensajes y las stats del
// worker (leagueOnMessage / leagueOnStats).
//
// Usa globales de index.html (makeWindow, winLayer, log, escHtml, worker,
// setInput, fieldSizeDims, F1_COSTS, F1_OPTS, F1_KEYS), de inventory.js (inv,
// invLoad, invFetchDna, invColor, userRec, allTags, InvDB), de lab.js
// (labDnaByName), de contest.js (contest, contestLaunch, contestBoardHtml,
// contestRender, contestRoundWinner) y de channel.js (channelStop, CH_COLORS).

// ---- IndexedDB (base propia: no toca la del Inventario) ----------------------
const LgDB = (() => {
  let dbp = null;
  function open() {
    if (!dbp) {
      dbp = new Promise((res, rej) => {
        const r = indexedDB.open('darwinbots-ligas', 1);
        r.onupgradeneeded = () => {
          const db = r.result;
          if (!db.objectStoreNames.contains('leagues')) db.createObjectStore('leagues', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('matches'))
            db.createObjectStore('matches', { keyPath: 'id', autoIncrement: true });
        };
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return dbp;
  }
  function req(store, mode, fn) {
    return open().then((db) => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    }));
  }
  return {
    all: (store) => req(store, 'readonly', (s) => s.getAll()),
    put: (store, v) => req(store, 'readwrite', (s) => s.put(v)),
    del: (store, k) => req(store, 'readwrite', (s) => s.delete(k)),
    // Borra los partidos de una liga (en una transacción).
    delMatches: (league) => req('matches', 'readwrite', (s) => {
      s.openCursor().onsuccess = (e) => {
        const c = e.target.result;
        if (!c) return;
        if (c.value.league === league) c.delete();
        c.continue();
      };
    }),
  };
})();

// ---- Estado -------------------------------------------------------------------
const lg = {
  win: null,
  list: [],        // ligas
  cur: null,       // liga abierta
  matches: [],     // partidos de la liga abierta (todas las temporadas)
  live: null,      // partido en curso (ver lgPlayNext); live.replay = repetición
  checked: new Map(), // id del partido → 'same' | 'diff' (repeticiones de esta sesión)
  confirm: '',     // botón de dos clics armado ('del' | 'season')
  confirmT: 0,
};
const LG_CUR_KEY = 'db-league-cur';
const LG_FMT_DEFAULT = {
  format: 'koth',   // 'koth' (rey de la colina) | 'rr' (todos contra todos) | 'ladder' (escalera)
  k: 2,             // koth: luchadores por pelea
  retire: 5,        // koth: victorias seguidas para retirarse invicto
  legs: 1,          // rr: vueltas
  qty: 5, nrg: 3000, rounds: 5, wins: 3,
  cap: 5000,        // tope de ciclos por ronda (0 = sin tope)
  capMode: 'pop',   // al llegar al tope: 'pop' (más bots) | 'nrg' (más nrg + body×10)
};
const LG_ELO0 = 1500, LG_K = 32;

const lgSeason = (L) => L.seasons[L.seasons.length - 1];
const lgSeasonMatches = (no) => lg.matches.filter((m) => m.season === no)
  .sort((a, b) => a.no - b.no);
const lgPlayed = (ms) => ms.filter((m) => m.winner);

// FNV-1a de 32 bits: identifica el ADN congelado de cada participante.
function lgHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---- Reglas: foto del panel de opciones ----------------------------------------
// Todo control con data-id / data-cost / data-key más el campo. Los de modo de
// juego que contestLaunch fija en cada partido quedan fuera.
const LG_FIELD_IDS = ['o-fsize', 'o-fw', 'o-fh', 'o-shape'];
const LG_SKIP = new Set(['o-91', 'o-97', 'o-98', 'o-99', 'o-100']);
function lgRuleEls() {
  const els = LG_FIELD_IDS.map((id) => document.getElementById(id));
  document.querySelectorAll('aside [data-id], #opts-panel [data-cost], #opts-panel [data-key]')
    .forEach((el) => { if (el.id && !LG_SKIP.has(el.id)) els.push(el); });
  return els.filter(Boolean);
}
const lgElValue = (el) => (el.type === 'checkbox' ? el.checked : String(el.value));

function lgCaptureRules() {
  const r = {};
  for (const el of lgRuleEls()) r[el.id] = lgElValue(el);
  return r;
}

// Los ajustes de liga de btnSetF1 (applyF1Settings) sin tocar el panel.
function lgF1Rules() {
  const r = lgCaptureRules();
  const put = (id, v) => {
    const el = document.getElementById(id);
    if (el) r[id] = el.type === 'checkbox' ? !!v : String(v);
  };
  for (const id in r) {
    const el = document.getElementById(id);
    if (el.dataset.cost !== undefined) put(id, F1_COSTS[+el.dataset.cost] ?? 0);
  }
  for (const id in F1_OPTS) if (!LG_SKIP.has('o-' + id)) put('o-' + id, F1_OPTS[id]);
  for (const k in F1_KEYS) put('o-' + k, F1_KEYS[k]);
  const [w, h] = fieldSizeDims(1);
  Object.assign(r, { 'o-fsize': '1', 'o-fw': String(w), 'o-fh': String(h), 'o-shape': 'tor' });
  return r;
}

function lgNoCostRules() {
  const r = lgCaptureRules();
  for (const id in r) {
    const el = document.getElementById(id);
    if (el.dataset.cost === undefined) continue;
    const c = +el.dataset.cost;
    // CostX (54) queda en 1 como el default del panel; los demás a 0.
    r[id] = el.type === 'checkbox' ? false : (c === 54 ? '1' : '0');
  }
  return r;
}

// Escribe las reglas en el panel y dispara cada 'change' (en vivo, como
// applyF1Settings). El reinicio del partido las toma de ahí (collectOptions);
// los costes que el panel no muestra salen del core recién creado, en 0.
function lgApplyRules(r) {
  for (const id of Object.keys(r)) {
    const el = document.getElementById(id);
    if (!el) continue;
    setInput(el, r[id]);
    el.dispatchEvent(new Event('change'));
  }
  // o-fsize rellena ancho y alto: se reescriben después con los de la foto.
  for (const id of ['o-fw', 'o-fh']) {
    const el = document.getElementById(id);
    if (el && r[id] !== undefined) el.value = r[id];
  }
}

const lgLabel = (id) => {
  const l = document.querySelector(`label[for="${id}"]`);
  return l ? l.textContent.trim() : id;
};
function lgRulesSummary(r) {
  const costs = [];
  for (const id in r) {
    const el = document.getElementById(id);
    if (!el || el.dataset.cost === undefined || el.type === 'checkbox') continue;
    const v = parseFloat(r[id]) || 0;
    if (v && +el.dataset.cost !== 54) costs.push(`${lgLabel(id)} <b>${escHtml(String(r[id]))}</b>`);
  }
  const shape = { wall: 'walls', tor: 'toroidal', h: 'horizontal cylinder', v: 'vertical cylinder' }[r['o-shape']] || '';
  const diff = lgRuleEls().filter((el) => r[el.id] !== undefined && r[el.id] !== lgElValue(el)).length;
  return `<div>Field <b>${escHtml(r['o-fw'] || '?')}×${escHtml(r['o-fh'] || '?')}</b> ${shape}` +
    (r['o-maxPopulation'] !== undefined ? ` · max population <b>${escHtml(String(r['o-maxPopulation']))}</b>` : '') +
    (r['o-mutations'] !== undefined ? ` · mutations <b>${r['o-mutations'] ? 'on' : 'off'}</b>` : '') + '</div>' +
    `<div class="lg-costs">${costs.length ? costs.join(' · ') : 'No costs: bots spend no energy.'}` +
    (r['o-c54'] !== undefined && r['o-c54'] !== '1' ? ` · CostX <b>${escHtml(String(r['o-c54']))}</b>` : '') + '</div>' +
    `<div class="ct-rule">${diff ? `The Sim options panel differs in ${diff} settings.` : 'The Sim options panel matches these rules.'}</div>`;
}

// ---- Calendario ------------------------------------------------------------------
// Todos contra todos por el método del círculo: cada jornada, cada uno juega
// a lo sumo una vez (con número impar, uno descansa). La segunda vuelta
// invierte el orden de siembra.
function lgRrFixtures(n, legs) {
  const a = [...Array(n).keys()];
  if (n % 2) a.push(-1);
  const m = a.length, pairs = [];
  for (let r = 0; r < m - 1; r++) {
    for (let i = 0; i < m / 2; i++) {
      const x = a[i], y = a[m - 1 - i];
      if (x >= 0 && y >= 0) pairs.push(r % 2 ? [y, x] : [x, y]);
    }
    a.splice(1, 0, a.pop());
  }
  const out = [];
  for (let leg = 1; leg <= legs; leg++)
    for (const [x, y] of pairs) out.push({ leg, pair: leg % 2 ? [x, y] : [y, x] });
  return out;
}
const lgPairKey = (a, b) => (a < b ? a + '\u0001' + b : b + '\u0001' + a);

function lgRrState(S, ms) {
  const E = S.entrants;
  const fx = lgRrFixtures(E.length, S.fmt.legs);
  const cnt = new Map();
  for (const m of lgPlayed(ms)) {
    if (m.fighters.length !== 2) continue;
    const k = lgPairKey(m.fighters[0], m.fighters[1]);
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  let played = 0, next = null;
  for (const f of fx) {
    const [x, y] = f.pair;
    if ((cnt.get(lgPairKey(E[x].name, E[y].name)) || 0) >= f.leg) played++;
    else if (!next) next = [E[x], E[y]];
  }
  return { total: fx.length, played, next };
}

// Rey de la colina: el campeón y su racha salen de recorrer el historial.
function lgKothState(S, ms) {
  let champ = null, streak = 0;
  const titles = new Map();
  for (const m of lgPlayed(ms)) {
    if (champ === m.winner) streak++;
    else { champ = m.winner; streak = 1; }
    if (streak >= S.fmt.retire) {
      titles.set(champ, (titles.get(champ) || 0) + 1);
      champ = null;
      streak = 0;
    }
  }
  if (champ && !S.entrants.some((e) => e.name === champ)) champ = null;
  return { champ, streak, titles };
}

// Escalera (populateladder, F1Mode.bas:443-500): los participantes entran de
// a uno en el orden de inscripción; el primero ocupa el peldaño 1 sin pelear.
// Cada aspirante desafía desde el peldaño 1 hacia abajo: si gana, ocupa ese
// peldaño y empuja a los demás un lugar; si pierde con todos, queda último.
// Todo sale de recorrer el historial (solo cuentan los duelos esperados).
function lgLadderState(S, ms) {
  const E = S.entrants, ladder = [];
  let ci = 0, pos = 0;
  if (E.length) { ladder.push(E[0].name); ci = 1; }
  for (const m of lgPlayed(ms)) {
    if (ci >= E.length) break;
    const c = E[ci].name, rung = ladder[pos];
    if (m.fighters.length !== 2 || !m.fighters.includes(c) || !m.fighters.includes(rung)) continue;
    if (m.winner === c) { ladder.splice(pos, 0, c); ci++; pos = 0; }
    else if (++pos >= ladder.length) { ladder.push(c); ci++; pos = 0; }
  }
  const next = ci < E.length && E.length >= 2
    ? [E.find((e) => e.name === ladder[pos]), E[ci]] : null;
  return { ladder, next, rung: pos + 1, placed: ci, total: E.length };
}

function lgShuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Próxima pelea: {fighters, label} o null si la temporada terminó.
function lgNextFixture(L) {
  const S = lgSeason(L), ms = lgSeasonMatches(S.no), E = S.entrants;
  if (E.length < 2) return null;
  if (S.fmt.format === 'rr') {
    const st = lgRrState(S, ms);
    return st.next && { fighters: st.next, label: `Fixture ${st.played + 1} of ${st.total}` };
  }
  if (S.fmt.format === 'ladder') {
    const st = lgLadderState(S, ms);
    return st.next && { fighters: st.next,
      label: `Ladder: ${st.next[1].name} challenges rung ${st.rung} (entrant ${st.placed + 1} of ${st.total})` };
  }
  const { champ } = lgKothState(S, ms);
  const k = Math.min(Math.max(2, S.fmt.k), E.length, 20);
  const ce = champ ? E.find((e) => e.name === champ) : null;
  const others = lgShuffle(E.filter((e) => e !== ce)).slice(0, ce ? k - 1 : k);
  return { fighters: ce ? [ce, ...others] : others,
           label: ce ? `👑 ${champ} defends the crown` : 'Open fight: no champion' };
}

// ---- Tabla -------------------------------------------------------------------
// Elo: en una pelea de N, el ganador le gana a cada uno de los demás con
// K / (N − 1), así una pelea de muchos no vale más que un duelo.
function lgStandings(S, ms) {
  const rows = new Map();
  const row = (name) => rows.get(name) || rows.set(name, {
    name, color: (S.entrants.find((e) => e.name === name) || {}).color || '#8899bb',
    p: 0, w: 0, elo: LG_ELO0, cyc: 0, capR: 0, rounds: 0 }).get(name);
  for (const e of S.entrants) row(e.name);
  for (const m of lgPlayed(ms)) {
    const f = m.fighters.map(row);
    for (const r of f) { r.p++; r.cyc += m.cycles || 0; }
    const w = row(m.winner);
    w.w++;
    w.capR += m.capRounds || 0;
    w.rounds += m.rounds || 0;
    const k = LG_K / Math.max(1, f.length - 1), before = w.elo;
    for (const r of f) {
      if (r === w) continue;
      const exp = 1 / (1 + Math.pow(10, (r.elo - before) / 400));
      const d = k * (1 - exp);
      w.elo += d;
      r.elo -= d;
    }
  }
  const list = [...rows.values()];
  if (S.fmt.format === 'ladder') {
    // El orden de la escalera; los que aún no entraron, al final.
    const at = new Map(lgLadderState(S, ms).ladder.map((n, i) => [n, i]));
    const rank = (r) => (at.has(r.name) ? at.get(r.name) : 1e9);
    list.sort((a, b) => rank(a) - rank(b) || b.elo - a.elo);
  } else if (S.fmt.format === 'rr') list.sort((a, b) => b.w - a.w || b.elo - a.elo || a.p - b.p);
  else list.sort((a, b) => b.elo - a.elo || b.w - a.w);
  return list;
}

// ---- Persistencia ---------------------------------------------------------------
async function lgLoadAll() {
  try {
    lg.list = (await LgDB.all('leagues')).sort((a, b) => a.created.localeCompare(b.created));
  } catch (e) { lg.list = []; log('leagues: no IndexedDB (' + e.message + ')'); }
  let id = '';
  try { id = localStorage.getItem(LG_CUR_KEY) || ''; } catch (e) { /* nada */ }
  await lgSelect(lg.list.find((L) => L.id === id) || lg.list[lg.list.length - 1] || null);
}

async function lgSelect(L) {
  // El Canal con liga lee el calendario de lg.cur: cambiar de liga lo apaga.
  if (typeof ch !== 'undefined' && ch.on && ch.league && ch.league !== L) channelStop();
  lg.cur = L;
  lg.matches = [];
  lg.pastNo = 0;
  if (lg.win) lg.win.querySelector('#lg-past').innerHTML = '';
  if (L) {
    try { lg.matches = (await LgDB.all('matches')).filter((m) => m.league === L.id); } catch (e) { /* nada */ }
    try { localStorage.setItem(LG_CUR_KEY, L.id); } catch (e) { /* nada */ }
  }
  lgRender();
}

async function lgSave(L) {
  try { await LgDB.put('leagues', L); } catch (e) { log('leagues: could not save (' + e.message + ')'); }
}

async function lgCreate(base) {
  const rules = base === 'f1' ? lgF1Rules() : base === 'free' ? lgNoCostRules() : lgCaptureRules();
  const names = new Set(lg.list.map((L) => L.name));
  let n = lg.list.length + 1;
  while (names.has('League ' + n)) n++;
  const L = {
    id: lgNewId(),
    name: 'League ' + n, notes: '', created: new Date().toISOString(),
    seasons: [{ no: 1, started: new Date().toISOString(), rules,
                fmt: { ...LG_FMT_DEFAULT }, entrants: [] }],
  };
  lg.list.push(L);
  await lgSave(L);
  await lgSelect(L);
}

async function lgDelete(L) {
  if (lg.live && lg.live.league === L.id) leagueAbort();
  try { await LgDB.del('leagues', L.id); await LgDB.delMatches(L.id); } catch (e) { /* nada */ }
  lg.list = lg.list.filter((x) => x !== L);
  await lgSelect(lg.list[lg.list.length - 1] || null);
}

async function lgNewSeason(L) {
  if (lg.live && lg.live.league === L.id) leagueAbort();
  const S = lgSeason(L);
  L.seasons.push({ no: S.no + 1, started: new Date().toISOString(),
                   rules: { ...S.rules }, fmt: { ...S.fmt },
                   entrants: S.entrants.map((e) => ({ ...e })) });
  await lgSave(L);
  lgRender();
}

// ---- Compartir (L3) ---------------------------------------------------------------
// El archivo lleva la liga entera (temporadas con reglas, formato y
// participantes con su ADN) y sus partidos sin id ni liga: al importar se
// reasignan. Funciones puras (el smoke hace el ida y vuelta sin DOM).
const LG_FILE_KIND = 'darwinbots-league', LG_FILE_VER = 1;

function lgExportObj(L, matches) {
  const { id, ...league } = L;
  return {
    kind: LG_FILE_KIND, version: LG_FILE_VER, exported: new Date().toISOString(),
    league: JSON.parse(JSON.stringify(league)),
    matches: matches.filter((m) => m.league === id)
      .sort((a, b) => a.season - b.season || a.no - b.no)
      .map(({ id: _i, league: _l, ...m }) => ({ ...m })),
  };
}

// Valida el archivo y devuelve {L, matches} listos para guardar, con un id
// nuevo y el nombre sin repetir entre `names`. Lanza Error si no sirve.
function lgImportObj(o, names, newId) {
  if (!o || o.kind !== LG_FILE_KIND) throw new Error('Not a DarwinBots league file.');
  if (o.version > LG_FILE_VER) throw new Error(`League file version ${o.version} is newer than this page.`);
  const src = o.league || {};
  if (!Array.isArray(src.seasons) || !src.seasons.length) throw new Error('The league has no seasons.');
  const seasons = src.seasons.map((s, i) => {
    if (!s || typeof s.rules !== 'object' || !Array.isArray(s.entrants))
      throw new Error(`Season ${i + 1} is incomplete.`);
    const entrants = s.entrants.map((e) => {
      if (!e || typeof e.name !== 'string' || typeof e.dna !== 'string')
        throw new Error(`Season ${i + 1}: an entrant has no name or DNA.`);
      return { name: e.name, dna: e.dna, hash: lgHash(e.dna), src: e.src || 'form',
               file: e.file || '', color: e.color || '#8899bb' };
    });
    return { no: +s.no || i + 1, started: s.started || '', rules: { ...s.rules },
             fmt: { ...LG_FMT_DEFAULT, ...(s.fmt || {}) }, entrants };
  });
  let name = String(src.name || 'League').trim() || 'League';
  if (names.has(name)) {
    const base = name + ' (imported)';
    name = base;
    for (let k = 2; names.has(name); k++) name = `${base} ${k}`;
  }
  const L = { id: newId, name, notes: String(src.notes || ''),
              created: src.created || new Date().toISOString(), seasons };
  const nos = new Set(seasons.map((s) => s.no));
  const matches = (Array.isArray(o.matches) ? o.matches : [])
    .filter((m) => m && nos.has(m.season) && Array.isArray(m.fighters))
    .map(({ id: _i, ...m }) => ({ ...m, league: newId }));
  return { L, matches };
}

const lgNewId = () => 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
const lgFileName = (L) => (L.name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') || 'league') + '.league.json';

function lgExport(L) {
  const blob = new Blob([JSON.stringify(lgExportObj(L, lg.matches), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = lgFileName(L);
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  lgNote(`Exported to ${a.download}.`);
}

async function lgImport(file) {
  let r;
  try {
    r = lgImportObj(JSON.parse(await file.text()), new Set(lg.list.map((L) => L.name)), lgNewId());
  } catch (e) { lgNote(`Import failed: ${e.message}`, true); return; }
  await lgSave(r.L);
  for (const m of r.matches) {
    try { await LgDB.put('matches', m); } catch (e) { log('leagues: could not save a match'); }
  }
  lg.list.push(r.L);
  await lgSelect(r.L);
  lgNote(`Imported "${r.L.name}": ${r.L.seasons.length} seasons, ${r.matches.length} matches.`);
}

// ---- Participantes ---------------------------------------------------------------
function lgFreeColor(S) {
  const used = new Set(S.entrants.map((e) => e.color));
  return CH_COLORS.find((c) => !used.has(c)) || invColor();
}

// Agrega {name, dna, src, file}. El mismo ADN no entra dos veces; un nombre
// repetido con otro ADN lleva sufijo (el censo agrupa por nombre).
function lgAddEntrant(S, e) {
  const hash = lgHash(e.dna);
  if (S.entrants.some((x) => x.hash === hash)) return false;
  const taken = new Set(S.entrants.map((x) => x.name));
  let name = e.name;
  for (let k = 2; taken.has(name); k++) name = `${e.name} ${k}`;
  S.entrants.push({ name, dna: e.dna, hash, src: e.src, file: e.file || '', color: lgFreeColor(S) });
  return true;
}

async function lgAddItems(items) {
  const L = lg.cur, S = lgSeason(L);
  let added = 0, failed = 0;
  for (const it of items) {
    try {
      const dna = await invFetchDna(it.b);
      if (lgAddEntrant(S, { name: it.b.name, dna, src: 'bestiary', file: it.b.file })) added++;
    } catch (e) { failed++; }
  }
  await lgSave(L);
  lgNote(`${added} entrants added` + (failed ? ` · ${failed} unreadable` : '') +
         (items.length - added - failed ? ` · ${items.length - added - failed} already in` : '') + '.');
  lgRender();
}

// Pool del Inventario, como el del Canal (no vegetales, un nombre por especie).
function lgPool(filter) {
  let items = inv.items.filter((it) => !it.b.veg);
  if (filter === 'fav') items = items.filter((it) => userRec(it.key).fav);
  else if (filter === 'sel') items = items.filter((it) => inv.sel.has(it.key));
  else if (filter.startsWith('tag:')) {
    const t = filter.slice(4);
    items = items.filter((it) => userRec(it.key).tags.includes(t));
  } else if (filter.startsWith('set:')) {
    const set = inv.sets.get(filter.slice(4));
    const keys = new Set(set ? set.keys : []);
    items = items.filter((it) => keys.has(it.key));
  } else if (filter !== 'all') items = [];
  const seen = new Set();
  return items.filter((it) => !seen.has(it.b.name) && seen.add(it.b.name));
}

// ---- Partidos -------------------------------------------------------------------
function lgNote(text, warn) {
  if (!lg.win) return;
  const n = lg.win.querySelector('#lg-note');
  n.textContent = text;
  n.className = 'ct-note' + (warn ? ' warn' : '');
}

async function lgPlayNext() {
  const L = lg.cur;
  if (!L || lg.live) return;
  const S = lgSeason(L);
  const fx = lgNextFixture(L);
  if (!fx) {
    lgNote(S.entrants.length < 2 ? 'A league needs at least 2 entrants.' : 'The season is complete.', true);
    return;
  }
  if (typeof channelStop === 'function') channelStop();   // un torneo a la vez
  try { await lgPlay(L, fx); } catch (e) { lgNote(e.message, true); }
}

// Juega una pelea de la liga (la lanza la ventana o el Canal, L2): aplica
// las reglas de la temporada, abre lg.live y arranca con contestLaunch.
// Lanza excepción si algún ADN no se puede sembrar (sin partido abierto).
// L3: o.replay = partido del historial a repetir (su temporada y su semilla;
// no se registra, se compara).
async function lgPlay(L, fx, o = {}) {
  if (lg.live) throw new Error('A league match is already running.');
  const S = o.replay ? L.seasons.find((s) => s.no === o.replay.season) : lgSeason(L);
  contest.running = false;
  if (typeof contestRender === 'function') contestRender();
  lgApplyRules(S.rules);
  const f = S.fmt;
  lg.live = { league: L.id, season: S.no, fighters: fx.fighters, label: fx.label,
              ready: false, capRounds: 0, cycles: 0, f1: null, lastWins: null,
              replay: o.replay || null };
  if (o.replay) document.getElementById('seed').value = o.replay.seed;
  lgNote('Preparing…');
  try {
    await contestLaunch(fx.fighters.map((e) => ({ name: e.name, src: 'form', dna: e.dna,
                                                  qty: f.qty, color: e.color })),
      { nrg: f.nrg, f1: false, rounds: f.rounds, wins: f.wins, cap: f.cap,
        capMode: f.capMode, newSeed: !o.replay });
  } catch (e) {
    lg.live = null;
    lgRender();
    throw e;
  }
  lg.live.seed = parseFloat(document.getElementById('seed').value) || 0;
  log(`🏟 ${L.name}: ${fx.fighters.map((e) => e.name).join(' vs ')}`);
  lgNote(fx.label);
  lgRender();
}

// Repite un partido del historial: las reglas y el formato de SU temporada,
// los mismos participantes (el ADN congelado) en el mismo orden de siembra y
// la misma semilla. El core es determinista: debe salir lo mismo.
async function lgReplay(id) {
  const L = lg.cur, m = L && lg.matches.find((x) => x.id === id);
  if (!m || lg.live) return;
  const S = L.seasons.find((s) => s.no === m.season);
  const fighters = m.fighters.map((n) => S && S.entrants.find((e) => e.name === n));
  if (!S || fighters.some((e) => !e)) {
    lgNote(`Match #${m.no} cannot be replayed: an entrant is no longer in season ${m.season}.`, true);
    return;
  }
  if (typeof channelStop === 'function') channelStop();   // un torneo a la vez
  try {
    await lgPlay(L, { fighters, label: `Replay of match #${m.no} (season ${m.season}, seed ${m.seed})` },
                 { replay: m });
  } catch (e) { lgNote(e.message, true); }
}

// Compara la repetición con lo registrado (ganador, victorias y ciclos). Los
// partidos de antes de que f1-over trajera el marcador (0 ciclos) solo
// guardan el ganador.
function lgReplayCheck(m, got) {
  const diffs = [], full = !!m.cycles;
  if (got.winner !== (m.winner || '')) diffs.push(`winner ${got.winner || '—'} (was ${m.winner || '—'})`);
  if (full && (m.wins || []).join() !== got.wins.join()) diffs.push(`wins ${got.wins.join('-')} (was ${(m.wins || []).join('-')})`);
  if (full && m.cycles !== got.cycles) diffs.push(`${got.cycles} cycles (was ${m.cycles})`);
  lg.checked.set(m.id, diffs.length ? 'diff' : 'same');
  if (diffs.length) {
    log(`🏟 replay of #${m.no} differs: ${diffs.join(' · ')}`);
    lgNote(`⚠ Replay of match #${m.no} differs: ${diffs.join(' · ')}.`, true);
  } else {
    log(`🏟 replay of #${m.no} matches the record`);
    lgNote(`✓ Replay of match #${m.no} matches: ${got.winner || 'void'}, ${got.wins.join('-')}, ${got.cycles} cycles` +
           (full ? '.' : ' (only the winner was recorded).'));
  }
  lgRender();
}

// Abandona el partido en curso sin registrarlo (otro torneo toma la sim).
function leagueAbort() {
  if (!lg.live) return;
  const replay = lg.live.replay;
  lg.live = null;
  lgNote(replay ? `Replay of match #${replay.no} abandoned.` : 'Match abandoned: not recorded.', true);
  lgRender();
}

async function lgRecord(winner, note) {
  const m = lg.live;
  if (!m) return;
  lg.live = null;
  const L = lg.list.find((x) => x.id === m.league);
  const sp = (m.f1 && m.f1.sp) || [];
  const wins = m.fighters.map((e) => (sp.find((s) => s.name === e.name) || {}).wins || 0);
  if (m.replay) { lgReplayCheck(m.replay, { winner: winner || '', wins, cycles: m.cycles || 0 }); return; }
  const no = Math.max(0, ...lg.matches.filter((x) => x.league === m.league && x.season === m.season)
    .map((x) => x.no)) + 1;
  const rec = {
    league: m.league, season: m.season, no, date: new Date().toISOString(),
    format: L ? lgSeason(L).fmt.format : '', fighters: m.fighters.map((e) => e.name),
    seed: m.seed, winner: winner || '', wins, rounds: wins.reduce((a, b) => a + b, 0),
    cycles: m.cycles || 0, capRounds: m.capRounds, note: note || '',
  };
  try { rec.id = await LgDB.put('matches', rec); } catch (e) { log('leagues: could not save the match'); }
  if (lg.cur && lg.cur.id === m.league) lg.matches.push(rec);
  log(winner ? `🏟 ${winner} wins (${rec.rounds} rounds, ${rec.cycles} cycles)` : `🏟 match void: ${note}`);
  lgNote(winner ? `🏆 ${winner} wins the match.` : note, !winner);
  lgRender();
  if (typeof channelOnLeagueResult === 'function') channelOnLeagueResult(rec);
}

// Hasta la respuesta al censo del partido (f1-started) llegan mensajes y
// frames de la sim anterior: se ignoran. El worker atiende en orden, así que
// lo que viene después es del partido nuevo.
function leagueOnMessage(msg) {
  const m = lg.live;
  if (!m) return;
  if (msg.t === 'f1-started') {
    if (!m.ready && !msg.n) lgRecord('', 'void: the census found no fighters');
    m.ready = true;
    return;
  }
  if (!m.ready) return;
  if (msg.t === 'f1-note' && msg.kind === 'single') lgRecord('', 'void: only one species in the census');
  else if (msg.t === 'f1-note' && msg.kind === 'cap') m.capRounds++;
  else if (msg.t === 'f1-over') {
    // El worker manda el marcador final y los ciclos con el aviso.
    if (msg.f1) m.f1 = msg.f1;
    if (msg.cycles !== undefined) m.cycles = msg.cycles;
    lgRecord(msg.winner);
  }
}

function leagueOnStats(st) {
  const m = lg.live;
  if (!m || !m.ready || !st.f1) return;
  const rw = contestRoundWinner(m.lastWins, st.f1);
  if (rw) lgNote(`Round ${st.f1.contests} goes to ${rw}.`);
  m.lastWins = st.f1.sp.map((s) => s.wins);
  if (lg.win) {
    const L = lg.list.find((x) => x.id === m.league);
    const f = L ? lgSeason(L).fmt : LG_FMT_DEFAULT;
    lg.win.querySelector('#lg-board').innerHTML = contestBoardHtml(
      st, new Map(m.fighters.map((e) => [e.name, e.color])), f.rounds, '', f.wins);
  }
}

// ---- Render ---------------------------------------------------------------------
function lgFmtHtml(f, locked) {
  const d = locked ? ' disabled' : '';
  const num = (id, label, v, min, max, title) =>
    `<label${title ? ` title="${title}"` : ''}>${label}</label>` +
    `<input type="number" data-f="${id}" min="${min}"${max ? ` max="${max}"` : ''} value="${v}"${d}>`;
  return '<div class="ct-rules">' +
    `<label>Format</label><select data-f="format"${d}>` +
    `<option value="koth"${f.format === 'koth' ? ' selected' : ''}>King of the hill</option>` +
    `<option value="rr"${f.format === 'rr' ? ' selected' : ''}>Round robin</option>` +
    `<option value="ladder"${f.format === 'ladder' ? ' selected' : ''} title="The original's step ladder: each newcomer challenges from the top rung down and takes the first rung it wins">Step ladder</option></select>` +
    (f.format === 'ladder' ? ''
    : f.format === 'rr'
      ? num('legs', 'Legs (each pair meets)', f.legs, 1, 2, '1 = once; 2 = home and away, with the seeding order swapped')
      : num('k', 'Fighters per fight', f.k, 2, 20) +
        num('retire', 'Champion retires after', f.retire, 1, 999, 'Consecutive wins the champion needs to retire undefeated')) +
    num('qty', 'Bots per species', f.qty, 1, 200) +
    num('nrg', 'Starting energy', f.nrg, 1, 0) +
    num('rounds', 'Minimum rounds per match', f.rounds, 1, 99) +
    num('wins', 'Wins to take the match', f.wins, 0, 99, "The original's Maxrounds; 0 = only the statistical rule") +
    num('cap', 'Cycle cap per round (0 = off)', f.cap, 0, 0) +
    `<label title="Who takes a round that reaches the cycle cap">At the cap, the round goes to</label>` +
    `<select data-f="capMode"${d}>` +
    `<option value="pop"${f.capMode === 'pop' ? ' selected' : ''}>most bots</option>` +
    `<option value="nrg"${f.capMode === 'nrg' ? ' selected' : ''}>most energy</option></select>` +
    '</div>';
}

function lgStandingsHtml(S, ms) {
  const rows = lgStandings(S, ms);
  const koth = S.fmt.format === 'koth' ? lgKothState(S, ms) : null;
  if (!rows.length) return '<div class="ct-empty">No entrants yet.</div>';
  return '<table class="ch-table"><tr><th></th><th>Entrant</th><th title="Played">P</th>' +
    '<th title="Won">W</th><th title="Lost">L</th><th title="Win rate">%</th><th>Elo</th>' +
    (koth ? '<th title="Undefeated retirements">👑</th>' : '') +
    '<th title="Share of the rounds it won that were decided by the cycle cap">cap</th>' +
    '<th title="Average cycles per match played">⏱</th></tr>' +
    rows.map((r, i) => `<tr><td>${i + 1}</td><td class="ch-n" title="${escHtml(r.name)}">` +
      `<span class="ct-dot lg-dot" style="background:${r.color}"></span>${escHtml(r.name)}</td>` +
      `<td>${r.p}</td><td>${r.w}</td><td>${r.p - r.w}</td>` +
      `<td>${r.p ? Math.round((r.w / r.p) * 100) : '–'}</td><td>${Math.round(r.elo)}</td>` +
      (koth ? `<td>${koth.titles.get(r.name) || ''}</td>` : '') +
      `<td>${r.rounds ? Math.round((r.capR / r.rounds) * 100) + '%' : ''}</td>` +
      `<td>${r.p ? Math.round(r.cyc / r.p) : ''}</td></tr>`).join('') +
    '</table>';
}

// Enfrentamientos directos: h[a][b] = veces que a le ganó a b (en una pelea
// de N, el ganador le gana a cada uno de los demás, como en el Elo).
function lgH2H(ms) {
  const h = new Map();
  for (const m of lgPlayed(ms)) {
    const r = h.get(m.winner) || h.set(m.winner, new Map()).get(m.winner);
    for (const n of m.fighters) if (n !== m.winner) r.set(n, (r.get(n) || 0) + 1);
  }
  return (a, b) => (h.get(a) && h.get(a).get(b)) || 0;
}

const LG_H2H_MAX = 14;
function lgH2HHtml(S, ms) {
  const rows = lgStandings(S, ms);
  if (rows.length < 2) return '<div class="ct-empty">No entrants yet.</div>';
  if (rows.length > LG_H2H_MAX)
    return `<div class="ct-empty">Only for leagues of up to ${LG_H2H_MAX} entrants.</div>`;
  const w = lgH2H(ms);
  return '<table class="ch-table lg-h2h"><tr><th></th><th>Row beat column</th>' +
    rows.map((_, j) => `<th>${j + 1}</th>`).join('') + '</tr>' +
    rows.map((a, i) => `<tr><td>${i + 1}</td><td class="ch-n" title="${escHtml(a.name)}">` +
      `<span class="ct-dot lg-dot" style="background:${a.color}"></span>${escHtml(a.name)}</td>` +
      rows.map((b) => {
        if (a === b) return '<td class="lg-x">·</td>';
        const x = w(a.name, b.name), y = w(b.name, a.name);
        if (!x && !y) return '<td class="lg-x"></td>';
        return `<td class="${x > y ? 'lg-up' : x < y ? 'lg-dn' : ''}" title="${escHtml(a.name)} ${x}–${y} ${escHtml(b.name)}">${x}–${y}</td>`;
      }).join('') + '</tr>').join('') +
    '</table>';
}

// Cada partido con su botón de repetir (L3) y la marca de la última
// repetición de esta sesión (✓ igual, ≠ distinto).
function lgHistoryHtml(ms) {
  if (!ms.length) return '<div class="ct-empty">No matches yet.</div>';
  const busy = lg.live ? ' disabled' : '';
  const mark = { same: '<b class="lg-up" title="The last replay matched">✓</b> ',
                 diff: '<b class="lg-dn" title="The last replay differed">≠</b> ' };
  return ms.slice().reverse().slice(0, 60).map((m) =>
    `<div class="ch-res">` +
    (m.id !== undefined ? `<button class="ch-small lg-replay" data-replay="${m.id}"${busy}` +
      ` title="Replay with the same rules, entrants, order and seed">↻</button> ` : '') +
    (mark[lg.checked.get(m.id)] || '') + `<span>#${m.no}</span> ` +
    m.fighters.map((n, i) => escHtml(n) + (m.wins && m.wins[i] ? ` <span>${m.wins[i]}</span>` : '')).join(' vs ') +
    ' → ' + (m.winner ? `<b>${escHtml(m.winner)}</b>` : '—') +
    ` <i>${m.cycles || 0} cyc` + (m.capRounds ? ` · ${m.capRounds} by cap` : '') +
    ` · seed ${m.seed}${m.note ? ' · ' + escHtml(m.note) : ''}</i></div>`).join('');
}

function lgPoolOptions() {
  return '<option value="">— from the Inventory —</option>' +
    '<option value="sel">the Inventory selection</option>' +
    '<option value="fav">★ favorites</option>' +
    allTags().map(([t, n]) => `<option value="tag:${escHtml(t)}">#${escHtml(t)} (${n})</option>`).join('') +
    [...inv.sets.keys()].map((n) => `<option value="set:${escHtml(n)}">selection: ${escHtml(n)}</option>`).join('') +
    '<option value="all">the whole Bestiary</option>';
}

// El Canal abierto muestra las ligas y la tabla: se refresca con la liga.
function lgSyncChannel() {
  if (typeof ch === 'undefined' || !ch.win) return;
  chRenderLeagueOpts();
  // Con el Canal apagado y una liga elegida, sigue a la liga abierta aquí.
  const sel = ch.win.querySelector('#ch-league');
  if (!ch.on && sel.value && lg.cur && sel.value !== lg.cur.id) sel.value = lg.cur.id;
  chRender();
}

function lgRender() {
  if (!lg.win) { lgSyncChannel(); return; }
  const w = lg.win;
  const $ = (id) => w.querySelector('#' + id);
  lgSyncChannel();
  $('lg-pick').innerHTML = lg.list.length
    ? lg.list.map((L) => `<option value="${L.id}"${L === lg.cur ? ' selected' : ''}>${escHtml(L.name)}</option>`).join('')
    : '<option value="">— no leagues —</option>';
  $('lg-del').textContent = lg.confirm === 'del' ? 'Delete it?' : '🗑';
  $('lg-del').disabled = !lg.cur;
  $('lg-export').disabled = !lg.cur;
  const L = lg.cur;
  $('lg-main').hidden = !L;
  $('lg-empty').hidden = !!L;
  if (!L) return;
  const S = lgSeason(L), ms = lgSeasonMatches(S.no);
  const locked = ms.length > 0;
  const live = lg.live && lg.live.league === L.id;
  if (document.activeElement !== $('lg-name')) $('lg-name').value = L.name;
  $('lg-season').innerHTML = `Season <b>${S.no}</b> · ${lgPlayed(ms).length} matches` +
    (locked ? ' · 🔒 rules and format locked' : ' · rules and format editable');
  $('lg-fmt').innerHTML = lgFmtHtml(S.fmt, locked);
  $('lg-rules').innerHTML = lgRulesSummary(S.rules);
  $('lg-rsave').disabled = locked;
  $('lg-rbase').disabled = locked;
  $('lg-ecount').textContent = `${S.entrants.length}`;
  const playedBy = new Set(ms.flatMap((m) => m.fighters));
  $('lg-entrants').innerHTML = S.entrants.length
    ? S.entrants.map((e, i) => `<div class="ct-fighter" data-i="${i}">` +
        `<span class="ct-dot" style="background:${e.color}"></span>` +
        `<span class="ct-name" title="${escHtml(e.name)} · DNA ${e.hash}">${escHtml(e.name)}</span>` +
        `<span class="ct-src">${{ bestiary: 'Bestiary', hybrid: 'hybrid', form: 'form' }[e.src] || ''}</span>` +
        `<button class="ct-del" title="${playedBy.has(e.name) ? 'Already played this season' : 'Remove'}"` +
        `${playedBy.has(e.name) ? ' disabled' : ''}>✕</button></div>`).join('')
    : '<div class="ct-empty">Add at least 2 entrants.</div>';
  const fx = live ? null : lgNextFixture(L);
  $('lg-next').innerHTML = live
    ? `${lg.live.replay ? `Replaying #${lg.live.replay.no}` : 'Playing'}: ${lg.live.fighters.map((e) => `<b style="color:${e.color}">${escHtml(e.name)}</b>`).join(' vs ')}`
    : fx ? `Next: ${fx.fighters.map((e) => `<b style="color:${e.color}">${escHtml(e.name)}</b>`).join(' vs ')}` +
           ` <span class="ct-rule">${escHtml(fx.label)}</span>`
         : S.entrants.length < 2 ? '' : '🏁 Season complete.';
  if (S.fmt.format === 'koth') {
    const k = lgKothState(S, ms);
    if (k.champ) $('lg-next').innerHTML += `<div class="ct-rule">👑 ${escHtml(k.champ)} · streak ${k.streak}/${S.fmt.retire}</div>`;
  }
  $('lg-play').disabled = !!lg.live || !fx;
  $('lg-play').hidden = !live && !fx;
  $('lg-abort').hidden = !live;
  $('lg-board').hidden = !live;
  if (!live) $('lg-board').innerHTML = '';
  $('lg-table').innerHTML = lgStandingsHtml(S, ms);
  $('lg-hist').innerHTML = lgHistoryHtml(ms);
  $('lg-h2h').innerHTML = lgH2HHtml(S, ms);
  if (lg.pastNo) {
    const d = $('lg-past').querySelector('details');
    const open = d && d.open;
    lgShowSeason(lg.pastNo);
    if (open) $('lg-past').querySelector('details').open = true;
  }
  $('lg-newseason').textContent = lg.confirm === 'season'
    ? `Start season ${S.no + 1}? (click again)` : '📅 New season';
  $('lg-newseason').disabled = !locked;
  $('lg-seasons').innerHTML = L.seasons.length > 1
    ? 'Past seasons: ' + L.seasons.slice(0, -1).map((s) =>
        `<button class="ch-small" data-season="${s.no}">${s.no}</button>`).join(' ')
    : '';
}

// Tabla de una temporada pasada, en el lugar del historial.
function lgShowSeason(no) {
  const L = lg.cur, S = L && L.seasons.find((s) => s.no === no);
  if (!S) return;
  const ms = lgSeasonMatches(no);
  lg.win.querySelector('#lg-past').innerHTML =
    `<div class="ct-h">Season ${no} · ${lgPlayed(ms).length} matches</div>` +
    `<div class="lg-costs">${lgRulesSummary(S.rules)}</div>` + lgStandingsHtml(S, ms) +
    `<details class="ch-sec"><summary>Matches of season ${no}</summary>${lgHistoryHtml(ms)}</details>`;
  lg.pastNo = no;
}

function lgArm(kind, fn) {
  if (lg.confirm === kind) {
    lg.confirm = '';
    clearTimeout(lg.confirmT);
    fn();
    return;
  }
  lg.confirm = kind;
  clearTimeout(lg.confirmT);
  lg.confirmT = setTimeout(() => { lg.confirm = ''; lgRender(); }, 3000);
  lgRender();
}

// ---- Ventana -------------------------------------------------------------------
async function openLeagues() {
  if (lg.win) { winLayer.appendChild(lg.win); return; }
  if (!inv.items.length) await invLoad();
  const w = makeWindow('🏟 Leagues', Math.min(480, innerWidth - 40), 0, () => { lg.win = null; });
  lg.win = w;
  w.classList.add('ct-win');
  w.style.left = Math.max(20, innerWidth - 540) + 'px';
  w.style.top = '60px';
  w.body.innerHTML =
    '<div class="lg-top">' +
    '<select id="lg-pick"></select>' +
    '<select id="lg-base" title="Rules for a new league">' +
    '<option value="f1">F1 league rules</option>' +
    '<option value="panel">the current Sim options</option>' +
    '<option value="free">the current Sim options, no costs</option></select>' +
    '<button id="lg-new" title="New league with the chosen rules">＋ New</button>' +
    '<button id="lg-del" title="Delete this league and its matches">🗑</button>' +
    '<button id="lg-export" title="Download this league (rules, entrants with their DNA and matches) as a file">⬇</button>' +
    '<button id="lg-import" title="Load a league from a file">⬆</button>' +
    '<input id="lg-file" type="file" accept=".json,application/json" hidden>' +
    '</div>' +
    '<div id="lg-empty" class="ct-empty">No leagues yet: choose the rules and press ＋ New.</div>' +
    '<div id="lg-main">' +
    '<input id="lg-name" class="lg-name" title="League name">' +
    '<div id="lg-season" class="ct-rule"></div>' +
    '<details class="ch-sec" open><summary>Format</summary><div id="lg-fmt"></div></details>' +
    '<details class="ch-sec"><summary>Rules</summary><div id="lg-rules"></div>' +
    '<div class="ct-srcrow">' +
    '<button id="lg-rload" title="Write these rules into the Sim options panel">Load into the panel</button>' +
    '<button id="lg-rsave" title="Replace the rules with the Sim options panel as it is now">Save the panel as rules</button>' +
    '<button id="lg-rbase" title="Replace the rules with the F1 league settings (btnSetF1)">F1 rules</button>' +
    '</div></details>' +
    '<details class="ch-sec" open><summary>Entrants <span id="lg-ecount"></span></summary>' +
    '<div id="lg-entrants"></div>' +
    '<div class="ct-srcrow">' +
    '<select id="lg-pool"></select>' +
    '<select id="lg-hyb"></select>' +
    '<button id="lg-addform" title="The DNA and name from the Seed species panel">DNA from the form</button>' +
    '</div>' +
    '<div class="ct-rule">Each entrant keeps the DNA it had when it joined.</div></details>' +
    '<div class="ct-h">Play</div>' +
    '<div id="lg-next"></div>' +
    '<div class="ct-liverow">' +
    '<button id="lg-play" class="primary">▶ Play next match</button>' +
    '<button id="lg-abort" hidden title="Stop recording this match">✕ Abandon</button>' +
    '</div>' +
    '<div id="lg-board"></div>' +
    '<div id="lg-note" class="ct-note"></div>' +
    '<details class="ch-sec" open><summary>Standings</summary><div id="lg-table"></div></details>' +
    '<details class="ch-sec"><summary>Head to head</summary><div id="lg-h2h"></div></details>' +
    '<details class="ch-sec"><summary>Matches</summary><div id="lg-hist"></div></details>' +
    '<div class="ct-liverow"><button id="lg-newseason" class="ch-small" title="Unlocks rules and format; entrants carry over">📅 New season</button>' +
    '<span id="lg-seasons"></span></div>' +
    '<div id="lg-past"></div>' +
    '</div>';

  const $ = (id) => w.querySelector('#' + id);
  $('lg-pick').onchange = (e) => lgSelect(lg.list.find((L) => L.id === e.target.value) || null);
  $('lg-new').onclick = () => lgCreate($('lg-base').value);
  $('lg-del').onclick = () => lg.cur && lgArm('del', () => lgDelete(lg.cur));
  $('lg-name').onchange = async (e) => {
    const v = e.target.value.trim();
    if (!lg.cur || !v) return;
    lg.cur.name = v;
    await lgSave(lg.cur);
    lgRender();
  };
  $('lg-fmt').onchange = async (e) => {
    const k = e.target.dataset.f;
    if (!k || !lg.cur) return;
    const f = lgSeason(lg.cur).fmt;
    if (k === 'format' || k === 'capMode') f[k] = e.target.value;
    else {
      const n = parseInt(e.target.value, 10);
      const lo = +e.target.min || 0, hi = +e.target.max || 1e7;
      f[k] = Math.min(hi, Math.max(lo, Number.isNaN(n) ? LG_FMT_DEFAULT[k] : n));
    }
    await lgSave(lg.cur);
    lgRender();
  };
  $('lg-rload').onclick = () => {
    if (!lg.cur) return;
    lgApplyRules(lgSeason(lg.cur).rules);
    lgNote('Rules loaded into the panel: size changes apply when you press Reset.');
    lgRender();
  };
  $('lg-rsave').onclick = async () => {
    if (!lg.cur) return;
    lgSeason(lg.cur).rules = lgCaptureRules();
    await lgSave(lg.cur);
    lgNote('Rules saved from the panel.');
    lgRender();
  };
  $('lg-rbase').onclick = async () => {
    if (!lg.cur) return;
    lgSeason(lg.cur).rules = lgF1Rules();
    await lgSave(lg.cur);
    lgNote('F1 league rules set.');
    lgRender();
  };
  $('lg-pool').onchange = async (e) => {
    const f = e.target.value;
    e.target.value = '';
    if (!f || !lg.cur) return;
    const items = lgPool(f);
    if (!items.length) { lgNote('That pool is empty.', true); return; }
    lgNote(`Reading ${items.length} bots…`);
    await lgAddItems(items);
  };
  $('lg-hyb').onchange = async (e) => {
    const name = e.target.value;
    e.target.value = '';
    if (!name || !lg.cur) return;
    const dna = await labDnaByName(name + '.txt');
    if (!dna) { lgNote(`Hybrid "${name}" not found.`, true); return; }
    const S = lgSeason(lg.cur);
    if (!lgAddEntrant(S, { name, dna, src: 'hybrid', file: name })) lgNote('Already in the league.');
    await lgSave(lg.cur);
    lgRender();
  };
  $('lg-addform').onclick = async () => {
    if (!lg.cur) return;
    const dna = document.getElementById('dna').value;
    if (!dna.trim()) { lgNote('The form has no DNA.', true); return; }
    const name = (document.getElementById('sp-name').value || 'bot.txt').replace(/\.txt$/i, '');
    if (!lgAddEntrant(lgSeason(lg.cur), { name, dna, src: 'form' })) lgNote('Already in the league.');
    await lgSave(lg.cur);
    lgRender();
  };
  $('lg-entrants').onclick = async (e) => {
    if (!e.target.classList.contains('ct-del') || !lg.cur) return;
    lgSeason(lg.cur).entrants.splice(+e.target.closest('[data-i]').dataset.i, 1);
    await lgSave(lg.cur);
    lgRender();
  };
  $('lg-export').onclick = () => lg.cur && lgExport(lg.cur);
  $('lg-import').onclick = () => $('lg-file').click();
  $('lg-file').onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (f) await lgImport(f);
  };
  // Repetir un partido: del historial de la temporada o de una pasada.
  w.body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-replay]');
    if (b && !b.disabled) lgReplay(+b.dataset.replay);
  });
  $('lg-play').onclick = () => lgPlayNext();
  $('lg-abort').onclick = () => leagueAbort();
  $('lg-newseason').onclick = () => lg.cur && lgArm('season', () => lgNewSeason(lg.cur));
  $('lg-seasons').onclick = (e) => {
    const b = e.target.closest('[data-season]');
    if (b) lgShowSeason(+b.dataset.season);
  };

  $('lg-pool').innerHTML = lgPoolOptions();
  let hs = [];
  try { hs = (await InvDB.all('hybrids')).filter((h) => !h.veg); } catch (e) { /* sin IndexedDB */ }
  $('lg-hyb').innerHTML = '<option value="">— hybrid —</option>' +
    hs.map((h) => `<option>${escHtml(h.name)}</option>`).join('');
  $('lg-hyb').disabled = !hs.length;
  await lgLoadAll();
}
