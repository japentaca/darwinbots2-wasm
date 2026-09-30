// @ts-check
// Sesión de sim de la interfaz: UN objeto de estado (runes) que vive lo que
// vive la página (no se pierde al cambiar de pestaña). Crea el worker de
// engine/worker.js, le manda el init (C3, C10: base absoluta del wasm; C4:
// v = BUILD_ID) y expone el estado vivo y los métodos del protocolo.
// Decisión 5: las skins y el monitor RGB no se piden (skins apagadas).

import { PARAMETROS } from '../../../engine/opciones.js';
import { BUILD_ID } from '../../build.js';
import { ConexionSim } from './conexion.js';
import { focoVivo } from './frame.js';

/** Velocidades de la barra: ticks por frame (0 = máxima). */
export const VELOCIDADES = Object.freeze([1, 10, 100, 0]);

const MAX_LOG = 200;

/** Ids de las opciones 'opt' del catálogo (se leen del worker tras cargar). */
const IDS_OPT = PARAMETROS.filter((p) => p.tipo === 'opt').map((p) => /** @type {number} */ (p.id));

/**
 * @typedef {object} ErrorCarga
 * @property {string} clave   'init-base' | 'carga' | …  (texto: mundo.errorCarga.<clave>)
 * @property {Record<string, any>} params
 * @property {string} msg     detalle técnico
 */

export class Sesion {
  /** @type {ConexionSim} */
  c;

  /** el wasm cargó */
  listo = $state(false);
  /** @type {ErrorCarga | null} el motor no cargó (bloquea el mundo) */
  errorCarga = $state.raw(null);
  /** excepción de la sim en ejecución ('' = ninguna): aviso descartable */
  avisoError = $state('');
  /** hubo al menos un reset o una carga */
  hayMundo = $state(false);
  /** sube con cada reset o carga (N4.1: el Player Bot se apaga con la sim) */
  mundo = $state(0);
  corriendo = $state(false);
  /** ticks por frame (0 = máxima) */
  velocidad = $state(10);
  /** vista enriquecida (false = clásica) */
  rica = $state(true);
  /** en la vista clásica: bots solo con contorno, sin relleno */
  contorno = $state(false);
  /** lente de «Color por» (claves de LENTES en render-enriquecido.js) */
  lente = $state('especie');
  /** la distancia genética perdió su referencia */
  sinReferencia = $state(false);

  /** @type {import('./conexion.js').StatsFrame} */
  stats = $state.raw({ cycle: 0, bots: 0, vegs: 0, tps: 0 });
  campo = $state.raw({ W: 0, H: 0 });
  /** frames dibujados por segundo */
  fps = $state(0);
  /** costo medio del dibujo (media móvil, ms) */
  drawMs = $state(0);
  /** @type {string[]} nombres de especie por índice (VIS.especie) */
  especies = $state.raw([]);
  /** bot con foco (0 = ninguno) */
  foco = $state(0);
  /** la cámara del mundo sigue al bot con foco (solo con foco) */
  siguiendo = $state(false);
  /** @type {import('./frame.js').FocoVivo | null} */
  focoVivo = $state.raw(null);
  /** @type {Float32Array | null} líneas del árbol de parentesco */
  familia = $state.raw(null);
  /** @type {string[]} últimos mensajes del motor (el más nuevo primero) */
  log = $state.raw([]);
  /** @type {Record<string, any> | null} opciones del último reset (+ cambios en vivo) */
  opciones = $state.raw(null);

  #frames = 0;
  #t0 = 0;
  /** sube con cada reset o carga: descarta lecturas de opciones viejas */
  #generacion = 0;

