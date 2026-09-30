// @ts-check
// Conexión con el worker de sim (engine/worker.js): envoltorio del protocolo
// documentado en su cabecera. Puro JS, sin runes ni DOM: el worker y el
// agendador se inyectan (en el navegador, un Worker y requestAnimationFrame;
// en los tests, dobles). La sesión reactiva (sesion.svelte.js) se apoya acá.
//
// Frames: ping-pong como la clásica. Llega {t:'frame', buf, stats}; en el
// siguiente cuadro de animación se decodifica, se dibuja (si hay dibujante),
// se avisa a los oyentes de 'frame' y se devuelve el búfer con 'ack'. El
// worker no publica otro frame hasta recibir el ack. Sin dibujante (ninguna
// pantalla muestra el mundo) el búfer se devuelve igual: la sim sigue.
//
// Pedidos con respuesta (save, bot-text, getopt, load con respuesta): cada uno es una promesa con
// tiempo límite (TIEMPOS) que se rechaza con un ErrorConexion si vence, si el
// worker falla (onerror) o si muere (error de carga, terminar). Correlación:
//   - save, bot-text y load viajan con `id`; si la respuesta lo trae, se empareja
//     por id y una respuesta tardía (de un pedido ya vencido o rechazado) se
//     descarta sin tocar a los demás.
//   - snapshot y dead-take (N4.1) no llevan id: se emparejan en orden; si
//     el worker falla (onerror) se retiran de su cola sin dejar lápida.
//   - si la respuesta no trae id (worker sin correlación) o el protocolo no
//     deja ponerlo (getopt: su `id` es el de la opción), se empareja en orden
//     (FIFO por tipo y bot/opción). Un pedido vencido queda como «lápida» en
//     su cola para que su respuesta tardía la consuma a ella y no al pedido
//     siguiente.
//   - save y getopt pueden quedarse sin respuesta (sim vacía o sin sim): tras
//     ellos va una «valla» ({t:'bot-text', n:0}, que el worker siempre
//     contesta, en orden). Cuando vuelve la valla, todo save/getopt anterior
//     sin respuesta se rechaza ('sin-respuesta') y sus lápidas se retiran:
//     el worker atiende en orden, así que ya no puede contestar. Así la cola
//     se resincroniza sola.

import { decodificarFrame } from './frame.js';

/** Tiempo límite de cada pedido con respuesta (ms). */
export const TIEMPOS = Object.freeze({
  save: 30_000,
  botText: 10_000,
  getopt: 10_000,
  load: 60_000,
  ciclo: 10_000,
  snapshot: 60_000,
  dead: 60_000,
});

/**
 * Rechazo de un pedido al worker. `clave`: 'tiempo' (venció), 'worker'
 * (excepción en el worker), 'carga' (el motor no cargó), 'terminada'
 * (conexión cerrada), 'sin-respuesta' (el worker atendió el pedido sin
 * contestar: p. ej. guardar sin sim) o la que mande el worker ('save-empty').
 */
export class ErrorConexion extends Error {
  /** @param {string} clave @param {string} [detalle] */
  constructor(clave, detalle) {
    super(detalle ? `${clave}: ${detalle}` : clave);
    this.name = 'ErrorConexion';
    this.clave = clave;
  }
}

/**
 * @typedef {object} Pedido
 * @property {number} id
 * @property {'save' | 'bot-text' | 'opt' | 'valla' | 'load' | 'ciclo' | 'snapshot' | 'dead'} tipo
 * @property {string} k           cola FIFO ('save', 'bot-text:9', 'opt:21')
 * @property {boolean} vivo       false = lápida (rechazado o vencido)
 * @property {(v: any) => void} resolver
 * @property {(e: Error) => void} rechazar
 * @property {any} timer
 */

/**
 * @typedef {object} Reloj
 * @property {(fn: () => void, ms: number) => any} poner
 * @property {(h: any) => void} quitar
 */

/**
 * @typedef {object} WorkerLike
 * @property {(msg: any, transfer?: Transferable[]) => void} postMessage
 * @property {((e: { data: any }) => void) | null} onmessage
 * @property {((e: any) => void) | null} [onerror]
 * @property {() => void} [terminate]
 */

