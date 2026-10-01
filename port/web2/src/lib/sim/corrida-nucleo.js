// @ts-check
// Corrida actual (decisión 12: corrida = escenario + semilla + cambios en
// caliente), encima de la sesión de sim. Lógica pura: la sesión, el
// almacén de corridas, el ADN de los bots, la miniatura y la descarga se
// inyectan, y el estado visible se escribe en un objeto `estado` (en la
// interfaz, campos $state de corrida.svelte.js; en los tests, un objeto
// común).
//
// Historia y linaje (N2.1, decisiones 8 y 9): con `muestreo` en las deps
// (la interfaz: MUESTREO_CORRIDA de src/lib/sim/metricas.js) la corrida le
// pide al worker una muestra cada 100 ciclos ({t:'muestreo'}, que se vuelve
// a mandar tras cada iniciar/cargar/importar con una correlación nueva: las
// muestras de la sim anterior se descartan) y con ellas alimenta la
// historia (engine/history.js), el linaje (engine/lineage.js), el detector
// del feed (src/lib/observar/detector-eventos.js) y las especies del panel. Las
// muestras dicen la especie por NOMBRE, así que todo eso anda igual con la
// vista clásica. Al guardar, historia y linaje van a corridas-datos (C14)
// recortados al ciclo del .dbsim; al cargar vuelven y la primera muestra de
// la sim cargada es el punto de partida (lo posterior se recorta).
//
// Cada frame da el resumen del panel «En vivo» (src/lib/observar/metricas.js:
// vivos, vegetales, energía; con la vista enriquecida, además, bots por
// especie y generación máxima al instante; con la clásica esos salen de la
// última muestra).
//
// Sin `muestreo` (tests, una sesión sin él) la historia se arma como en N1
// con los frames: una muestra cada 100 ciclos; con la vista clásica el
// frame no dice la especie de cada bot (solo su color, que muta): la
// historia guarda solo el total y el detector no se alimenta (no inventa
// especies ni extinciones); al cambiar de vista el detector empieza de nuevo.
//
// Tras un reset o una carga, los frames que ya venían en camino son de la
// sim anterior: se ignoran hasta el primero que refleje la selección pedida
// después (la sesión numera las selecciones y el frame trae el número). El
// primer frame tras una carga es el punto de partida: si la historia
// guardada llega más allá de su ciclo se recorta, no se borra.
//
// Operaciones que crean una sim (iniciar, cargar, importar): cada una toma
// un número de operación; si mientras espera (ADN, IndexedDB) empieza otra,
// la vieja se descarta sin tocar la sesión. arrancarPorDefecto no hace nada
// si alguna ya empezó.
//
// ADN de las especies de un .dbsim (RV-40): el archivo no lo trae. El
// worker avisa {t:'dna-missing', names} al cargar y la corrida responde con
// {t:'dna-lib'}: lo que sembró esta página (escenario y siembras), los
// presets de la sim de prueba, los bots propios del escenario y el
// Bestiary (C1), como la clásica (port/web/index.html, resolveDnaByName).
//
// Globales de proceso al retomar (RV-39): el .dbsim no trae StartChlr ni
// las opciones 92–101 (reinicio, descalificación, F1…); en el original
// sobreviven a la carga porque son del proceso, y la sesión que guardó los
// tiene. En un worker nuevo (retomar tras recargar) valdrían los de fábrica:
// tras cargar una corrida con escenario se vuelven a escribir los del
// escenario efectivo, sin pasar por el diálogo de opciones (nocap).
//
// API pública (la usan Observar, Experimentar e Inicio): iniciar, cargar,
// importarDbsim, guardar, exportarDbsim, arrancarPorDefecto, registrarCambio,
// escenarioEfectivo, sembrar, mensajesEventos, sinGuardar, avisar, estado,
// sesion; y, para la barra «Mundo» (N3.8), aplicarObjetos, objetosActuales
// y guardarObjetosEnEscenario.

import {
  mensajeObjeto,
  mensajesEvento,
  nuevaCorrida,
  registrarCambio,
  registrarObjetos,
  registrarSiembra,
} from '../../../engine/corridas.js';
import { escenarioFabrica } from '../../../engine/escenarios/fabrica.js';
import { aplicar, resolverOpciones, textoEn } from '../../../engine/escenarios/index.js';
import { Historia } from '../../../engine/history.js';
import { Linaje } from '../../../engine/lineage.js';
import { parametro, valorEfectivo } from '../../../engine/opciones.js';
import { ID_ESCENARIO_PARTIDO } from '../../../engine/rondas.js';
import { cssAVb, vbACss } from '../mundo/color.js';
import { DetectorEventos, especiesNuevas } from '../observar/detector-eventos.js';
import {
  muestraDeResumen,
  muestraSinAlga,
  muestrasDeHistoria,
  resumenMuestra,
  resumenSinAlga,
  resumirFrame,
  sinTxt,
  variacion,
} from '../observar/metricas.js';
import { plegarObjetos } from '../observar/objetos/ordenes.js';
import { activarMuestreo } from './metricas.js';
import { especiesPrueba, resetPrueba } from './prueba.js';

/** Eventos que conserva el feed. */
export const MAX_FEED = 100;
/** Intervalo mínimo entre actualizaciones del panel con la sim corriendo (ms). */
export const REFRESCO_MS = 250;
export const ESCENARIO_INICIAL = 'sopa-primordial';

/**
 * El feed (el más nuevo primero, a lo sumo MAX_FEED) desde los eventos de
 * la historia, la única copia que se guarda.
 * @param {Historia} h
 * @returns {EventoFeed[]}
 */
export function feedDeHistoria(h) {
  return h.eventos.slice(-MAX_FEED).reverse();
}

/**
 * Migración: el feed guardado aparte por las corridas viejas (el más nuevo
 * primero) pasa a los eventos de la historia, sin repetir los que ya tiene
 * (las de N2.1 tenían los dos; el feed además traía «guardada»).
 * @param {Historia} h @param {EventoFeed[] | undefined} feed
 */
export function migrarFeed(h, feed) {
  if (!Array.isArray(feed) || !feed.length) return;
  const clave = (/** @type {any} */ e) => JSON.stringify([e?.ciclo, e?.tipo, e?.params ?? null]);
  const ya = new Set(h.eventos.map(clave));
  const faltan = [...feed].reverse().filter((e) => !ya.has(clave(e)));
  if (!faltan.length) return;
  const todos = [...h.eventos, ...faltan].map((e, i) => ({ e, i }));
  todos.sort((a, b) => (a.e?.ciclo ?? 0) - (b.e?.ciclo ?? 0) || a.i - b.i);
  h.ponerEventos(todos.map((x) => x.e));
}