  /** @param {ConexionSim} conexion */
  constructor(conexion) {
    this.c = conexion;
    this.#t0 = performance.now();
    // Decisión 5: sin skins (el worker arranca con ellas encendidas).
    conexion.skins(false);
    conexion.view(this.rica);
    conexion.speed(this.velocidad);

    conexion.on('ready', () => {
      this.listo = true;
    });
    conexion.on('error', (m) => {
      this.errorCarga = {
        clave: String(m.clave ?? 'carga'),
        params: m.params && typeof m.params === 'object' ? m.params : {},
        msg: String(m.msg ?? ''),
      };
    });
    conexion.on('worker-error', (m) => {
      const msg = String(m.msg ?? 'error');
      this.avisoError = msg;
      this.#anotar(msg);
    });
    conexion.on('log', (m) => this.#anotar(String(m.msg)));
    conexion.on('species', (m) => {
      this.especies = Array.isArray(m.names) ? m.names : [];
    });
    conexion.on('stopped', () => {
      this.corriendo = false;
      conexion.run(false);
    });
    conexion.on('running', (m) => {
      this.corriendo = !!m.running;
    });
    conexion.on('focus', (m) => this.seleccionar(m.n | 0));
    // N4.1: con el Player Bot (indicador seguirFoco) murió el bot controlado y
    // el motor pasó el foco a un resaltado (un hijo nacido bajo control).
    conexion.on('pb-focus', (m) => this.#heredarFoco(m.n | 0, m.prev | 0));
    conexion.on('gendist-off', () => {
      this.sinReferencia = true;
    });
    conexion.on('family', (m) => {
      this.familia = m.lines?.length ? Float32Array.from(m.lines) : null;
    });
    conexion.on('opts', (m) => {
      if (!this.opciones) return;
      const opts = { ...this.opciones.opts };
      for (const id in m.vals) opts[id] = m.vals[id];
      this.opciones = { ...this.opciones, opts };
    });
    conexion.on('frame', (/** @type {import('./conexion.js').EventoFrame} */ ev) => {
      const { frame, stats, seqVigente } = ev;
      this.stats = stats;
      if (frame.W !== this.campo.W || frame.H !== this.campo.H) {
        this.campo = { W: frame.W, H: frame.H };
      }
      this.drawMs = this.drawMs * 0.9 + ev.drawMs * 0.1;
      if (seqVigente) {
        const fv = focoVivo(frame);
        this.focoVivo = fv;
        // el bot con foco murió: el worker apagó el foco
        if (!fv && this.foco > 0) this.#soltarFoco();
      }
      this.#frames++;
      const ahora = performance.now();
      if (ahora - this.#t0 >= 1000) {
        this.fps = Math.round((this.#frames * 1000) / (ahora - this.#t0));
        this.#frames = 0;
        this.#t0 = ahora;
      }
    });
  }

  /** Descarta el aviso de error en ejecución. */
  descartarAviso() {
    this.avisoError = '';
  }

  /** @param {string} msg */
  #anotar(msg) {
    this.log = [msg, ...this.log].slice(0, MAX_LOG);
  }

  #soltarFoco() {
    this.foco = 0;
    this.siguiendo = false;
    this.focoVivo = null;
    if (this.rica && this.lente === 'gendist') this.c.gendist(0);
  }

  /**
   * El worker ya movió su foco (no se le manda select): la sesión lo sigue,
   * salvo que la página haya elegido otro bot entretanto.
   * @param {number} n  el heredero (0 = no quedó nadie controlado)
   * @param {number} prev  el foco que el worker tenía
   */
  #heredarFoco(n, prev) {
    if (prev !== this.foco) return;
    if (n === 0) {
      this.#soltarFoco();
      return;
    }
    this.foco = n;
    this.focoVivo = null;
    if (this.rica && this.lente === 'gendist') this.c.gendist(n);
  }

  /**
   * Sim nueva. Pausa la actual. El mensaje va completo al worker (con los
   * indicadores opcionales `limpio` y `semillaColores`, C15).
   * @param {{ seed: number, options: Record<string, any>, species: import('./conexion.js').EspecieSiembra[],
   *   limpio?: boolean, semillaColores?: number, quietF1?: boolean }} o
   */
  reset(o) {
    this.corriendo = false;
    this.c.run(false);
    this.foco = 0;
    this.siguiendo = false;
    this.focoVivo = null;
    this.familia = null;
    this.opciones = o.options;
    this.hayMundo = true;
    this.avisoError = '';
    this.#generacion++;
    this.mundo++;
    this.c.reset(o);
    if (this.rica && this.lente === 'gendist') this.sinReferencia = true;
  }

  /** @param {boolean} on */
  correr(on) {
    this.corriendo = on;
    this.c.run(on);
  }

  unCiclo() {
    if (this.corriendo) this.correr(false);
    this.c.step();
  }

  /** @param {number} n ticks por frame (0 = máxima) */
  ponerVelocidad(n) {
    this.velocidad = n;
    this.c.speed(n);
  }

  /** @param {number} n bot (0 = ninguno) */
  seleccionar(n) {
    const nuevo = n | 0;
    if (nuevo !== this.foco) this.focoVivo = null;
    if (nuevo === 0) this.siguiendo = false;
    this.foco = nuevo;
    this.c.select(nuevo);
    if (this.rica && this.lente === 'gendist') {
      this.sinReferencia = nuevo === 0;
      this.c.gendist(nuevo);
    }
  }

  /**
   * Seguir (o dejar de seguir) con la cámara al bot con foco. Sin foco no
   * hay a quién seguir. El mundo (Mundo.svelte) lee `siguiendo`.
   * @param {boolean} on
   */
  seguir(on) {
    this.siguiendo = !!on && this.foco > 0;
    this.redibujar();
  }

  /**
   * @param {boolean} rica
   * @param {boolean} [contorno] solo cuenta si no es rica
   */
  ponerVista(rica, contorno = false) {
    this.contorno = !rica && contorno;
    this.rica = rica;
    this.c.view(rica);
    this.redibujar();
    if (rica && this.lente === 'gendist') {
      this.sinReferencia = this.foco === 0;
      this.c.gendist(this.foco);
    }
  }

  /** @param {string} lente */
  ponerLente(lente) {
    const antes = this.lente;
    this.lente = lente;
    if (lente === 'gendist') {
      this.sinReferencia = this.foco === 0;
      this.c.gendist(this.foco);
    } else if (antes === 'gendist') {
      this.c.gendist(0);
    }
    this.redibujar();
  }

  /** Frame fresco con la sim en pausa (corriendo, llegan solos). */
  redibujar() {
    if (!this.corriendo) this.c.redraw();
  }

  /** @param {number} id @param {number} v */
  setopt(id, v) {
    this.c.setopt(id, v);
    if (this.opciones) {
      this.opciones = { ...this.opciones, opts: { ...this.opciones.opts, [id]: v } };
    }
  }

  /**
   * Manda mensajes en vivo (setopt/setcost/setbase/seed-species… de un
   * diff o una siembra) en un ciclo exacto y lo devuelve: si corre, pausa,
   * pide el ciclo, manda y reanuda (conexion.aplicarEnCiclo). Las opciones
   * que cambian se reflejan en `opciones` como con setopt/setcost/setbase.
   * @param {any[]} mensajes
   * @returns {Promise<number>} ciclo en que se aplicaron
   */
  aplicarEnCiclo(mensajes) {
    for (const m of mensajes) this.#reflejar(m);
    return this.c.aplicarEnCiclo(mensajes, this.corriendo ? () => this.corriendo : undefined);
  }

  /** Refleja en `opciones` un mensaje en vivo. @param {any} m */
  #reflejar(m) {
    if (!this.opciones) return;
    if (m.t === 'setopt')
      this.opciones = { ...this.opciones, opts: { ...this.opciones.opts, [m.id]: m.v } };
    else if (m.t === 'setcost')
      this.opciones = { ...this.opciones, costs: { ...this.opciones.costs, [m.i]: m.v } };
    else if (m.t === 'setbase') {
      const { fieldW: _w, fieldH: _h, ...vivas } = m.vals ?? {};
      this.opciones = { ...this.opciones, ...vivas };
    }
  }