/**
 * @typedef {object} StatsFrame
 * @property {number} cycle
 * @property {number} bots
 * @property {number} vegs
 * @property {number} tps
 * @property {number} [costx]
 * @property {any} [f1]
 * @property {number} [dead]
 * @property {number} [selSeq]
 */

/**
 * @typedef {object} EventoFrame
 * @property {import('./frame.js').Frame} frame  válido solo durante el aviso (el búfer vuelve al worker)
 * @property {StatsFrame} stats
 * @property {boolean} seqVigente  el frame ya refleja la última selección pedida
 * @property {number} drawMs       costo del dibujo de este frame
 */

/**
 * @callback Dibujante
 * @param {import('./frame.js').Frame} frame
 * @param {StatsFrame} stats
 * @returns {void}
 */

/**
 * @typedef {object} EspecieSiembra
 * @property {string} dna
 * @property {string} name
 * @property {boolean} veg
 * @property {number} qty
 * @property {number} nrg
 * @property {number} color  Long BGR
 */

export class ConexionSim {
  /** @type {WorkerLike} */
  #w;
  /** @type {(cb: () => void) => void} */
  #programar;
  /** @type {() => number} */
  #ahora;
  /** @type {Map<string, Set<(msg: any) => void>>} */
  #oyentes = new Map();
  /** @type {{ buf: ArrayBuffer, stats: StatsFrame } | null} */
  #pendiente = null;
  #agendado = false;
  #redibujoPedido = false;
  /** @type {Dibujante | null} */
  #dibujante = null;
  /** @type {Reloj} */
  #reloj;
  /** @type {Map<number, Pedido>} pedidos sin respuesta (incluye lápidas) */
  #pedidos = new Map();
  /** @type {Map<string, Pedido[]>} */
  #colas = new Map();
  #sigId = 0;
  /** llegó el 'ready' */
  #listo = false;
  /** @type {ErrorConexion | null} conexión muerta: todo pedido nuevo se rechaza */
  #muerta = null;
  #selSeq = 0;