/**
 * Error de una operación de la corrida, con clave estable (el texto sale de
 * t('observar.aviso.error.<clave>'), src/lib/observar/errores.js):
 * 'inexistente' (no hay corrida con ese id), 'sinDbsim' (la corrida no
 * tiene su .dbsim), 'dbsimInvalido' (el archivo no es una simulación).
 */
export class ErrorCorrida extends Error {
  /** @param {string} clave @param {string} [detalle] */
  constructor(clave, detalle) {
    super(detalle ? `${clave}: ${detalle}` : clave);
    this.name = 'ErrorCorrida';
    this.clave = clave;
  }
}

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../../engine/escenarios/index.js').Especie} EspecieEsc
 * @typedef {import('../../../engine/corridas.js').EventoCorrida} EventoCorrida
 * @typedef {import('../observar/detector-eventos.js').EventoFeed} EventoFeed
 * @typedef {import('../observar/metricas.js').Resumen} Resumen
 * @typedef {import('../observar/metricas.js').Muestra} Muestra
 */

/**
 * @typedef {object} Vivo
 * @property {number} ciclo
 * @property {number} vivos
 * @property {number} vegetales
 * @property {number} nrgMedia
 * @property {number} genMax
 * @property {string} genEspecie
 * @property {boolean} rica
 * @property {boolean} porEspecie  especies y generación por nombre (vista
 *   enriquecida, o muestras del worker con cualquier vista)
 * @property {{ nombre: string, n: number }[]} especies  con bots, de más a menos
 *   (sin porEspecie: grupos por color)
 * @property {number | null} extinguidas  especies que tuvieron bots y ya no
 *   (null sin porEspecie: no se sabe)
 * @property {number | null} variacion  bots vivos respecto de hace 1.000 ciclos
 */

/**
 * @typedef {object} EstadoCorrida
 * @property {Escenario | null} escenario
 * @property {number | null} semilla
 * @property {string} nombre      '' = sin nombre (la sim de prueba)
 * @property {string | null} id   guardada en IndexedDB con este id
 * @property {EventoCorrida[]} eventos  cambios en caliente y siembras (decisión 13)
 * @property {EventoFeed[]} feed  el más nuevo primero
 * @property {Vivo | null} vivo
 * @property {Muestra[]} muestras
 * @property {number} intervalo
 * @property {Record<string, string>} colores  especie → color CSS
 * @property {'' | 'iniciando' | 'guardando' | 'cargando'} ocupado
 * @property {{ clave: string, params?: Record<string, any>, error?: boolean } | null} aviso
 */

/**
 * @typedef {object} SesionLike
 * @property {{ cycle: number, bots: number }} stats
 * @property {boolean} corriendo
 * @property {boolean} hayMundo
 * @property {string[]} especies
 * @property {{ on: (t: string, cb: (m: any) => void) => () => void, enviar: (m: any) => void,
 *   seedSpecies: (sp: any) => void, dnaLib?: (e: { name: string, dna: string }[]) => void }} c
 * @property {(o: any) => void} reset
 * @property {(on: boolean) => void} correr
 * @property {(n: number) => void} seleccionar
 * @property {(b: Uint8Array | ArrayBuffer) => (Promise<{ cycle: number, bots: number,
 *   missing?: string[] } | void> | void)} cargar
 * @property {() => Promise<Uint8Array>} guardar
 * @property {() => Promise<{ bytes: Uint8Array, cycle: number }>} [guardarConCiclo]
 * @property {(mensajes: any[]) => Promise<number>} [aplicarEnCiclo]  manda en un
 *   ciclo exacto y lo devuelve (sesion.svelte.js)
 * @property {() => void} [redibujar]  frame fresco con la sim en pausa
 */

/**
 * @typedef {object} DepsCorrida
 * @property {SesionLike} sesion
 * @property {ReturnType<typeof import('../../../engine/corridas.js').crearCorridas>} corridas
 * @property {EstadoCorrida} estado
 * @property {(s: EspecieEsc) => Promise<string | undefined>} adnDe
 * @property {(nombre: string) => Promise<string | undefined>} [adnPropioPorNombre]  ADN
 *   del bot propio con ese nombre (dna-missing sin especie en el escenario)
 * @property {() => string} idioma
 * @property {() => (string | undefined)} [miniatura]
 * @property {(bytes: Uint8Array, nombre: string) => void} [descargar]
 * @property {() => number} [ahora]
 * @property {() => number} [semillaNueva]
 * @property {() => string} [nombrePorDefecto]  nombre de una corrida sin nombre al guardarla
 * @property {import('./metricas.js').OpcionesMuestreo} [muestreo]  muestras del
 *   worker para la historia (sin él, la historia sale de los frames, como en N1)
 */

/**
 * Opciones que el .dbsim no guarda (globales de proceso, RV-39), en el
 * orden del reset (97 antes que 101).
 */
export const GLOBALES_PROCESO = Object.freeze([
  'base:startChlr',
  'opt:92',
  'opt:93',
  'opt:94',
  'opt:95',
  'opt:96',
  'opt:97',
  'opt:98',
  'opt:99',
  'opt:100',
  'opt:101',
]);

/** @returns {EstadoCorrida} */
export function estadoVacio() {
  return {
    escenario: null,
    semilla: null,
    nombre: '',
    id: null,
    eventos: [],
    feed: [],
    vivo: null,
    muestras: [],
    intervalo: 100,
    colores: {},
    ocupado: '',
    aviso: null,
  };
}

/** Corrida sin escenario (sim de prueba, .dbsim importado). @param {string} nombre @param {number | null} semilla */
const corridaSuelta = (nombre, semilla) =>
  /** @type {any} */ ({
    nombre,
    escenario: null,
    semilla,
    eventos: [],
    ciclo: 0,
    bots: 0,
    especies: [],
    marcada: 0,
  });