  /**
   * C12: opciones 'base' en vivo (mensaje setbase de engine/worker.js). Se
   * reflejan en `opciones` como las del reset; fieldW/fieldH no son vivas
   * (el worker las ignora) y no se copian.
   * @param {Record<string, number | boolean>} vals
   */
  setbase(vals) {
    this.c.setbase(vals);
    if (this.opciones) {
      const { fieldW: _w, fieldH: _h, ...vivas } = vals;
      this.opciones = { ...this.opciones, ...vivas };
    }
  }

  /** @param {number} i @param {number} v */
  setcost(i, v) {
    this.c.setcost(i, v);
    if (this.opciones) {
      this.opciones = { ...this.opciones, costs: { ...this.opciones.costs, [i]: v } };
    }
  }

  /** @returns {Promise<Uint8Array>} */
  guardar() {
    return this.c.save();
  }

  /**
   * `.dbsim` con el ciclo de la sim en el momento en que el worker lo armó
   * (con la sim corriendo, el ciclo de `stats` ya puede ser otro).
   * @returns {Promise<{ bytes: Uint8Array, cycle: number }>}
   */
  guardarConCiclo() {
    return this.c.saveConCiclo();
  }

  /**
   * Carga un `.dbsim`. Las opciones de la sim cargada se leen del worker
   * (getopt) para que el render use las suyas y no las del reset anterior;
   * mientras llegan, `opciones` queda en null. Los costos y las opciones
   * nombradas del reset no tienen lectura en el protocolo: no se incluyen.
   * @param {Uint8Array | ArrayBuffer} bytes
   * @returns {Promise<{ cycle: number, bots: number, missing: string[] }>} lo
   *   que quedó cargado (respuesta {t:'loaded'} del worker), cuando las
   *   opciones ya están leídas; se rechaza (ErrorConexion) si el worker no
   *   contesta o falla
   */
  cargar(bytes) {
    this.corriendo = false;
    this.foco = 0;
    this.siguiendo = false;
    this.focoVivo = null;
    this.familia = null;
    this.hayMundo = true;
    this.avisoError = '';
    this.opciones = null;
    const gen = ++this.#generacion;
    this.mundo++;
    const cargado = this.c.cargarConRespuesta(bytes);
    if (this.rica && this.lente === 'gendist') this.sinReferencia = true;
    const opciones = this.c.getopts(IDS_OPT).then(
      (opts) => {
        if (gen === this.#generacion) this.opciones = { opts, costs: {}, cargada: true };
        this.redibujar();
      },
      () => {},
    );
    return Promise.all([cargado, opciones]).then(([r]) => r);
  }

  /**
   * «Buscar el mejor» (N4.1): el motor pone el foco en el bot más apto (los
   * vegetales no cuentan) y contesta {t:'focus', n}, que ya selecciona (ver
   * el constructor). Devuelve el bot elegido (0 = ninguno; −1 si el worker
   * no contestó en 10 s).
   * @returns {Promise<number>}
   */
  buscarMejor() {
    return new Promise((resolver) => {
      const fin = (/** @type {number} */ n) => {
        baja();
        clearTimeout(id);
        resolver(n);
      };
      const baja = this.c.on('focus', (m) => fin(m.n | 0));
      const id = setTimeout(() => fin(-1), 10_000);
      this.c.findbest();
    });
  }

  /** @param {number} n @returns {Promise<string>} */
  adnDe(n) {
    return this.c.botText(n);
  }

  /** @param {number} n @param {number} [maxrec] */
  familiaDe(n, maxrec) {
    this.c.family(n, maxrec, true);
  }

  quitarFamilia() {
    this.familia = null;
    this.c.clearHighlight();
    this.redibujar();
  }

  /**
   * Nombre de especie sin la extensión del archivo (`Alga_Minimalis.txt` →
   * `Alga_Minimalis`). Los nombres de bots no se traducen.
   * @param {number} i índice de VIS.especie
   */
  nombreEspecie(i) {
    const n = this.especies[i];
    return n ? n.replace(/\.txt$/i, '') : '';
  }
}

/** @type {Sesion | null} */
let unica = null;

/**
 * La sesión de la página (se crea la primera vez que se pide).
 * @returns {Sesion}
 */
export function sesion() {
  if (!unica) {
    // En desarrollo Vite sirve engine/worker.js tal cual (un módulo ES con
    // import): hace falta un worker módulo, y engine/worker.js carga
    // dbcore.js con fetch + eval en vez de importScripts. En el build el
    // worker es clásico (C3: worker.format 'iife').
    const worker = import.meta.env.DEV
      ? new Worker(new URL('../../../engine/worker.js', import.meta.url), { type: 'module' })
      : new Worker(new URL('../../../engine/worker.js', import.meta.url));
    const conexion = new ConexionSim({
      worker,
      base: new URL('./build-wasm/', document.baseURI).href,
      v: BUILD_ID,
    });
    unica = new Sesion(conexion);
  }
  return unica;
}