  /**
   * @param {object} o
   * @param {WorkerLike} o.worker
   * @param {string} o.base     URL absoluta de la carpeta del wasm (C10)
   * @param {string} o.v        id de build (C4)
   * @param {(cb: () => void) => void} [o.programar]  por defecto requestAnimationFrame
   * @param {() => number} [o.ahora]
   * @param {Reloj} [o.reloj]  por defecto setTimeout/clearTimeout
   */
  constructor({ worker, base, v, programar, ahora, reloj }) {
    this.#w = worker;
    this.#programar =
      programar ??
      (typeof requestAnimationFrame === 'function'
        ? (cb) => requestAnimationFrame(() => cb())
        : (cb) => setTimeout(cb, 16));
    this.#ahora = ahora ?? (() => performance.now());
    this.#reloj = reloj ?? {
      poner: (fn, ms) => setTimeout(fn, ms),
      quitar: (h) => clearTimeout(h),
    };
    worker.onmessage = (e) => this.#recibir(e.data);
    worker.onerror = (e) => this.#alFallar(e);
    this.enviar({ t: 'init', base, v });
  }

  /**
   * Suscribe a un tipo de mensaje del worker ('frame' recibe un EventoFrame;
   * '*' recibe todos los mensajes crudos salvo los frames). Devuelve la baja.
   * @param {string} tipo
   * @param {(msg: any) => void} cb
   * @returns {() => void}
   */
  on(tipo, cb) {
    let set = this.#oyentes.get(tipo);
    if (!set) {
      set = new Set();
      this.#oyentes.set(tipo, set);
    }
    set.add(cb);
    return () => set.delete(cb);
  }

  /**
   * Quién dibuja cada frame (un solo mundo a la vez). null = nadie.
   * @param {Dibujante | null} fn
   */
  ponerDibujante(fn) {
    this.#dibujante = fn;
  }

  /**
   * Quita el dibujante solo si sigue siendo `fn` (otro mundo pudo haberse
   * registrado después: al desmontarse el viejo no lo pisa).
   * @param {Dibujante} fn
   */
  quitarDibujante(fn) {
    if (this.#dibujante === fn) this.#dibujante = null;
  }

  /**
   * Mensaje crudo al worker.
   * @param {any} msg
   * @param {Transferable[]} [transfer]
   */
  enviar(msg, transfer) {
    if (transfer) this.#w.postMessage(msg, transfer);
    else this.#w.postMessage(msg);
  }

  /** Número de la última selección pedida. */
  get selSeq() {
    return this.#selSeq;
  }

  // ---- Protocolo --------------------------------------------------------------

  /**
   * Sim nueva + siembra inicial. Los indicadores opcionales de la nueva
   * (engine/worker.js) viajan solo si vienen: `limpio` (C15: no arrastra
   * nada de la sim anterior) y `semillaColores` (C15: colores de las formas
   * sembrados).
   * @param {{ seed: number, options: any, species: EspecieSiembra[], quietF1?: boolean,
   *   limpio?: boolean, semillaColores?: number }} o
   */
  reset(o) {
    /** @type {Record<string, any>} */
    const m = {
      t: 'reset',
      seed: o.seed,
      options: o.options,
      species: o.species,
      quietF1: !!o.quietF1,
    };
    if (o.limpio) m.limpio = true;
    if (o.semillaColores !== undefined) m.semillaColores = o.semillaColores;
    this.enviar(m);
  }
  /** @param {boolean} corriendo */
  run(corriendo) {
    this.enviar({ t: 'run', running: !!corriendo });
  }
  /** @param {number} n ticks por frame; 0 = máxima */
  speed(n) {
    this.enviar({ t: 'speed', n: n | 0 });
  }
  step() {
    this.enviar({ t: 'step' });
  }
  /**
   * Bot con foco (0 = ninguno). Lleva un número de secuencia: un frame armado
   * antes de que el worker la reciba trae el número viejo.
   * @param {number} n
   */
  select(n) {
    this.enviar({ t: 'select', n: n | 0, seq: ++this.#selSeq });
  }
  /** @param {EspecieSiembra} sp */
  seedSpecies(sp) {
    this.enviar({ t: 'seed-species', sp });
  }
  /** @param {{ name: string, dna: string }[]} entries */
  dnaLib(entries) {
    this.enviar({ t: 'dna-lib', entries });
  }
  /** @param {number} id @param {number} v @param {boolean} [nocap] */
  setopt(id, v, nocap) {
    this.enviar({ t: 'setopt', id, v, ...(nocap ? { nocap: true } : {}) });
  }
  /**
   * C12: opciones 'base' en vivo ({minVegs?, maxPopulation?, repopAmount?,
   * repopCooldown?, maxEnergy?, startChlr?, mutations?}; el tamaño del
   * campo no es vivo y el worker lo ignora).
   * @param {Record<string, number | boolean>} vals @param {boolean} [nocap]
   */
  setbase(vals, nocap) {
    this.enviar({ t: 'setbase', vals: { ...vals }, ...(nocap ? { nocap: true } : {}) });
  }
  /** @param {number} i @param {number} v @param {boolean} [nocap] */
  setcost(i, v, nocap) {
    this.enviar({ t: 'setcost', i, v, ...(nocap ? { nocap: true } : {}) });
  }
  /**
   * `.dbsim` de la sim actual. Se rechaza (ErrorConexion) si vence, si el
   * worker falla o si no hay nada que guardar.
   * @returns {Promise<Uint8Array>}
   */
  save() {
    return this.saveConCiclo().then((r) => r.bytes);
  }
  /**
   * Como save(), con el ciclo de la sim en el momento de guardar.
   * @returns {Promise<{ bytes: Uint8Array, cycle: number }>}
   */
  saveConCiclo() {
    const p = this.#pedir('save', 'save', { t: 'save' }, TIEMPOS.save, true);
    this.#valla();
    return p;
  }
  /**
   * Ciclo de la sim en este punto de la cola del worker ({t:'ciclo'}; -1
   * sin sim).
   * @returns {Promise<number>}
   */
  ciclo() {
    return this.#pedir('ciclo', 'ciclo', { t: 'ciclo' }, TIEMPOS.ciclo, true);
  }
  /**
   * Manda `mensajes` en un ciclo exacto y lo devuelve (decisión 13: el
   * cambio en caliente queda registrado en el ciclo en que se aplicó y las
   * réplicas lo repiten ahí). Si la sim corre (`reanudar` dado), la pausa,
   * pide el ciclo, manda los mensajes (el worker los atiende en orden y en
   * pausa no hay ticks entre ellos) y, cuando vuelve el ciclo, la reanuda si
   * `reanudar()` sigue diciendo que sí (el usuario pudo pausar mientras).
   * @param {any[]} mensajes
   * @param {() => boolean} [reanudar]  solo si la sim estaba corriendo
   * @returns {Promise<number>}
   */
  async aplicarEnCiclo(mensajes, reanudar) {
    if (reanudar) this.run(false);
    const p = this.ciclo();
    for (const m of mensajes) this.enviar(m);
    try {
      return await p;
    } finally {
      // Después de la respuesta: el loop de la pausa ya terminó (sin dos
      // loops a la vez al reanudar).
      if (reanudar?.()) this.run(true);
    }
  }
  /**
   * Valor de una opción por id (tabla de ids en wasm/dbcore_api.cpp).
   * @param {number} id
   * @returns {Promise<number>}
   */
  getopt(id) {
    const p = this.#pedirOpt(id);
    this.#valla();
    return p;
  }
  /**
   * Varias opciones con una sola valla. Las que no se pudieron leer faltan
   * en el resultado.
   * @param {number[]} ids
   * @returns {Promise<Record<number, number>>}
   */
  async getopts(ids) {
    const ps = ids.map((id) => this.#pedirOpt(id));
    this.#valla();
    const rs = await Promise.allSettled(ps);
    /** @type {Record<number, number>} */
    const out = {};
    rs.forEach((r, i) => {
      if (r.status === 'fulfilled') out[ids[i]] = r.value;
    });
    return out;
  }
  /**
   * Carga un `.dbsim` (se copia y se transfiere).
   * @param {Uint8Array | ArrayBuffer} bytes
   */
  load(bytes) {
    const copia = (bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).slice();
    this.enviar({ t: 'load', bytes: copia.buffer }, [copia.buffer]);
  }
  /**
   * Como load(), con respuesta: lo que quedó cargado ({t:'loaded'} de
   * engine/worker.js). Un archivo que no es un .dbsim deja una sim vacía en
   * el ciclo 0 (bots 0). `missing`: especies sin ADN (también llega el
   * dna-missing de siempre, antes).
   * @param {Uint8Array | ArrayBuffer} bytes
   * @returns {Promise<{ cycle: number, bots: number, missing: string[] }>}
   */
  cargarConRespuesta(bytes) {
    const copia = (bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes).slice();
    return this.#pedir('load', 'load', { t: 'load', bytes: copia.buffer }, TIEMPOS.load, true, [
      copia.buffer,
    ]);
  }
  /** @param {boolean} rica */
  view(rica) {
    this.enviar({ t: 'view', rich: !!rica });
  }
  /** @param {number} n bot de referencia de la distancia genética (0 = apagada) */
  gendist(n) {
    this.enviar({ t: 'gendist', n: n | 0 });
  }
  /**
   * ADN del bot n (texto vacío si ya no existe).
   * @param {number} n
   * @returns {Promise<string>}
   */
  botText(n) {
    const k = n | 0;
    return this.#pedir('bot-text', `bot-text:${k}`, { t: 'bot-text', n: k }, TIEMPOS.botText, true);
  }
  /** @param {number} n @param {number} [maxrec] @param {boolean} [lineas] */
  family(n, maxrec = 0, lineas = true) {
    this.enviar({ t: 'family', n: n | 0, maxrec: maxrec | 0, lines: !!lineas });
  }
  clearHighlight() {
    this.enviar({ t: 'clear-highlight' });
  }
  /** @param {number} n @param {boolean} on */
  console(n, on) {
    this.enviar({ t: 'console', n: n | 0, on: !!on });
  }
  /** @param {number} n @param {string} linea */
  consoleCmd(n, linea) {
    this.enviar({ t: 'console-cmd', n: n | 0, line: String(linea) });
  }
  /** @param {number} n */
  genes(n) {
    this.enviar({ t: 'genes', n: n | 0 });
  }
  findbest() {
    this.enviar({ t: 'findbest' });
  }
  f1start() {
    this.enviar({ t: 'f1start' });
  }
  /** @param {boolean} on panel del bot abierto (ActivForm): el worker junta su actividad */
  activ(on) {
    this.enviar({ t: 'activ', on: !!on });
  }
  /** Ojos del bot n → {t:'eye-vals', n, dir[9], wth[9]}. @param {number} n */
  eyeRead(n) {
    this.enviar({ t: 'eye-read', n: n | 0 });
  }
  // ---- Herramientas de veterano (N4.1) ---------------------------------------

  /**
   * Player Bot Mode encendido o apagado (sobre el bot con foco). Con
   * `seguirFoco` (indicador opcional de la nueva, engine/worker.js), si
   * muere el bot controlado el foco pasa al que el motor elige y llega
   * {t:'pb-focus', n, prev}; sin él, el foco se suelta como en la clásica.
   * @param {boolean} on @param {boolean} [seguirFoco]
   */
  pb(on, seguirFoco = false) {
    /** @type {Record<string, any>} */
    const m = { t: 'pb', on: !!on };
    if (on && seguirFoco) m.seguirFoco = true;
    this.enviar(m);
  }
  /** Puntero en coordenadas de mundo; (0, 0) = sin puntero. @param {number} x @param {number} y */
  pbMouse(x, y) {
    this.enviar({ t: 'pb-mouse', x: +x || 0, y: +y || 0 });
  }
  /** @param {{ memloc: number, value: number, invert: boolean }[]} keys */
  pbKeys(keys) {
    this.enviar({
      t: 'pb-keys',
      keys: keys.map((k) => ({ memloc: k.memloc | 0, value: k.value | 0, invert: !!k.invert })),
    });
  }
  /** @param {number} idx @param {boolean} active */
  pbKey(idx, active) {
    this.enviar({ t: 'pb-key', idx: idx | 0, active: !!active });
  }
  /** Escribe rob(n).mem(addr) = v. @param {number} n @param {number} addr @param {number} v */
  setmem(n, addr, v) {
    this.enviar({ t: 'setmem', n: n | 0, addr: addr | 0, v: v | 0 });
  }
  /**
   * Instantánea de los vivos: el texto .snp y, con `withMut`, el de
   * mutaciones ('' sin ellas). Sin correlación: FIFO.
   * @param {boolean} withMut
   * @returns {Promise<{ records: number, snp: string, mut: string }>}
   */
  snapshot(withMut) {
    return this.#pedir(
      'snapshot',
      'snapshot',
      { t: 'snapshot', withMut: !!withMut },
      TIEMPOS.snapshot,
      false,
    );
  }
  /**
   * Registro de muertos acumulado (`drain`: lo entregado se va del registro).
   * @param {boolean} [drain]
   * @returns {Promise<{ records: number, snp: string, mut: string }>}
   */
  deadTake(drain = false) {
    return this.#pedir('dead', 'dead', { t: 'dead-take', drain: !!drain }, TIEMPOS.dead, false);
  }
  /** Borra el registro de muertos. */
  deadReset() {
    this.enviar({ t: 'dead-reset' });
  }

  /** @param {boolean} on */
  skins(on) {
    this.enviar({ t: 'skins', on: !!on });
  }
  /**
   * Frame fresco sin tick (cámara o efectos con la sim en pausa). Nunca más
   * de uno pedido a la vez.
   */
  redraw() {
    if (this.#redibujoPedido) return;
    this.#redibujoPedido = true;
    this.enviar({ t: 'redraw' });
  }
  terminar() {
    this.#morir(new ErrorConexion('terminada'));
    this.#w.terminate?.();
  }

  // ---- Pedidos con respuesta ------------------------------------------------

  /**
   * @param {Pedido['tipo']} tipo @param {string} k @param {any} msg
   * @param {number} ms @param {boolean} conId  el mensaje lleva `id` de correlación
   * @param {Transferable[]} [transfer]
   * @returns {Promise<any>}
   */
  #pedir(tipo, k, msg, ms, conId, transfer) {
    if (this.#muerta) return Promise.reject(this.#muerta);
    const id = ++this.#sigId;
    return new Promise((resolver, rechazar) => {
      /** @type {Pedido} */
      const p = { id, tipo, k, vivo: true, resolver, rechazar, timer: null };
      p.timer = this.#reloj.poner(() => this.#descartar(p, new ErrorConexion('tiempo')), ms);
      this.#pedidos.set(id, p);
      const cola = this.#colas.get(k);
      if (cola) cola.push(p);
      else this.#colas.set(k, [p]);
      this.enviar(conId ? { ...msg, id } : msg, transfer);
    });
  }

  /** @param {number} id */
  #pedirOpt(id) {
    const k = id | 0;
    // Sin correlación: el `id` del getopt es el de la opción.
    return this.#pedir('opt', `opt:${k}`, { t: 'getopt', id: k }, TIEMPOS.getopt, false);
  }

  /** Valla tras un save/getopt (ver la cabecera). */
  #valla() {
    if (this.#muerta) return;
    this.#pedir('valla', 'bot-text:0', { t: 'bot-text', n: 0 }, TIEMPOS.save, true).catch(() => {});
  }

  /**
   * Rechaza el pedido y lo deja como lápida en su cola.
   * @param {Pedido} p @param {Error} e
   */
  #descartar(p, e) {
    if (!p.vivo) return;
    p.vivo = false;
    this.#reloj.quitar(p.timer);
    p.rechazar(e);
  }

  /** @param {Pedido} p */
  #quitar(p) {
    this.#pedidos.delete(p.id);
    this.#reloj.quitar(p.timer);
    const cola = this.#colas.get(p.k);
    if (!cola) return;
    const i = cola.indexOf(p);
    if (i >= 0) cola.splice(i, 1);
    if (!cola.length) this.#colas.delete(p.k);
  }

  /**
   * Busca el pedido de una respuesta: por id si la trae, si no el primero de
   * su cola. Devuelve null si no hay (respuesta tardía o ajena).
   * @param {string} k @param {any} msg @param {boolean} porId
   * @returns {Pedido | null}
   */
  #emparejar(k, msg, porId) {
    let p;
    if (porId && msg.id !== undefined && msg.id !== null) {
      p = this.#pedidos.get(Number(msg.id));
      if (p && p.k !== k) p = undefined;
    } else {
      p = this.#colas.get(k)?.[0];
    }
    if (!p) return null;
    this.#quitar(p);
    if (p.tipo === 'valla') this.#cerrarValla(p);
    return p;
  }

  /**
   * Volvió la valla: los save/getopt anteriores ya no van a contestar.
   * @param {Pedido} valla
   */
  #cerrarValla(valla) {
    for (const p of [...this.#pedidos.values()]) {
      if (p.id > valla.id || (p.tipo !== 'save' && p.tipo !== 'opt')) continue;
      this.#quitar(p);
      this.#descartar(p, new ErrorConexion('sin-respuesta'));
    }
  }

  /**
   * Error del worker (worker.onerror). Antes del 'ready' es un fallo de carga
   * (el script del worker no arrancó): la conexión muere. Después, es una
   * excepción de la sim: los pedidos en vuelo se rechazan (sus respuestas
   * tardías se descartan) y se avisa con {t:'worker-error', msg}.
   * @param {any} e
   */
  #alFallar(e) {
    const msg = String(e?.message || 'worker error');
    if (!this.#listo) {
      this.#morir(new ErrorConexion('carga', msg));
      this.#emitir({ t: 'error', clave: 'carga', params: {}, msg });
      return;
    }
    const err = new ErrorConexion('worker', msg);
    for (const p of [...this.#pedidos.values()]) {
      // snapshot y dead-take van en orden y sin id: el que falló no va a
      // contestar, y su lápida se comería la respuesta del pedido siguiente.
      if (p.tipo === 'snapshot' || p.tipo === 'dead') this.#quitar(p);
      this.#descartar(p, err);
    }
    this.#emitir({ t: 'worker-error', msg });
  }

  /** @param {ErrorConexion} e */
  #morir(e) {
    if (!this.#muerta) this.#muerta = e;
    for (const p of [...this.#pedidos.values()]) {
      this.#quitar(p);
      this.#descartar(p, e);
    }
  }

  // ---- Recepción ------------------------------------------------------------

  /** @param {any} msg */
  #recibir(msg) {
    if (!msg || typeof msg.t !== 'string') return;
    switch (msg.t) {
      case 'frame':
        this.#redibujoPedido = false;
        if (this.#pendiente)
          this.enviar({ t: 'ack', buf: this.#pendiente.buf }, [this.#pendiente.buf]);
        this.#pendiente = { buf: msg.buf, stats: msg.stats };
        if (!this.#agendado) {
          this.#agendado = true;
          this.#programar(() => this.#procesarFrame());
        }
        return;
      case 'ready':
        this.#listo = true;
        break;
      case 'error':
        // Fallo de carga (engine/worker.js): el worker queda inutilizable.
        this.#morir(new ErrorConexion('carga', String(msg.msg ?? msg.clave ?? '')));
        break;
      case 'saved': {
        const p = this.#emparejar('save', msg, true);
        if (p?.vivo)
          p.resolver({ bytes: new Uint8Array(msg.bytes), cycle: Number(msg.cycle) || 0 });
        break;
      }
      case 'save-error': {
        const p = this.#emparejar('save', msg, true);
        if (p) this.#descartar(p, new ErrorConexion(String(msg.clave || 'save-empty')));
        break;
      }
      case 'bot-text': {
        const p = this.#emparejar(`bot-text:${msg.n | 0}`, msg, true);
        if (p?.tipo === 'valla') return; // interna: no se avisa
        if (p?.vivo) p.resolver(String(msg.text ?? ''));
        break;
      }
      case 'opt': {
        const p = this.#emparejar(`opt:${msg.id | 0}`, msg, false);
        if (p?.vivo) p.resolver(Number(msg.v));
        break;
      }
      case 'ciclo': {
        const p = this.#emparejar('ciclo', msg, true);
        if (p?.vivo) p.resolver(Number(msg.cycle));
        break;
      }
      case 'snapshot-done':
      case 'dead-data': {
        const p = this.#emparejar(msg.t === 'dead-data' ? 'dead' : 'snapshot', msg, false);
        if (p?.vivo)
          p.resolver({
            records: Number(msg.records) || 0,
            snp: String(msg.snp ?? ''),
            mut: String(msg.mut ?? ''),
          });
        break;
      }
      case 'loaded': {
        const p = this.#emparejar('load', msg, true);
        if (p?.vivo)
          p.resolver({
            cycle: Number(msg.cycle) || 0,
            bots: Number(msg.bots) || 0,
            missing: Array.isArray(msg.missing) ? msg.missing.map(String) : [],
          });
        break;
      }
    }
    this.#emitir(msg);
  }

  /** @param {any} msg */
  #emitir(msg) {
    for (const cb of this.#oyentes.get(msg.t) ?? []) cb(msg);
    for (const cb of this.#oyentes.get('*') ?? []) cb(msg);
  }

  #procesarFrame() {
    this.#agendado = false;
    const p = this.#pendiente;
    this.#pendiente = null;
    if (!p) return;
    try {
      const frame = decodificarFrame(new Float32Array(p.buf));
      const stats = p.stats ?? { cycle: frame.ciclo, bots: frame.nBots, vegs: 0, tps: 0 };
      const t0 = this.#ahora();
      this.#dibujante?.(frame, stats);
      const drawMs = this.#ahora() - t0;
      const seqVigente = stats.selSeq === undefined || stats.selSeq === this.#selSeq;
      /** @type {EventoFrame} */
      const ev = { frame, stats, seqVigente, drawMs };
      for (const cb of this.#oyentes.get('frame') ?? []) cb(ev);
    } finally {
      // ping-pong: el búfer vuelve al worker pase lo que pase
      this.enviar({ t: 'ack', buf: p.buf }, [p.buf]);
    }
  }
}