export class NucleoCorrida {
  /** @type {EstadoCorrida} */
  estado;
  /** @type {SesionLike} */
  sesion;
  #d;
  #det = new DetectorEventos();
  #hist = new Historia();
  #lin = new Linaje();
  /** @type {string | null} correlación del muestreo vigente (las muestras con otra se descartan) */
  #reqMuestreo = null;
  /** @type {ReturnType<typeof resumenMuestra> | null} lo último de una muestra del worker */
  #ultimaMuestra = null;
  /** especies sembradas o ya vistas (sin .txt) */
  #conocidas = new Set();
  /** especies que alguna vez tuvieron bots (vista enriquecida) */
  #vistas = new Set();
  /** @type {Map<number, string>} color → especie (para la vista clásica) */
  #porColor = new Map();
  /** ignorar frames hasta uno posterior al último reset/carga */
  #esperando = false;
  /** fijar la base de especies conocidas en el próximo frame válido */
  #baseEspecies = true;
  /** el próximo frame válido es el de la sim recién cargada */
  #trasCarga = false;
  /** vista del último resumen (null = ninguno todavía) */
  /** @type {boolean | null} */
  #ultimaRica = null;
  #ultimoVivo = -Infinity;
  /** número de la operación que crea sim vigente */
  #op = 0;
  /** alguna operación que crea sim ya empezó (arrancarPorDefecto no hace nada) */
  #arrancado = false;
  /** evento del feed que espera el ciclo del primer frame de la sim cargada */
  /** @type {EventoFeed | null} */
  #sinCiclo = null;
  /** @type {import('../../../engine/corridas.js').Corrida & Record<string, any>} */
  #datos;
  /** @type {Map<string, string>} nombre de especie (con .txt) → ADN que conoce la página */
  #adnLocal = new Map();
  /** @type {Promise<void> | null} respuesta en curso a un dna-missing */
  #adnPendiente = null;
  /**
   * ciclo y cantidad de eventos de lo último guardado o cargado (-1 = nada);
   * `objetos`: después hubo un «Guardar en el escenario» (cada guardado,
   * carga o sim nueva pone un objeto nuevo, sin la marca)
   * @type {{ ciclo: number, eventos: number, objetos?: true }}
   */
  #guardado = { ciclo: -1, eventos: 0 };

  /** @param {DepsCorrida} d */
  constructor(d) {
    this.#d = d;
    this.estado = d.estado;
    this.sesion = d.sesion;
    this.#datos = corridaSuelta('', null);
    d.sesion.c.on('frame', (ev) => this.alFrame(ev));
    d.sesion.c.on('muestra', (m) => this.alMuestra(m));
    d.sesion.c.on('lint', (m) => {
      const n = Array.isArray(m.issues) ? m.issues.length : 0;
      if (n) this.avisar('observar.aviso.lint', { especie: sinTxt(m.name), n }, true);
    });
    d.sesion.c.on('dna-missing', (m) => {
      const names = Array.isArray(m.names) ? m.names.map(String) : [];
      if (names.length) this.#adnPendiente = this.#resolverAdn(names);
    });
  }

