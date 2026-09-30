// @ts-check
// Internet Mode en la interfaz (paso N3.9, decisión 16 de PLAN.md): el
// estado del cliente IM de la sesión, sin runes ni DOM (estado.svelte.js lo
// envuelve en runes; el test lo corre en node contra engine/worker.js real).
//
// Escucha, por la conexión de la sesión (ConexionSim.on):
//   im-state  {st}   estado del cliente (pares, censos, InternetSpecies,
//                    colas); a lo sumo 4 por segundo
//   im-log    {lines} salidas/llegadas en tandas (texto del worker, en inglés:
//                    se interpreta acá y se muestra con t())
//   im-off           Internet Mode quedó apagado
//   log       {msg}  solo las líneas de Internet Mode: el motivo de un
//                    apagado (sim nueva) o de un encendido fallido
//   frame            el ciclo, para fechar las entradas del registro
// y manda {t:'im', on, name, kind, url, room} e {t:'im-name', name}.
//
// Transiciones (port/README.md §Internet Mode): una sim nueva lo APAGA
// (motivo 'simNueva'); una ronda nueva lo conserva; cargar una sim borra el
// puerto y queda encendido SIN puerto (`sinPuerto`) hasta reconectar.

/** Entradas que guarda el registro (la más nueva primero). */
export const MAX_REGISTRO = 100;

/**
 * @typedef {'apagado' | 'conectando' | 'conectado' | 'pestanas' | 'sinRelay' | 'error'} Enlace
 * @typedef {{ bot: string, n: number, vegetal: boolean }} Poblacion
 * @typedef {{ id: string, nombre: string, sim: string, vivo: boolean,
 *   ciclo: number | null, poblacion: Poblacion[] }} Par
 * @typedef {{ nombre: string, color: number, vegetal: boolean, n: number }} EspecieInternet
 * @typedef {{ hora: number, ciclo: number, tipo: string, params: Record<string, string | number> }} EntradaRegistro
 * @typedef {{ clave: string, params: Record<string, string | number> }} ErrorIM
 * @typedef {{ apodo: string, tipo: 'bc' | 'ws', url: string, sala: string }} ConfigIM
 */

/**
 * @typedef {object} EstadoIM
 * @property {boolean} activo      Internet Mode encendido en el worker
 * @property {boolean} pedido      se pidió conectar y todavía no contestó
 * @property {Enlace} enlace       estado del transporte
 * @property {string} detalle      texto técnico del error de transporte
 * @property {string} nombre       apodo con el que viaja (el «Newbie N» sorteado)
 * @property {'bc' | 'ws'} tipo
 * @property {string} url
 * @property {string} sala
 * @property {number} puerto       teleporter Internet (0 = sin puerto)
 * @property {boolean} sinPuerto   encendido pero sin puerto (tras cargar una sim)
 * @property {Par[]} pares
 * @property {number} paresVivos
 * @property {EspecieInternet[]} especies  InternetSpecies (las de los pares)
 * @property {{ esperan: number, enCamino: number, bandeja: number }} colas
 * @property {{ salieron: number, llegaron: number, enviados: number, confirmados: number,
 *   recibidos: number, reenviados: number, descartados: number }} totales
 * @property {ErrorIM | null} error          el último encendido falló
 * @property {'' | 'usuario' | 'simNueva' | 'externo'} apagadoPor
 * @property {EntradaRegistro[]} registro   la más nueva primero
 */

/** @returns {EstadoIM} */
export function estadoInicialIM() {
  return {
    activo: false,
    pedido: false,
    enlace: 'apagado',
    detalle: '',
    nombre: '',
    tipo: 'bc',
    url: '',
    sala: '',
    puerto: 0,
    sinPuerto: false,
    pares: [],
    paresVivos: 0,
    especies: [],
    colas: { esperan: 0, enCamino: 0, bandeja: 0 },
    totales: {
      salieron: 0,
      llegaron: 0,
      enviados: 0,
      confirmados: 0,
      recibidos: 0,
      reenviados: 0,
      descartados: 0,
    },
    error: null,
    apagadoPor: '',
    registro: [],
  };
}

/**
 * Estado del transporte a partir del texto de engine/imnet.js.
 * @param {unknown} status
 * @returns {{ enlace: Enlace, detalle: string }}
 */