  get #ahora() {
    return this.#d.ahora ? this.#d.ahora() : Date.now();
  }

  /** @param {string} clave @param {Record<string, any>} [params] @param {boolean} [error] */
  avisar(clave, params, error = false) {
    this.estado.aviso = { clave, params, error };
  }

  /** Las muestras vienen del worker (no de los frames). */
  get #porMuestras() {
    return !!this.#d.muestreo;
  }

  /** �Es un partido de torneo? Su alga de arranque no es un luchador. */
  get #esPartido() {
    return this.#datos.escenario?.id === ID_ESCENARIO_PARTIDO;
  }

  /** La historia de la corrida (engine/history.js). */
  get historia() {
    return this.#hist;
  }

  /** La genealogía de la corrida (engine/lineage.js). */
  get linaje() {
    return this.#lin;
  }

  /** @param {EventoFeed[]} evs */
  #alFeed(evs) {
    if (!evs.length) return;
    this.estado.feed = [...[...evs].reverse(), ...this.estado.feed].slice(0, MAX_FEED);
    for (const e of evs) this.#hist.evento(e);
  }

  /** Olvida las estadísticas vivas (sim nueva). @param {Historia} [h] @param {Linaje} [l] */
  #reiniciarVivo(h, l) {
    this.#det.reiniciar();
    this.#hist = h ?? new Historia({ intervalo: this.#d.muestreo?.cada });
    this.#lin = l ?? new Linaje();
    this.#ultimaMuestra = null;
    this.#vistas = new Set(this.#hist.especies.keys());
    this.#esperando = true;
    this.#baseEspecies = true;
    this.#trasCarga = false;
    this.#ultimaRica = null;
    this.#ultimoVivo = -Infinity;
    this.estado.vivo = null;
    this.#publicarHistoria();
  }

  #publicarHistoria() {
    this.estado.muestras = muestrasDeHistoria(this.#hist);
    this.estado.intervalo = this.#hist.intervalo;
  }

  /** Pide al worker el muestreo de la corrida (con una correlación nueva). */
  #activarMuestreo() {
    if (this.#d.muestreo) this.#reqMuestreo = activarMuestreo(this.sesion.c, this.#d.muestreo);
  }

  /**
   * Sim nueva (iniciar, cargar, importar): nada de la anterior sirve para
   * nombrar colores ni especies.
   * @param {Record<string, string>} [colores]
   */
  #nuevaSim(colores = {}) {
    this.#porColor = new Map();
    this.estado.colores = colores;
    this.#adnLocal = new Map();
    this.#adnPendiente = null;
    this.#sinCiclo = null;
    this.#trasCarga = false;
  }

  #publicarDatos() {
    const d = this.#datos;
    this.estado.escenario = d.escenario;
    this.estado.semilla = d.semilla;
    this.estado.nombre = d.nombre;
    this.estado.id = d.id ?? null;
    this.estado.eventos = structuredClone(d.eventos);
  }

  /** Toma el número de operación (la anterior queda descartada). */
  #tomarOp() {
    this.#arrancado = true;
    return ++this.#op;
  }

  /**
   * @param {number} op @param {EstadoCorrida['ocupado']} que
   */
  #terminar(op, que) {
    if (op === this.#op && this.estado.ocupado === que) this.estado.ocupado = '';
  }

  // ---- Frames -----------------------------------------------------------------

  /** @param {import('./conexion.js').EventoFrame} ev */
  alFrame(ev) {
    if (this.#esperando) {
      if (!ev.seqVigente) return;
      this.#esperando = false;
    }
    const f = ev.frame;
    // Antes del primer tick el frame trae ciclo −1.
    if (!(f.ciclo >= 0)) return;
    if (this.#sinCiclo) {
      const e = this.#sinCiclo;
      this.#sinCiclo = null;
      this.estado.feed = this.estado.feed.map((x) => (x === e ? { ...e, ciclo: f.ciclo } : x));
      // y su copia en la historia (la única que se guarda)
      const h = this.#hist.eventos.findLast((x) => x.tipo === e.tipo && x.ciclo === e.ciclo);
      if (h) h.ciclo = f.ciclo;
    }
    if (f.rica && !this.#porMuestras) {
      this.revisarEspecies(this.sesion.especies.map(sinTxt), f.nTps > 0, f.ciclo);
    }
    this.ingerir(
      resumirFrame(f, {
        nombreEspecie: (i) => this.sesion.especies[i] ?? '',
        nombrePorColor: this.#porColor,
      }),
    );
  }

  /**
   * Especies nuevas en la tabla de la vista. La primera vez tras un reset o
   * una carga solo fija la base.
   * @param {string[]} nombres sin .txt @param {boolean} hayTeleporter @param {number} ciclo
   */
  revisarEspecies(nombres, hayTeleporter, ciclo) {
    if (this.#baseEspecies) {
      this.#baseEspecies = false;
      for (const n of nombres) this.#conocidas.add(n);
      return;
    }
    this.#alFeed(especiesNuevas(this.#conocidas, nombres, hayTeleporter, ciclo));
  }

  /**
   * Una muestra del worker ({t:'muestra'}): historia, linaje, colores,
   * especies nuevas y detector. Se descarta si es de otro muestreo (una sim
   * anterior) o si la corrida no muestrea.
   * @param {any} m
   */
  alMuestra(m) {
    if (!this.#porMuestras || !m || m.req !== this.#reqMuestreo) return;
    if (this.#esPartido) m = { ...muestraSinAlga(m), req: m.req };
    if (!(m.ciclo >= 0)) return;
    const ult = this.#hist.ultimoCiclo;
    if (this.#trasCarga) {
      // Primera muestra de la sim cargada: el punto de partida. Lo que la
      // historia y el linaje tengan desde su ciclo no pasó en esta sim.
      this.#trasCarga = false;
      if (ult >= m.ciclo) this.#hist.recortar(m.ciclo - 1);
      this.#lin.recortar(m.ciclo);
    } else if (m.ciclo < ult) {
      // Ciclo hacia atrás con el mismo muestreo: otra sim.
      this.#reiniciarVivo();
      this.#esperando = false;
    } else if (m.ciclo === ult) return;
    this.#hist.agregar(m);
    if (m.linaje || m.dominante) this.#lin.agregar(m);
    const r = resumenMuestra(m);
    this.#ultimaMuestra = r;
    let coloresNuevos = false;
    for (const [nombre, n] of Object.entries(r.especies)) {
      if (n > 0) this.#vistas.add(nombre);
      if (!this.estado.colores[nombre]) coloresNuevos = true;
    }
    if (coloresNuevos) {
      const c = { ...this.estado.colores };
      for (const [nombre, col] of Object.entries(r.colores)) c[nombre] ??= vbACss(col);
      this.estado.colores = c;
    }
    this.revisarEspecies(Object.keys(r.especies), r.teleporters > 0, r.ciclo);
    this.#alFeed(this.#det.muestra(r));
    this.#publicarHistoria();
  }

  /**
   * Sin muestreo del worker: una muestra de la historia cada `intervalo`
   * ciclos con lo que dice el frame (como en N1), y el detector.
   * @param {Resumen} r
   */
  #muestraDeFrame(r) {
    const ult = this.#hist.ultimoCiclo;
    if (this.#trasCarga) {
      // Primer frame de la sim cargada: el punto de partida. Lo que la
      // historia tenga más allá de su ciclo no pasó en esta sim.
      this.#trasCarga = false;
      if (ult >= 0 && r.ciclo < ult) {
        this.#hist.recortar(r.ciclo);
        this.#publicarHistoria();
      }
    } else if (ult >= 0 && r.ciclo < ult) {
      // Ciclo hacia atrás: otra sim (una carga o un reset que no pasó por acá).
      this.#reiniciarVivo();
      this.#esperando = false;
    }
    // Con otra vista las muestras no se comparan: el detector empieza de nuevo.
    if (this.#ultimaRica !== null && this.#ultimaRica !== r.rica) this.#det.reiniciar();
    this.#ultimaRica = r.rica;
    const u = this.#hist.ultimoCiclo;
    if (u >= 0 && r.ciclo < u + this.#hist.intervalo) return;
    const m = muestraDeResumen(r);
    if (!this.#hist.agregar(m)) return;
    if (r.rica) {
      /** @type {Record<string, number>} */
      const especies = {};
      for (const e of m.especies) especies[e.nombre] = e.stats[1];
      this.#alFeed(
        this.#det.muestra({
          ciclo: r.ciclo,
          total: r.vivos,
          especies,
          genMax: r.genMax,
          genEspecie: r.genEspecie,
        }),
      );
    }
    this.#publicarHistoria();
  }

  /**
   * Resumen de un frame: colores y panel (y, sin muestreo del worker, la
   * muestra de la historia y el detector).
   * @param {Resumen} r
   */
  ingerir(r) {
    if (this.#esPartido) r = resumenSinAlga(r);
    if (!this.#porMuestras) this.#muestraDeFrame(r);

    if (r.rica) {
      let coloresNuevos = false;
      for (const [nombre, e] of Object.entries(r.especies)) {
        this.#porColor.set(e.color, nombre);
        if (e.n > 0) this.#vistas.add(nombre);
        if (!this.estado.colores[nombre]) coloresNuevos = true;
      }
      if (coloresNuevos) {
        const c = { ...this.estado.colores };
        for (const [nombre, e] of Object.entries(r.especies)) c[nombre] ??= vbACss(e.color);
        this.estado.colores = c;
      }
    }

    const ahora = this.#ahora;
    if (this.sesion.corriendo && ahora - this.#ultimoVivo < REFRESCO_MS) return;
    this.#ultimoVivo = ahora;
    // Por especie: la vista enriquecida lo dice en cada frame; con la
    // clásica, la última muestra del worker (por nombre). Sin ninguna de las
    // dos, los grupos por color del frame (sin extinciones ni generación).
    const um = !r.rica && this.#porMuestras ? this.#ultimaMuestra : null;
    const porEspecie = r.rica || !!um;
    /** @type {Record<string, number>} */
    const actuales = um
      ? um.especies
      : Object.fromEntries(Object.entries(r.especies).map(([k, e]) => [k, e.n]));
    const especies = Object.entries(actuales)
      .filter(([, n]) => n > 0 || !um)
      .map(([nombre, n]) => ({ nombre, n }))
      .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre));
    let extinguidas = null;
    if (porEspecie) {
      extinguidas = 0;
      for (const k of this.#vistas) if (!(actuales[k] > 0)) extinguidas++;
    }
    this.estado.vivo = {
      ciclo: r.ciclo,
      vivos: r.vivos,
      vegetales: r.vegetales,
      nrgMedia: r.nrgMedia,
      genMax: um ? um.genMax : r.genMax,
      genEspecie: um ? um.genEspecie : r.genEspecie,
      rica: r.rica,
      porEspecie,
      especies,
      extinguidas,
      variacion: variacion(this.#hist, r),
    };
  }

  // ---- ADN de las especies cargadas (RV-40) ----------------------------------

  /**
   * ADN por nombre de especie (con .txt) para un dna-missing: lo sembrado
   * por esta página, los presets de la sim de prueba, las especies del
   * escenario (adnDe: bots propios por la versión exacta o por nombre, o el
   * Bestiary) y, si no están en el escenario, un propio con ese nombre y
   * después el Bestiary. Lo que no aparece queda sin ADN (como el .txt
   * ausente).
   * @param {string[]} names
   */
  async #resolverAdn(names) {
    const presets = especiesPrueba();
    const especiesEsc = this.#datos.escenario?.especies ?? [];
    /** @type {{ name: string, dna: string }[]} */
    const entries = [];
    await Promise.all(
      names.map(async (name) => {
        let dna = this.#adnLocal.get(name) ?? presets.find((p) => p.name === name)?.dna;
        if (!dna) {
          const bot = sinTxt(name);
          const s = especiesEsc.find((x) => x.bot === bot);
          try {
            if (s) dna = s.adn ?? (await this.#d.adnDe(s));
            else {
              // sin especie en el escenario: primero un propio con ese nombre, después el Bestiary
              dna = await this.#d.adnPropioPorNombre?.(bot);
              dna ??= await this.#d.adnDe(/** @type {any} */ ({ bot }));
            }
          } catch {
            dna = undefined;
          }
        }
        if (dna) entries.push({ name, dna });
      }),
    );
    // En el orden en que el worker las pidió.
    entries.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name));
    for (const e of entries) this.#adnLocal.set(e.name, e.dna);
    if (this.sesion.c.dnaLib) this.sesion.c.dnaLib(entries);
    else this.sesion.c.enviar({ t: 'dna-lib', entries });
  }

  /**
   * Espera la respuesta al dna-missing de la última carga (si hubo). Si el
   * worker informó especies sin ADN en la respuesta de la carga y el
   * dna-missing no llegó por el oyente, se resuelven acá.
   * @param {string[]} [missing]
   */
  async #esperarAdn(missing) {
    if (!this.#adnPendiente && missing?.length) this.#adnPendiente = this.#resolverAdn(missing);
    const p = this.#adnPendiente;
    this.#adnPendiente = null;
    if (p) await p;
  }

  /**
   * Vuelve a escribir los globales de proceso del escenario efectivo tras
   * una carga (ver la cabecera). Sin escenario, nada.
   */
  #restaurarGlobales() {
    const e = this.escenarioEfectivo();
    if (!e) return;
    const r = resolverOpciones(e);
    for (const clave of GLOBALES_PROCESO) {
      const p = parametro(clave);
      if (!p) continue;
      const v = valorEfectivo(r, clave);
      if (p.tipo === 'base')
        this.sesion.c.enviar({
          t: 'setbase',
          vals: { [/** @type {string} */ (p.id)]: v },
          nocap: true,
        });
      else this.sesion.c.enviar({ t: 'setopt', id: p.id, v, nocap: true });
    }
  }

  /** ADN que esta página ya conoce de un escenario (especies con ADN propio y siembras). */
  #recordarAdnDe(/** @type {any} */ datos) {
    for (const s of datos?.escenario?.especies ?? [])
      if (s.adn) this.#adnLocal.set(`${s.bot}.txt`, s.adn);
    for (const ev of datos?.eventos ?? [])
      if (ev.tipo === 'siembra') this.#adnLocal.set(`${ev.especie.nombre}.txt`, ev.especie.adn);
  }

  // ---- Corrida ----------------------------------------------------------------

  /**
   * Sim nueva con un escenario y una semilla: pide el ADN que falte, manda
   * los mensajes de aplicar() por la sesión (el reset va completo: `limpio`,
   * C15) y empieza una corrida sin guardar. No arranca la sim. Devuelve
   * false si otra operación (iniciar, cargar, importar) empezó mientras
   * esperaba el ADN: en ese caso no mandó nada.
   * @param {Escenario} escenario @param {number} semilla @param {{ nombre?: string }} [o]
   * @returns {Promise<boolean>}
   */
  async iniciar(escenario, semilla, o = {}) {
    const op = this.#tomarOp();
    this.estado.ocupado = 'iniciando';
    try {
      /** @type {Map<number, string | undefined>} */
      const adn = new Map();
      await Promise.all(
        escenario.especies.map(async (s, i) => {
          if (!s.adn) adn.set(i, await this.#d.adnDe(s));
        }),
      );
      if (op !== this.#op) return false;
      const msgs = aplicar(escenario, semilla, (s) => adn.get(escenario.especies.indexOf(s)));
      for (const m of msgs) {
        if (m.t === 'run') this.sesion.correr(false);
        else if (m.t === 'reset') {
          const { t: _t, ...reset } = m;
          this.sesion.reset(reset);
        } else this.sesion.c.enviar(m);
      }
      this.sesion.seleccionar(0);
      this.#activarMuestreo();
      const nombre = o.nombre || textoEn(escenario.nombre, this.#idiomaEsc());
      this.#datos = /** @type {any} */ (nuevaCorrida({ escenario, semilla, nombre }));
      this.#conocidas = new Set(escenario.especies.map((s) => s.bot));
      /** @type {Record<string, string>} */
      const colores = {};
      for (const s of escenario.especies) colores[s.bot] ??= s.color;
      this.#nuevaSim(colores);
      const reset = msgs.find((m) => m.t === 'reset');
      for (const sp of reset?.species ?? []) this.#adnLocal.set(sp.name, sp.dna);
      this.#guardado = { ciclo: -1, eventos: 0 };
      this.#reiniciarVivo();
      this.#publicarDatos();
      this.estado.feed = [];
      this.#alFeed([{ ciclo: 0, tipo: 'inicio', params: { nombre, semilla } }]);
      return true;
    } finally {
      this.#terminar(op, 'iniciando');
    }
  }

  #idiomaEsc() {
    return this.#d.idioma() === 'en' ? 'en' : 'es';
  }

  /**
   * Al abrir Observar sin sim: el escenario de fábrica «Sopa primordial» con
   * una semilla nueva; si no se puede (sin Bestiary), la sim de prueba. Y la
   * pone a correr. No hace nada si ya hay mundo o si otra operación (un
   * iniciar desde Inicio, una carga) ya empezó.
   */
  async arrancarPorDefecto() {
    if (this.sesion.hayMundo || this.#arrancado) return;
    const antes = this.#op;
    try {
      const esc = escenarioFabrica(ESCENARIO_INICIAL);
      if (!esc) throw new Error(`sin escenario ${ESCENARIO_INICIAL}`);
      const semilla = this.#d.semillaNueva
        ? this.#d.semillaNueva()
        : 1 + Math.floor(Math.random() * 2147483646);
      if (!(await this.iniciar(esc, semilla))) return;
    } catch {
      // Otra operación empezó mientras tanto: ella manda.
      if (this.#op !== antes + 1) return;
      const r = resetPrueba();
      this.sesion.correr(false);
      this.sesion.reset(r);
      this.sesion.seleccionar(0);
      this.#activarMuestreo();
      this.#datos = corridaSuelta('', r.seed);
      this.#conocidas = new Set(r.species.map((s) => sinTxt(s.name)));
      this.#nuevaSim();
      for (const sp of r.species) this.#adnLocal.set(sp.name, sp.dna);
      this.#guardado = { ciclo: -1, eventos: 0 };
      this.#reiniciarVivo();
      this.#publicarDatos();
      this.estado.feed = [];
    }
    if (this.#op !== antes + 1) return;
    this.sesion.correr(true);
  }

  /**
   * Registra un cambio en caliente ya aplicado por quien llama (Experimentar
   * manda los mensajes del diff, idealmente con sesion.aplicarEnCiclo, que
   * devuelve el ciclo exacto). Acepta el resultado de diff() de
   * engine/escenarios (sus escrituras `vivo`, en orden, reenvíos incluidos)
   * o un {clave: valor}. `ciclo`: el ciclo en que se aplicó (sin él, el de
   * la sesión, que con la sim corriendo puede ir atrasado); nunca antes del
   * último evento. Devuelve el evento o null.
   * @param {import('../../../engine/escenarios/index.js').Diferencias | Record<string, number>} diff
   * @param {number} [ciclo]
   */
  registrarCambio(diff, ciclo) {
    /** @type {[string, number][]} */
    const escrituras =
      diff && Array.isArray(diff.vivo)
        ? /** @type {import('../../../engine/escenarios/index.js').Diferencias} */ (diff).vivo.map(
            (c) => [c.clave, c.despues],
          )
        : Object.entries(/** @type {Record<string, number>} */ (diff ?? {}));
    if (!escrituras.length) return null;
    const c = this.#cicloEvento(ciclo);
    // De a una: una clave reenviada (acopladas) pasa al final del evento.
    for (const [k, v] of escrituras) registrarCambio(this.#datos, c, { [k]: v });
    const evs = this.#datos.eventos;
    this.estado.eventos = structuredClone(evs);
    this.#alFeed([
      {
        ciclo: Math.max(c, 0),
        tipo: 'cambio',
        params: { cambios: Object.fromEntries(escrituras) },
      },
    ]);
    return evs[evs.length - 1];
  }

  /**
   * Ciclo de un evento nuevo: el dado (exacto) o el de la sesión; nunca
   * antes del último evento. Antes del primer tick es −1 (el ciclo del core
   * en ese momento; sin ciclo conocido, también): así se distingue de un
   * cambio hecho tras exactamente un tick (ciclo 0) y las réplicas lo
   * aplican en el arranque. La interfaz lo muestra como 0 (cicloVisible;
   * el feed y la historia lo guardan ya como 0).
   * @param {number} [ciclo]
   */
  #cicloEvento(ciclo) {
    const evs = this.#datos.eventos;
    const ultimo = evs.length ? evs[evs.length - 1].ciclo : -1;
    const n = Math.trunc(Number(ciclo === undefined ? this.sesion.stats.cycle : ciclo));
    return Math.max(Number.isFinite(n) ? n : -1, ultimo, -1);
  }

  /**
   * El escenario con los cambios en caliente aplicados (el «actual» contra
   * el que Experimentar calcula el diff), con fusionarCambios de
   * engine/opciones.js (acopladas) vía plegarObjetos. Las siembras en caliente no cambian el
   * escenario. Un laberinto polar en caliente enciende la deriva (opciones
   * 83–85): cuenta como un cambio en su posición entre los eventos
   * (plegarObjetos), así los cambios posteriores sobre 83–85 mandan.
   * null si la sim no salió de un escenario (un .dbsim importado, la sim de
   * prueba).
   * @returns {Escenario | null}
   */
  escenarioEfectivo() {
    const e = this.#datos.escenario;
    if (!e) return null;
    const out = structuredClone(e);
    out.opciones.cambios = plegarObjetos(
      e.objetos,
      this.#datos.eventos,
      out.opciones.cambios,
    ).cambios;
    // Objetos guardados con «Guardar en el escenario» (barra «Mundo»).
    if (this.#datos.objetosEscenario) out.objetos = structuredClone(this.#datos.objetosEscenario);
    return out;
  }

  /**
   * Orden de objeto en caliente (barra «Mundo» de Observar, decisión 15):
   * la manda al worker y la registra como evento 'objetos' de la corrida
   * (una réplica la repite en el mismo ciclo). Con sesion.aplicarEnCiclo va
   * en un ciclo exacto y se registra cuando el worker lo confirma; sin él,
   * en el ciclo de la sesión. Lanza si la orden no vale (antes de mandar).
   * @param {import('../../../engine/corridas.js').OrdenObjeto} orden
   * @returns {Promise<void>}
   */
  aplicarObjetos(orden) {
    const m = mensajeObjeto(orden);
    const datos = this.#datos;
    /** @param {number} [ciclo] */
    const registrar = (ciclo) => {
      if (this.#datos !== datos) return; // otra sim mientras tanto
      const c = this.#cicloEvento(ciclo);
      registrarObjetos(this.#datos, c, orden);
      this.estado.eventos = structuredClone(this.#datos.eventos);
      this.#alFeed([{ ciclo: Math.max(c, 0), tipo: 'objetos', params: { orden: { ...orden } } }]);
    };
    if (this.sesion.aplicarEnCiclo)
      return this.sesion.aplicarEnCiclo([m]).then(
        (c) => registrar(c),
        () => registrar(),
      );
    this.sesion.c.enviar(m);
    registrar();
    return Promise.resolve();
  }

  /**
   * Los objetos de la sim como órdenes: los del escenario con que arrancó
   * más las órdenes en caliente (plegarObjetos). null sin escenario.
   */
  objetosActuales() {
    const e = this.#datos.escenario;
    if (!e) return null;
    return plegarObjetos(e.objetos, this.#datos.eventos);
  }

  /**
   * «Guardar en el escenario»: los objetos actuales (objetosActuales) pasan
   * a ser los del escenario efectivo (el que ve Experimentar y el que
   * arrancaría una sim nueva desde él). El escenario con que arrancó la
   * corrida no cambia de contenido (las réplicas lo usan con los eventos:
   * sumarle los objetos los repetiría); se publica una copia para que las
   * vistas que lo siguen se actualicen. Se guarda con la corrida (hasta
   * entonces, la corrida queda sin guardar: sinGuardar). null sin
   * escenario.
   */
  guardarObjetosEnEscenario() {
    const r = this.objetosActuales();
    if (!r) return null;
    this.#datos.objetosEscenario = structuredClone(r.objetos);
    this.#datos.escenario = structuredClone(this.#datos.escenario);
    this.#guardado = { ...this.#guardado, objetos: true };
    this.#publicarDatos();
    return r;
  }

  /**
   * Siembra una especie en la sim actual y la registra como evento de la
   * corrida (tipo 'siembra': una réplica la repite en el mismo ciclo). Con
   * sesion.aplicarEnCiclo la siembra va en un ciclo exacto y el evento se
   * registra cuando el worker lo confirma; sin él, en el ciclo de la sesión.
   * @param {{ nombre: string, adn: string, cantidad: number, color: string, vegetal: boolean,
   *   energia?: number }} sp
   * @returns {Promise<void>}
   */
  sembrar(sp) {
    const nombre = sinTxt(sp.nombre.trim()) || 'bot';
    const cantidad = Math.max(1, Math.trunc(sp.cantidad) || 1);
    const energia = sp.energia ?? 3000;
    const especie = {
      nombre,
      adn: sp.adn,
      cantidad,
      color: sp.color,
      vegetal: !!sp.vegetal,
      energia,
    };
    this.#conocidas.add(nombre);
    this.#adnLocal.set(`${nombre}.txt`, sp.adn);
    this.estado.colores = { ...this.estado.colores, [nombre]: sp.color };
    const semilla = {
      dna: sp.adn,
      name: `${nombre}.txt`,
      veg: !!sp.vegetal,
      qty: cantidad,
      nrg: energia,
      color: cssAVb(sp.color),
    };
    const datos = this.#datos;
    /** @param {number} [ciclo] */
    const registrar = (ciclo) => {
      if (this.#datos !== datos) return; // otra sim mientras tanto
      const c = this.#cicloEvento(ciclo);
      try {
        registrarSiembra(this.#datos, c, especie);
        this.estado.eventos = structuredClone(this.#datos.eventos);
      } catch {
        // una especie que el registro no acepta (p. ej. color no #rrggbb)
        // se siembra igual; solo no queda para las réplicas
      }
      this.#alFeed([
        { ciclo: Math.max(c, 0), tipo: 'sembrado', params: { especie: nombre, n: cantidad } },
      ]);
      this.sesion.redibujar?.();
    };
    if (this.sesion.aplicarEnCiclo)
      return this.sesion.aplicarEnCiclo([{ t: 'seed-species', sp: semilla }]).then(
        (c) => registrar(c),
        () => registrar(),
      );
    this.sesion.c.seedSpecies(semilla);
    registrar();
    return Promise.resolve();
  }

  /**
   * Hay algo que se perdería al reemplazar la sim: una corrida sin guardar
   * que ya avanzó o tuvo eventos, o una guardada que siguió después (o a
   * la que se le guardaron objetos en el escenario).
   */
  sinGuardar() {
    if (!this.sesion.hayMundo) return false;
    if (this.#guardado.objetos) return true;
    const ciclo = Math.trunc(this.sesion.stats.cycle) || 0;
    const nEventos = this.#datos.eventos.length;
    if (this.#guardado.ciclo < 0) return ciclo > 0 || nEventos > 0;
    return ciclo !== this.#guardado.ciclo || nEventos !== this.#guardado.eventos;
  }

  /** .dbsim con el ciclo en que el worker lo armó. */
  async #foto() {
    if (this.sesion.guardarConCiclo) return this.sesion.guardarConCiclo();
    const bytes = await this.sesion.guardar();
    return { bytes, cycle: Math.trunc(this.sesion.stats.cycle) || 0 };
  }

  /**
   * Guarda la corrida (y su .dbsim) en IndexedDB. Si ya estaba guardada, la
   * sobrescribe, salvo con `comoNueva` (otra corrida, la actual pasa a ser
   * esa). Con la sim corriendo, lo guardado es la foto del ciclo en que el
   * worker armó el .dbsim: la historia, el feed y los eventos se recortan a
   * ese ciclo. Si falla, la corrida queda como estaba (nombre incluido).
   * @param {string} [nombre] @param {{ comoNueva?: boolean }} [o]
   */
  async guardar(nombre, o = {}) {
    this.estado.ocupado = 'guardando';
    try {
      const { bytes, cycle } = await this.#foto();
      const ciclo = Math.trunc(cycle) || 0;
      const n =
        (nombre ?? '').trim() || this.#datos.nombre || this.#d.nombrePorDefecto?.() || 'DarwinBots';
      const eventos = this.#datos.eventos.filter((e) => e.ciclo <= ciclo);
      // Historia y linaje hasta el ciclo del .dbsim (copias: la corrida sigue).
      const hist = Historia.deserializar(this.#hist.serializar());
      hist.recortar(ciclo);
      const lin = Linaje.deserializar(this.#lin.serializar());
      lin.recortar(ciclo);
      /** @type {EventoFeed} */
      const evGuardada = { ciclo, tipo: 'guardada', params: { nombre: n } };
      // El feed se guarda UNA vez: son los eventos de la historia (al
      // cargar, el feed son los últimos MAX_FEED de ellos).
      hist.evento(evGuardada);
      const vivo = this.estado.vivo;
      const ultima = muestrasDeHistoria(hist, Number.POSITIVE_INFINITY).at(-1);
      let bots = this.sesion.stats.bots;
      /** @type {string[]} */
      let especies = [];
      if (vivo && vivo.ciclo <= ciclo) {
        bots = vivo.vivos;
        especies = vivo.porEspecie ? vivo.especies.map((e) => e.nombre) : [];
      } else if (ultima) {
        bots = Math.round(ultima.total);
        especies = Object.keys(ultima.especies).filter((k) => ultima.especies[k] > 0);
      }
      const { feed: _f, historia: _h, ...datos } = /** @type {any} */ (this.#datos);
      const c = { ...datos, nombre: n, eventos };
      if (o.comoNueva) {
        delete c.id;
        c.marcada = 0;
      }
      const r = await this.#d.corridas.guardar(c, {
        dbsim: bytes,
        ciclo,
        bots,
        especies,
        miniatura: this.#d.miniatura?.(),
        extra: { historia: hist.serializar(), linaje: lin.serializar() },
      });
      this.#datos.nombre = n;
      this.#datos.id = r.id;
      if (o.comoNueva) this.#datos.marcada = 0;
      this.#guardado = { ciclo, eventos: eventos.length };
      this.#publicarDatos();
      this.#alFeed([evGuardada]);
      return r;
    } finally {
      this.estado.ocupado = '';
    }
  }

  /**
   * Carga una corrida guardada: su .dbsim en la sesión, el ADN de sus
   * especies (dna-missing) y su escenario, semilla, eventos, feed e
   * historia. No arranca la sim. Devuelve la corrida, o null si otra
   * operación empezó mientras leía el almacén. Lanza ErrorCorrida
   * ('inexistente', 'sinDbsim') o el error de la carga.
   * @param {string} id
   */
  async cargar(id) {
    const op = this.#tomarOp();
    this.estado.ocupado = 'cargando';
    try {
      const r = await this.#d.corridas.cargar(id);
      if (op !== this.#op) return null;
      if (!r) throw new ErrorCorrida('inexistente', id);
      if (!r.dbsim) throw new ErrorCorrida('sinDbsim', id);
      // Corridas guardadas antes de C14 traen feed e historia en los metadatos.
      const {
        feed: feedViejo = [],
        historia: histVieja,
        ...datos
      } = /** @type {any} */ (r.corrida);
      const extra = /** @type {any} */ (r).extra ?? {};
      const historia = extra.historia ?? histVieja;
      const hist = historia
        ? Historia.deserializar(historia)
        : new Historia({ intervalo: this.#d.muestreo?.cada });
      // Corridas guardadas antes de un solo feed: el feed iba aparte
      // (extra.feed o, antes de C14, en los metadatos). Lo que la historia
      // no tenga pasa a sus eventos.
      migrarFeed(hist, extra.feed ?? feedViejo);
      const feed = feedDeHistoria(hist);
      this.#nuevaSim();
      this.#datos = datos;
      this.#recordarAdnDe(datos);
      const carga = this.sesion.cargar(r.dbsim);
      this.sesion.seleccionar(0);
      this.#activarMuestreo();
      this.sesion.redibujar?.();
      this.#conocidas = new Set(datos.especies ?? []);
      this.#reiniciarVivo(hist, extra.linaje ? Linaje.deserializar(extra.linaje) : undefined);
      this.#trasCarga = true;
      this.#guardado = { ciclo: datos.ciclo ?? 0, eventos: (datos.eventos ?? []).length };
      this.#publicarDatos();
      this.estado.feed = feed;
      this.#alFeed([
        { ciclo: datos.ciclo ?? 0, tipo: 'cargada', params: { nombre: datos.nombre } },
      ]);
      const info = await carga;
      await this.#esperarAdn(info ? info.missing : undefined);
      if (op === this.#op) this.#restaurarGlobales();
      return { ...datos, feed, historia };
    } finally {
      this.#terminar(op, 'cargando');
    }
  }

  /**
   * Carga un .dbsim suelto (de un archivo): corrida nueva sin escenario.
   * Espera la respuesta del worker: si el archivo no es una simulación (la
   * carga deja una sim vacía en el ciclo 0), lanza
   * ErrorCorrida('dbsimInvalido'). Devuelve false si otra operación empezó
   * mientras tanto.
   * @param {Uint8Array | ArrayBuffer} bytes @param {string} nombre
   * @returns {Promise<boolean>}
   */
  async importarDbsim(bytes, nombre) {
    const op = this.#tomarOp();
    this.estado.ocupado = 'cargando';
    try {
      const carga = this.sesion.cargar(bytes);
      this.sesion.seleccionar(0);
      this.#activarMuestreo();
      this.sesion.redibujar?.();
      const n = String(nombre ?? '').replace(/\.dbsim$/i, '') || 'DarwinBots';
      this.#datos = corridaSuelta(n, null);
      this.#conocidas = new Set();
      this.#nuevaSim();
      this.#guardado = { ciclo: -1, eventos: 0 };
      this.#reiniciarVivo();
      this.#publicarDatos();
      this.estado.feed = [];
      this.#alFeed([{ ciclo: 0, tipo: 'importada', params: { nombre: n } }]);
      this.#sinCiclo = this.estado.feed[0];
      const info = await carga;
      if (op !== this.#op) return false;
      if (info && info.bots === 0 && info.cycle <= 0) {
        this.#datos = corridaSuelta('', null);
        this.#publicarDatos();
        this.estado.feed = [];
        throw new ErrorCorrida('dbsimInvalido', n);
      }
      await this.#esperarAdn(info ? info.missing : undefined);
      // Recién importada no hay nada que perder: es lo que dice el archivo.
      if (info) this.#guardado = { ciclo: info.cycle, eventos: 0 };
      return true;
    } finally {
      this.#terminar(op, 'cargando');
    }
  }

  /** Descarga el .dbsim de la sim actual. */
  async exportarDbsim() {
    const { bytes } = await this.#foto();
    this.#d.descargar?.(bytes, this.#datos.nombre || this.#d.nombrePorDefecto?.() || 'DarwinBots');
    return bytes;
  }

  /** Mensajes que repiten los eventos de la corrida (réplicas, decisión 13). */
  mensajesEventos() {
    return this.#datos.eventos.map((ev) => ({ ciclo: ev.ciclo, mensajes: mensajesEvento(ev) }));
  }
}