export function enlaceDe(status) {
  const s = String(status ?? '');
  if (s === 'off' || s === '') return { enlace: 'apagado', detalle: '' };
  if (s === 'connected') return { enlace: 'conectado', detalle: '' };
  if (s === 'connected (tabs)') return { enlace: 'pestanas', detalle: '' };
  if (s.startsWith('connecting')) return { enlace: 'conectando', detalle: '' };
  if (s.startsWith('no relay')) return { enlace: 'sinRelay', detalle: '' };
  if (s.startsWith('error')) return { enlace: 'error', detalle: s.replace(/^error:\s*/, '') };
  return { enlace: 'error', detalle: s };
}

/**
 * Nombre del organismo de una etiqueta del worker («Bot.txt (3 cells)»).
 * @param {string} s
 * @returns {{ bot: string, celulas: number }}
 */
function organismo(s) {
  const m = /^(.*) \((\d+) cells\)$/.exec(s);
  return m ? { bot: m[1], celulas: Number(m[2]) } : { bot: s, celulas: 1 };
}

/**
 * Una línea de im-log → entrada estructurada (el texto sale de
 * `internet.registro.<tipo>`; nombres de bots y apodos van sin traducir).
 * @param {string} linea
 * @returns {{ tipo: string, params: Record<string, string | number> }}
 */
export function interpretarLinea(linea) {
  const s = String(linea);
  let m = /^peer connected: (.+)$/.exec(s);
  if (m) return { tipo: 'parEntra', params: { nombre: m[1] } };
  m = /^peer disconnected: (.+?)(?: \((no heartbeat|no connection)\))?$/.exec(s);
  if (m) {
    const motivo = m[2] === 'no heartbeat' ? 'latido' : m[2] === 'no connection' ? 'conexion' : '';
    return { tipo: motivo ? `parSale.${motivo}` : 'parSale', params: { nombre: m[1] } };
  }
  m = /^arrived (.+) from (.*)$/.exec(s);
  if (m) {
    const o = organismo(m[1]);
    return {
      tipo: o.celulas > 1 ? 'llegadaMulti' : 'llegada',
      params: { bot: o.bot, celulas: o.celulas, desde: m[2] },
    };
  }
  m = /^sent (.+) → (.*)$/.exec(s);
  if (m) {
    const o = organismo(m[1]);
    return {
      tipo: o.celulas > 1 ? 'salidaMulti' : 'salida',
      params: { bot: o.bot, celulas: o.celulas, a: m[2] },
    };
  }
  m = /^… \((\d+) more\)$/.exec(s);
  if (m) return { tipo: 'mas', params: { n: Number(m[1]) } };
  return { tipo: 'otro', params: { texto: s } };
}

/**
 * Una línea de `log` del worker que importa a Internet Mode (o null).
 * @param {string} msg
 * @returns {{ error?: ErrorIM, apagado?: 'simNueva' | 'reconexion' | 'otro', sinPuerto?: boolean } | null}
 */
export function interpretarLog(msg) {
  const s = String(msg);
  let m = /^Internet: cannot be enabled with restart mode (\d+)/.exec(s);
  if (m) return { error: { clave: 'modoReinicio', params: { modo: Number(m[1]) } } };
  if (/^Internet: teleporter cap/.test(s))
    return { error: { clave: 'topeTeleporters', params: {} } };
  m = /^Internet Mode off(?: — ([^(;]+))?/.exec(s);
  if (m) {
    const why = (m[1] ?? '').trim();
    return {
      apagado: why === 'new sim' ? 'simNueva' : why === 'reconnection' ? 'reconexion' : 'otro',
    };
  }
  if (/^Internet Mode still connected without a port/.test(s)) return { sinPuerto: true };
  return null;
}

/**
 * Los pares del estado del worker.
 * @param {any[]} peers
 * @returns {Par[]}
 */
function paresDe(peers) {
  if (!Array.isArray(peers)) return [];
  return peers.map((p) => ({
    id: String(p.id ?? ''),
    nombre: String(p.name || p.id || ''),
    sim: String(p.simId ?? ''),
    vivo: !!p.alive,
    ciclo: p.census ? Number(p.census.cycle) || 0 : null,
    poblacion: (Array.isArray(p.census?.pop) ? p.census.pop : [])
      .map((/** @type {any} */ x) => ({
        bot: String(x.botName ?? ''),
        n: Number(x.count) || 0,
        vegetal: !!x.repopulating,
      }))
      .sort((/** @type {Poblacion} */ a, /** @type {Poblacion} */ b) => b.n - a.n),
  }));
}

/**
 * @typedef {object} ConexionLike
 * @property {(tipo: string, cb: (msg: any) => void) => () => void} on
 * @property {(msg: any) => void} enviar
 */

export class NucleoIM {
  /** @type {EstadoIM} */
  estado = estadoInicialIM();

  /** @type {ConexionLike} */
  #c;
  /** @type {(e: EstadoIM) => void} */
  #publicar;
  /** @type {() => number} */
  #ahora;
  /** ciclo del último frame */
  #ciclo = -1;
  /** se pidió apagar (el im-off que llegue es del usuario) */
  #apagarPedido = false;
  /** motivo del próximo im-off, leído del log del worker */
  /** @type {'' | 'simNueva' | 'reconexion' | 'otro'} */
  #motivo = '';
  /** @type {ErrorIM | null} error del encendido en curso, leído del log */
  #errorPendiente = null;
  /** el próximo estado encendido se anota como activación (también al reconectar) */
  #anunciar = false;
  /** @type {Array<() => void>} */
  #bajas = [];

  /**
   * @param {ConexionLike} conexion
   * @param {{ publicar?: (e: EstadoIM) => void, ahora?: () => number }} [o]
   */
  constructor(conexion, o = {}) {
    this.#c = conexion;
    this.#publicar = o.publicar ?? (() => {});
    this.#ahora = o.ahora ?? (() => Date.now());
    this.#bajas.push(
      conexion.on('im-state', (m) => this.#alEstado(m.st)),
      conexion.on('im-log', (m) => this.#alLog(Array.isArray(m.lines) ? m.lines : [])),
      conexion.on('im-off', () => this.#alApagar()),
      conexion.on('log', (m) => this.#alLogWorker(String(m.msg ?? ''))),
      conexion.on('frame', (ev) => {
        const c = Number(ev?.stats?.cycle);
        if (Number.isFinite(c)) this.#ciclo = c;
      }),
    );
  }

  /** Deja de escuchar la conexión. */
  cerrar() {
    for (const b of this.#bajas) b();
    this.#bajas = [];
  }

  /**
   * Enciende Internet Mode (o reconecta con otra configuración). La
   * configuración ya viene validada (tarjeta.js). Apodo vacío = la sim
   * sortea «Newbie N».
   * @param {ConfigIM} cfg
   */
  conectar(cfg) {
    this.#apagarPedido = false;
    this.#errorPendiente = null;
    this.#motivo = '';
    this.#anunciar = true;
    this.#cambiar({ pedido: true, error: null, apagadoPor: '' });
    this.#c.enviar({
      t: 'im',
      on: true,
      name: cfg.apodo,
      kind: cfg.tipo,
      url: cfg.tipo === 'ws' ? cfg.url : '',
      room: cfg.sala || 'public',
    });
  }

  /** Apaga Internet Mode. */
  desconectar() {
    if (!this.estado.activo && !this.estado.pedido) return;
    this.#apagarPedido = true;
    this.#c.enviar({ t: 'im', on: false });
  }

  /**
   * Cambia el apodo en vivo (viaja como dueño de lo que sale desde ahora).
   * @param {string} apodo
   */
  ponerApodo(apodo) {
    this.#c.enviar({ t: 'im-name', name: apodo });
  }

  // ---- Recepción --------------------------------------------------------------

  /** @param {Partial<EstadoIM>} cambios */
  #cambiar(cambios) {
    this.estado = { ...this.estado, ...cambios };
    this.#publicar(this.estado);
  }

  /**
   * @param {string} tipo
   * @param {Record<string, string | number>} [params]
   * @returns {EntradaRegistro}
   */
  #entrada(tipo, params = {}) {
    return { hora: this.#ahora(), ciclo: this.#ciclo, tipo, params };
  }

  /** @param {EntradaRegistro[]} nuevas (en orden de llegada) */
  #anotar(nuevas) {
    if (!nuevas.length) return;
    this.#cambiar({
      registro: [...[...nuevas].reverse(), ...this.estado.registro].slice(0, MAX_REGISTRO),
    });
  }

  /** @param {any} st */
  #alEstado(st) {
    if (!st || typeof st !== 'object') return;
    // El im-state que sigue a un apagado llega después del im-off (el worker
    // lo manda en diferido): el apagado ya se atendió ahí.
    if (!st.enabled) return;
    const era = this.estado.activo && !this.#anunciar;
    this.#anunciar = false;
    const eraSinPuerto = this.estado.sinPuerto;
    const { enlace, detalle } = enlaceDe(st.status);
    const pares = paresDe(st.peers);
    const puerto = Number(st.port) || 0;
    const c = st.counters ?? {};
    this.#errorPendiente = null;
    this.#cambiar({
      activo: true,
      pedido: false,
      enlace,
      detalle,
      nombre: String(st.name ?? ''),
      tipo: st.kind === 'ws' ? 'ws' : 'bc',
      url: String(st.url ?? ''),
      sala: String(st.room ?? ''),
      puerto,
      sinPuerto: puerto === 0,
      pares,
      paresVivos: pares.filter((p) => p.vivo).length,
      especies: (Array.isArray(st.internetSpecies) ? st.internetSpecies : []).map(
        (/** @type {any} */ x) => ({
          nombre: String(x.name ?? ''),
          color: Number(x.color) | 0,
          vegetal: !!x.veg,
          n: Number(x.pop) || 0,
        }),
      ),
      colas: {
        esperan: Number(st.pending) || 0,
        enCamino: Number(st.inflight) || 0,
        bandeja: Number(st.inbox) || 0,
      },
      totales: {
        salieron: Number(st.outTotal) || 0,
        llegaron: Number(st.inTotal) || 0,
        enviados: Number(c.sent) || 0,
        confirmados: Number(c.acked) || 0,
        recibidos: Number(c.recv) || 0,
        reenviados: Number(c.resent) || 0,
        descartados: Number(c.dropped) || 0,
      },
      error: null,
      apagadoPor: '',
    });
    if (!era) {
      this.#anotar([
        this.#entrada(this.estado.tipo === 'ws' ? 'activadoRelay' : 'activadoPestanas', {
          nombre: this.estado.nombre,
          sala: this.estado.sala,
        }),
      ]);
    } else if (this.estado.sinPuerto && !eraSinPuerto) {
      this.#anotar([this.#entrada('sinPuerto')]);
    }
  }

  /** @returns {Partial<EstadoIM>} */
  #apagadoBase() {
    const e = estadoInicialIM();
    return {
      activo: false,
      pedido: false,
      enlace: e.enlace,
      detalle: '',
      puerto: 0,
      sinPuerto: false,
      pares: [],
      paresVivos: 0,
      especies: [],
      colas: e.colas,
    };
  }

  #alApagar() {
    const motivo = this.#motivo;
    this.#motivo = '';
    // Reconectar con otra configuración: apaga y enciende en el mismo mensaje.
    if (motivo === 'reconexion') return;
    const estaba = this.estado.activo;
    if (this.estado.pedido && (!estaba || this.#errorPendiente)) {
      // El encendido falló (sin sim, modo de reinicio, tope de teleporters).
      const error = this.#errorPendiente ?? { clave: 'noSeActivo', params: {} };
      this.#errorPendiente = null;
      this.#cambiar({ ...this.#apagadoBase(), error, apagadoPor: '' });
      this.#anotar([this.#entrada('fallo', { clave: error.clave })]);
      return;
    }
    if (!estaba) return;
    /** @type {EstadoIM['apagadoPor']} */
    const por = this.#apagarPedido ? 'usuario' : motivo === 'simNueva' ? 'simNueva' : 'externo';
    this.#apagarPedido = false;
    this.#cambiar({ ...this.#apagadoBase(), apagadoPor: por });
    this.#anotar([this.#entrada(`desactivado.${por}`)]);
  }

  /** @param {string[]} lineas */
  #alLog(lineas) {
    this.#anotar(
      lineas.map((l) => {
        const { tipo, params } = interpretarLinea(l);
        return this.#entrada(tipo, params);
      }),
    );
  }

  /** @param {string} msg */
  #alLogWorker(msg) {
    const r = interpretarLog(msg);
    if (!r) return;
    if (r.error) this.#errorPendiente = r.error;
    if (r.apagado) this.#motivo = r.apagado;
  }
}
