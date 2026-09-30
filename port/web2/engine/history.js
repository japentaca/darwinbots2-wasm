// @ts-check
// Historia de una corrida con presupuesto (decisión 8 de port/web2/PLAN.md),
// sin DOM. Se alimenta con las muestras del worker ({t:'muestra'}, una cada
// `intervalo` ciclos: 100 por defecto) y guarda:
//
//   - series globales: las 56 métricas de db_sim_metrics (METRICAS);
//   - series por especie (por NOMBRE, sin «.txt»): los campos de
//     db_sim_species_stats (GUARDADOS_ESPECIE) y los del acumulador de
//     comportamiento (GUARDADOS_COMPORTAMIENTO);
//   - fotos de los 9 histogramas (grupo Genética);
//   - eventos (lo que la corrida registre), aparte y sin reducir.
//
// Presupuesto: cada serie tiene a lo sumo `maxPuntos` puntos (~2.000) y la
// historia serializada entera (series, histogramas, nombres, eventos y el
// JSON del resto) a lo sumo `maxBytes` (5 MB). Al pasarse, los puntos se
// funden de a dos, de los más viejos a los más nuevos, con resolución
// PAREJA en el tiempo: hay un `nivel` (muestras por punto, 1, 2, 4…); una
// ronda de fusión lleva los puntos de nivel a 2·nivel empezando por los
// más viejos y cada fusión sigue donde quedó la anterior; al terminar la
// ronda el nivel se duplica. El último punto es siempre la última muestra,
// sola (no se funde nunca: su valor es el último medido); al llegar la
// siguiente pasa al penúltimo, el punto «en curso», mientras éste no junte
// `nivel`. Así todo punto junta nivel o 2·nivel muestras (dura a lo sumo el
// doble que el más corto; salvo el en curso y el último), en vez de que la
// mitad vieja se funda una y otra vez. Cada punto fundido
// guarda la media ponderada por la cantidad de muestras que junta, el
// mínimo y el máximo; su ciclo es el de su primera muestra. Se funden de
// una vez los pares que hacen falta para bajar al 90 % de los puntos o al
// 95 % de los bytes (no en cada muestra). Todas las series comparten el eje
// de tiempo global (la «pista» global: t y n = muestras por punto) y se
// funden a la vez, así las series de las especies quedan alineadas con las
// globales.
//
// Los eventos no se reducen, pero tienen su tope propio (`maxBytesEventos`,
// 512 KB dentro de los 5 MB): pasado ese tope se descartan los más viejos y
// se cuentan en `eventosDescartados` (el feed de una corrida normal son
// unos cientos de eventos de ~80 B: el tope no se alcanza en la práctica,
// pero garantiza que los eventos no se coman el lugar de las series).
//
// Especies que aparecen y desaparecen: la pista de una especie empieza en
// el punto global en que apareció (`desde`) y guarda en cada punto cuántas
// de sus muestras estuvieron presentes (n = 0: ausente). Una especie
// ausente no ocupa lugar: si reaparece, el hueco se rellena con n = 0.
// `serie()` devuelve solo los puntos presentes. El comportamiento de una
// especie viva sin actividad cuenta 0 (el core solo vuelca filas con algo),
// y el de una que murió en el intervalo se guarda aunque ya no esté viva.
//
// Serialización (v2; IndexedDB guarda typed arrays tal cual, sin base64):
// t en Float64Array; por pista, n en Uint32Array y las medias en
// Float32Array (columna tras columna). Las bandas (mínimo y máximo) solo
// existen en las pistas global y de especie, y solo para el prefijo de
// puntos fundidos (`kf`: hasta el último punto con n > 1; en los demás el
// mínimo y el máximo son la media): por columna, una escala Float32 (la
// mayor distancia media→extremo del prefijo) y dos Uint8Array con esa
// distancia en 255avos de la escala, redondeada hacia afuera (la banda
// guardada siempre contiene a la verdadera; el error es ≤ 1/255 de la
// banda más ancha de la columna, menos de un píxel en un gráfico). El
// comportamiento no guarda bandas: son conteos por intervalo y lo que se
// grafica es su media (su mínimo y su máximo se devuelven iguales a la
// media).
//
// Por qué así: fundir SIEMPRE achica. Por columna, dos puntos sin fundir
// ocupan 4 + 4 B y el fundido 4 + 1 + 1 B (6 B; en el comportamiento, 4 B);
// dos fundidos, 12 B → 6 B; y t y n pierden un valor por par. La escala va
// siempre (4 B por columna y pista, fundida o no), así que la primera fusión
// no agrega nada. La versión 1 (mín/máx Float32 del prefijo, también en el
// comportamiento) agrandaba la historia al fundir puntos sin fundir
// (8 B → 12 B) y se sigue leyendo.
//
// Medido (test/history.test.js, especies presentes todo el tiempo, los seis
// grupos e histogramas de 20 barras; muestra cada 100 ciclos):
//   especies   50.000 ciclos         400.000 ciclos
//        20    501 puntos, 2,19 MB   869 puntos, 4,59 MB
//        30    501 puntos, 3,17 MB   575 puntos, 4,47 MB
//        50    449 puntos, 4,73 MB   378 puntos, 4,80 MB
//       100    179 puntos, 4,51 MB   180 puntos, 4,53 MB
// Con nivel ≥ 2 un punto con 20 especies ocupa ~5,4 KB (1.036 valores
// Float32 + bandas): en 5 MB entran ~900. ~2.000 puntos con 20-30 especies
// exigirían ~2,5 KB por punto, menos de 2 B por valor: no entran sin
// cuantizar también las medias, cosa que esta historia no hace.

import {
  CAMPOS_COMPORTAMIENTO,
  CAMPOS_ESPECIE,
  esCadaver,
  GUARDADOS_COMPORTAMIENTO,
  GUARDADOS_ESPECIE,
  HISTOGRAMAS,
  IM,
  METRICAS,
  nombreEspecie,
} from './metricas.js';

export const INTERVALO = 100;
export const MAX_PUNTOS = 2000;
export const MAX_BYTES = 5 * 1024 * 1024;
/** Tope de los eventos (dentro de MAX_BYTES; se descartan los más viejos). */
export const MAX_BYTES_EVENTOS = 512 * 1024;
export const MAX_HISTOGRAMAS = 200;
/** Por debajo de esto no se funde por bytes (solo por puntos). */
const MIN_PUNTOS_FUSION = 16;
const VERSION = 2;

/** Columnas guardadas de cada pista (nombres). */
const COLS_GLOBAL = METRICAS.map((m) => m.clave);
const COLS_ESPECIE = GUARDADOS_ESPECIE.map((i) => CAMPOS_ESPECIE[i]);
const COLS_COMP = GUARDADOS_COMPORTAMIENTO.map((i) => CAMPOS_COMPORTAMIENTO[i]);

const utf8 = new TextEncoder();
/** Bytes UTF-8 del JSON de un valor. @param {any} v */
const bytesJson = (v) => utf8.encode(JSON.stringify(v) ?? '').length;
/**
 * Cota del JSON de una pista serializada sin su nombre (claves y números
 * sueltos: {"nombre":"","desde":…,"kf":…,"n":0,"media":0,"escala":0,…}).
 */
const JSON_PISTA = 120;
/** Cota del JSON fijo (versión, topes, columnas, claves de los histogramas). */
const JSON_FIJO =
  bytesJson({ global: COLS_GLOBAL, especie: COLS_ESPECIE, comportamiento: COLS_COMP }) + 600;

/**
 * @typedef {object} Pista
 * @property {number} desde     índice global del primer punto (0 en la global)
 * @property {number[]} n       muestras presentes por punto
 * @property {number[][]} media por columna
 * @property {number[][] | null} min  null = sin bandas (comportamiento)
 * @property {number[][] | null} max
 * @property {number} kf        puntos del prefijo fundido (1 + el último con n > 1)
 */

/**
 * @typedef {object} MuestraHistoria  lo que usa de {t:'muestra'} del worker
 * @property {number} ciclo
 * @property {ArrayLike<number>} metrics   56 valores
 * @property {{nombre: string, stats: ArrayLike<number>}[]} [especies]
 * @property {{nombre: string, datos: ArrayLike<number>}[] | null} [comportamiento]
 * @property {{bins: number, n: ArrayLike<number>, datos: ArrayLike<number>} | null} [histogramas]
 */

/**
 * @typedef {object} Serie
 * @property {number[]} t      ciclo de la primera muestra de cada punto
 * @property {number[]} media
 * @property {number[]} min
 * @property {number[]} max
 * @property {number[]} n      muestras que junta cada punto
 */

/** @param {number} cols @param {number} [desde] @param {boolean} [bandas] @returns {Pista} */
function pistaNueva(cols, desde = 0, bandas = true) {
  const vacias = () => Array.from({ length: cols }, () => /** @type {number[]} */ ([]));
  return {
    desde,
    n: [],
    media: vacias(),
    min: bandas ? vacias() : null,
    max: bandas ? vacias() : null,
    kf: 0,
  };
}

/**
 * Agrega un punto (n = 1 si hay valores; n = 0 = ausente).
 * @param {Pista} p @param {ArrayLike<number> | null} vals @param {readonly number[] | null} idx
 */
function empujar(p, vals, idx) {
  const cols = p.media.length;
  p.n.push(vals ? 1 : 0);
  for (let c = 0; c < cols; c++) {
    const v = vals ? Number(vals[idx ? idx[c] : c]) : Number.NaN;
    p.media[c].push(v);
    if (p.min && p.max) {
      p.min[c].push(v);
      p.max[c].push(v);
    }
  }
}

/** Puntos del prefijo que llevan bandas propias: 1 + el último con n > 1. @param {number[]} n */
function prefijoFundido(n) {
  for (let j = n.length - 1; j >= 0; j--) if (n[j] > 1) return j + 1;
  return 0;
}

/**
 * Funde en su lugar el punto global g + 1 (el último) en el g: el camino
 * rápido de fundirPista(p, g, 1) cuando los dos son la cola de la pista.
 * @param {Pista} p @param {number} g
 */
function juntarUltimo(p, g) {
  const j = g - p.desde;
  const len = p.n.length;
  // sin el punto g + 1 (su último es otro): nada que fundir
  if (j + 1 !== len - 1) return;
  // empieza en g + 1: su primer punto pasa a ser el g
  if (j < 0) {
    p.desde = g;
    return;
  }
  const nb = p.n[j + 1];
  const na = p.n[j];
  const cols = p.media.length;
  if (nb > 0)
    for (let c = 0; c < cols; c++) {
      const v = p.media[c][j + 1];
      p.media[c][j] = na === 0 ? v : (p.media[c][j] * na + v * nb) / (na + nb);
      if (p.min && p.max) {
        p.min[c][j] = na === 0 ? p.min[c][j + 1] : Math.min(p.min[c][j], p.min[c][j + 1]);
        p.max[c][j] = na === 0 ? p.max[c][j + 1] : Math.max(p.max[c][j], p.max[c][j + 1]);
      }
    }
  p.n[j] = na + nb;
  p.n.length = len - 1;
  for (const a of [p.media, p.min ?? [], p.max ?? []]) for (const col of a) col.length = len - 1;
  p.kf = prefijoFundido(p.n);
}

/**
 * Funde de a dos los `pares` pares de puntos globales que empiezan en `a`
 * ([a, a + 2·pares)): el global g de la ventana pasa a a + (g − a) >> 1; los
 * de después se corren `pares` lugares; los de antes quedan igual.
 * @param {Pista} p @param {number} a @param {number} pares
 */
function fundirPista(p, a, pares) {
  const fin = a + 2 * pares;
  /** @param {number} g */
  const destino = (g) => (g < a ? g : g < fin ? a + ((g - a) >> 1) : g - pares);
  const nuevoDesde = destino(p.desde);
  const len = p.n.length;
  if (!len || p.desde >= fin || p.desde + len <= a) {
    p.desde = nuevoDesde;
    return;
  }
  const cols = p.media.length;
  const conBandas = !!(p.min && p.max);
  /** @type {number[]} */
  const n = [];
  const vacias = () => Array.from({ length: cols }, () => /** @type {number[]} */ ([]));
  const media = vacias();
  const min = conBandas ? vacias() : null;
  const max = conBandas ? vacias() : null;
  for (let j = 0; j < len; j++) {
    const k = destino(p.desde + j) - nuevoDesde;
    const nj = p.n[j];
    if (k === n.length) {
      n.push(nj);
      for (let c = 0; c < cols; c++) media[c].push(p.media[c][j]);
      if (min && max && p.min && p.max)
        for (let c = 0; c < cols; c++) {
          min[c].push(p.min[c][j]);
          max[c].push(p.max[c][j]);
        }
      continue;
    }
    // mismo punto nuevo que el anterior: fundir (media ponderada por n)
    const na = n[k];
    if (nj === 0) continue;
    const tot = na + nj;
    for (let c = 0; c < cols; c++)
      media[c][k] = na === 0 ? p.media[c][j] : (media[c][k] * na + p.media[c][j] * nj) / tot;
    if (min && max && p.min && p.max)
      for (let c = 0; c < cols; c++) {
        min[c][k] = na === 0 ? p.min[c][j] : Math.min(min[c][k], p.min[c][j]);
        max[c][k] = na === 0 ? p.max[c][j] : Math.max(max[c][k], p.max[c][j]);
      }
    n[k] = tot;
  }
  p.desde = nuevoDesde;
  p.n = n;
  p.media = media;
  p.min = min;
  p.max = max;
  p.kf = prefijoFundido(n);
}

/** Bytes serializados de una pista (sin el JSON). @param {Pista} p */
function bytesPista(p) {
  const len = p.n.length;
  const cols = p.media.length;
  const bandas = p.min ? cols * 4 + cols * p.kf * 2 : 0;
  return len * 4 + cols * len * 4 + bandas;
}

/** Escala Float32 ≥ s (fround redondea al más cercano). @param {number} s */
const escalaF32 = (s) => {
  const e = Math.fround(s);
  return e >= s ? e : Math.fround(s * (1 + 2 ** -22));
};

/**
 * Pista → objeto compacto.
 * @param {Pista} p
 */
function serializarPista(p) {
  const len = p.n.length;
  const cols = p.media.length;
  const media = new Float32Array(cols * len);
  for (let c = 0; c < cols; c++) media.set(p.media[c], c * len);
  /** @type {Record<string, any>} */
  const o = { desde: p.desde, n: Uint32Array.from(p.n), media };
  if (!p.min || !p.max) return o;
  const kf = p.kf;
  const escala = new Float32Array(cols);
  const lo = new Uint8Array(cols * kf);
  const hi = new Uint8Array(cols * kf);
  /** @param {number} d @param {number} e */
  const q = (d, e) =>
    d > 0 && e > 0 && Number.isFinite(d) ? Math.min(255, Math.ceil((d / e) * 255 - 1e-9)) : 0;
  for (let c = 0; c < cols; c++) {
    const b = c * len;
    let s = 0;
    for (let j = 0; j < kf; j++) {
      const m = media[b + j];
      const dl = m - p.min[c][j];
      const dh = p.max[c][j] - m;
      if (dl > s && Number.isFinite(dl)) s = dl;
      if (dh > s && Number.isFinite(dh)) s = dh;
    }
    const e = escalaF32(s);
    escala[c] = e;
    for (let j = 0; j < kf; j++) {
      const m = media[b + j];
      lo[c * kf + j] = q(m - p.min[c][j], e);
      hi[c * kf + j] = q(p.max[c][j] - m, e);
    }
  }
  return { ...o, kf, escala, lo, hi };
}

/**
 * Objeto compacto → pista. Lee la v2 (escala + Uint8) y la v1 (mín/máx
 * Float32 del prefijo). `bandas = false` descarta las bandas guardadas.
 * @param {any} o @param {number} cols @param {boolean} bandas
 * @returns {Pista}
 */
function deserializarPista(o, cols, bandas) {
  const len = o.n.length;
  const p = pistaNueva(cols, o.desde, bandas);
  p.n = Array.from(o.n);
  const kf = Math.min(len, o.kf ?? 0);
  for (let c = 0; c < cols; c++) {
    const m = Array.from({ length: len }, (_, j) => o.media[c * len + j]);
    p.media[c] = m;
    if (!p.min || !p.max) continue;
    if (o.escala) {
      const e = o.escala[c];
      p.min[c] = m.map((v, j) => (j < kf ? v - (o.lo[c * kf + j] * e) / 255 : v));
      p.max[c] = m.map((v, j) => (j < kf ? v + (o.hi[c * kf + j] * e) / 255 : v));
    } else if (o.min && o.max) {
      p.min[c] = m.map((v, j) => (j < kf ? o.min[c * o.kf + j] : v));
      p.max[c] = m.map((v, j) => (j < kf ? o.max[c * o.kf + j] : v));
    } else {
      p.min[c] = m.slice();
      p.max[c] = m.slice();
    }
  }
  p.kf = prefijoFundido(p.n);
  return p;
}

/**
 * Serie de una pista alineada con t global (solo los puntos presentes).
 * @param {Pista} p @param {number} c @param {number[]} t @param {boolean} [conAusentes]
 * @returns {Serie}
 */
function seriePista(p, c, t, conAusentes = false) {
  /** @type {Serie} */
  const s = { t: [], media: [], min: [], max: [], n: [] };
  const min = p.min ? p.min[c] : p.media[c];
  const max = p.max ? p.max[c] : p.media[c];
  for (let j = 0; j < p.n.length; j++) {
    if (!p.n[j] && !conAusentes) continue;
    s.t.push(t[p.desde + j]);
    s.media.push(p.media[c][j]);
    s.min.push(min[j]);
    s.max.push(max[j]);
    s.n.push(p.n[j]);
  }
  return s;
}

export class Historia {
  intervalo;
  maxPuntos;
  maxBytes;
  maxBytesEventos;
  maxHistogramas;
  /** @type {number[]} ciclo de la primera muestra de cada punto global */
  t = [];
  /** pista global (desde = 0; n = muestras por punto) */
  global = pistaNueva(COLS_GLOBAL.length);
  /** @type {Map<string, Pista>} especie → campos de db_sim_species_stats */
  especies = new Map();
  /** @type {Map<string, Pista>} especie → comportamiento acumulado por muestra (sin bandas) */
  comportamiento = new Map();
  /** @type {{ciclo: number, bins: number, n: number[], datos: Float32Array}[]} */
  histogramas = [];
  /** @type {any[]} eventos de la corrida, sin reducir (tope: maxBytesEventos) */
  eventos = [];
  /** eventos viejos descartados por el tope de bytes de los eventos */
  eventosDescartados = 0;
  /**
   * Muestras por punto de la ronda actual: un punto nuevo junta hasta
   * `nivel` muestras; la fusión lleva los puntos de `nivel` a 2·nivel, de
   * los más viejos a los más nuevos, y al terminar la ronda lo duplica.
   */
  nivel = 1;
  /** ciclo de la última muestra agregada (−1 = ninguna) */
  #ultima = -1;
  /** bytes del JSON de `eventos` (aprox.: uno más por evento por la coma) */
  #bytesEventos = 2;
  /** bytes del JSON de los nombres de las pistas de especie y comportamiento */
  #bytesNombres = 0;

  /**
   * @param {{intervalo?: number, maxPuntos?: number, maxBytes?: number,
   *   maxBytesEventos?: number, maxHistogramas?: number}} [o]
   */
  constructor(o = {}) {
    this.intervalo = o.intervalo ?? INTERVALO;
    this.maxPuntos = Math.max(8, o.maxPuntos ?? MAX_PUNTOS);
    this.maxBytes = o.maxBytes ?? MAX_BYTES;
    this.maxBytesEventos = Math.max(1024, o.maxBytesEventos ?? MAX_BYTES_EVENTOS);
    this.maxHistogramas = Math.max(4, o.maxHistogramas ?? MAX_HISTOGRAMAS);
  }

  /** Puntos del eje global. */
  get puntos() {
    return this.t.length;
  }

  /** Ciclo de la última muestra agregada (−1 si no hay). */
  get ultimoCiclo() {
    return this.#ultima;
  }

  /**
   * Agrega una muestra. Tiene que ser posterior a la última (si no, no hace
   * nada y devuelve false: para otra sim, crear otra historia o recortar).
   * Va siempre a un punto nuevo (el último); la anterior pasa antes al punto
   * en curso si éste todavía no junta `nivel` muestras.
   * @param {MuestraHistoria} m
   */
  agregar(m) {
    if (!(m.ciclo > this.ultimoCiclo)) return false;
    // la muestra anterior (sola en el último punto) pasa al punto en curso
    // si éste todavía no junta `nivel`
    const len = this.t.length;
    if (len >= 2 && this.global.n[len - 2] < this.nivel) this.#juntarUltimo();
    const g = this.t.length;
    this.t.push(m.ciclo);
    this.#ultima = m.ciclo;
    empujar(this.global, m.metrics, null);

    /** @type {Set<string>} */
    const vivas = new Set();
    for (const e of m.especies ?? []) {
      const nombre = nombreEspecie(e.nombre);
      if (!nombre || esCadaver(nombre) || vivas.has(nombre)) continue;
      vivas.add(nombre);
      empujar(
        this.#pista(this.especies, nombre, COLS_ESPECIE.length, g, true),
        e.stats,
        GUARDADOS_ESPECIE,
      );
    }
    if (m.comportamiento) {
      /** @type {Map<string, ArrayLike<number>>} */
      const filas = new Map();
      for (const r of m.comportamiento) {
        const nombre = nombreEspecie(r.nombre);
        if (nombre && !esCadaver(nombre)) filas.set(nombre, r.datos);
      }
      const ceros = new Float32Array(CAMPOS_COMPORTAMIENTO.length);
      for (const nombre of new Set([...vivas, ...filas.keys()])) {
        const p = this.#pista(this.comportamiento, nombre, COLS_COMP.length, g, false);
        empujar(p, filas.get(nombre) ?? ceros, GUARDADOS_COMPORTAMIENTO);
      }
    }
    if (m.histogramas) this.#agregarHistogramas(m.ciclo, m.histogramas);
    this.#presupuesto();
    return true;
  }

  /** Funde el último punto global en el anterior (todas las pistas). */
  #juntarUltimo() {
    const g = this.t.length - 2;
    this.t.length = g + 1;
    juntarUltimo(this.global, g);
    for (const p of this.especies.values()) juntarUltimo(p, g);
    for (const p of this.comportamiento.values()) juntarUltimo(p, g);
  }

  /**
   * Tope de puntos y de bytes. Al pasarse, funde de una vez los pares que
   * hacen falta para bajar al 90 % de los puntos o al 95 % de los bytes (así
   * no se funde en cada muestra): la cantidad se calcula de antemano con el
   * ahorro por par (cada par fundido ahorra al menos un cuarto de sus
   * bytes; si no alcanzó, se repite).
   */
  #presupuesto() {
    if (this.t.length > this.maxPuntos)
      while (this.t.length > Math.floor(this.maxPuntos * 0.9))
        if (!this.fundir(this.t.length - Math.floor(this.maxPuntos * 0.9))) break;
    for (let b = this.bytesEstimados(); b > this.maxBytes; b = this.bytesEstimados()) {
      const len = this.t.length;
      if (len < MIN_PUNTOS_FUSION) break;
      const fijo = this.#bytesFijos();
      const porPunto = Math.max(1, (b - fijo) / len);
      const objetivo = Math.min(this.maxBytes * 0.95, this.maxBytes - porPunto);
      const pares = Math.ceil((b - objetivo) / (porPunto * 0.5));
      if (!this.fundir(Math.max(1, Math.min(pares, len >> 2)))) break;
    }
  }

  /**
   * La pista de `nombre` lista para recibir el punto global g (rellena con
   * ausentes lo que falte).
   * @param {Map<string, Pista>} mapa @param {string} nombre @param {number} cols
   * @param {number} g @param {boolean} bandas
   */
  #pista(mapa, nombre, cols, g, bandas) {
    let p = mapa.get(nombre);
    if (!p) {
      p = pistaNueva(cols, g, bandas);
      mapa.set(nombre, p);
      this.#bytesNombres += bytesJson(nombre) + JSON_PISTA;
    }
    while (p.desde + p.n.length < g) empujar(p, null, null);
    return p;
  }

  /** @param {number} ciclo @param {{bins: number, n: ArrayLike<number>, datos: ArrayLike<number>}} h */
  #agregarHistogramas(ciclo, h) {
    this.histogramas.push({
      ciclo,
      bins: h.bins,
      n: Array.from(h.n),
      datos: Float32Array.from(h.datos),
    });
    if (this.histogramas.length > this.maxHistogramas) {
      // una de cada dos en la mitad más vieja
      const mitad = this.histogramas.length >> 1;
      this.histogramas = [
        ...this.histogramas.slice(0, mitad).filter((_, i) => i % 2 === 0),
        ...this.histogramas.slice(mitad),
      ];
    }
  }

  /**
   * Funde de a dos (todas las pistas a la vez) hasta `pares` pares de la
   * ronda actual, siguiendo desde donde quedó la anterior: los puntos que
   * ya juntan 2·nivel muestras van primero y los pares se toman a
   * continuación, hacia los más nuevos. El último punto (la última muestra,
   * sola) no se funde nunca; si queda uno suelto antes que él, es el punto
   * en curso de la ronda siguiente. Sin
   * argumento termina la ronda (todos los pares que quedan). Al terminar una
   * ronda el nivel se duplica. Así la resolución queda pareja en el tiempo:
   * todo punto junta nivel o 2·nivel muestras (salvo el en curso y el último).
   * Siempre achica la historia serializada (ver la cabecera). Devuelve los
   * pares fundidos.
   * @param {number} [pares]
   */
  fundir(pares = Number.POSITIVE_INFINITY) {
    let hechos = 0;
    while (hechos < pares) {
      const len = this.t.length;
      if (len < 3) break; // hacen falta dos puntos además del último
      const n = this.global.n;
      let a = 0;
      while (a < len - 1 && n[a] >= 2 * this.nivel) a++;
      const disponibles = (len - 1 - a) >> 1;
      if (!disponibles) {
        // ronda terminada (a lo sumo quedó suelto el punto en curso)
        this.nivel *= 2;
        if (pares === Number.POSITIVE_INFINITY && hechos) break;
        continue;
      }
      const p = Math.min(disponibles, pares - hechos);
      /** @type {number[]} */
      const t = this.t.slice(0, a);
      for (let g = a; g < a + 2 * p; g += 2) t.push(this.t[g]);
      this.t = [...t, ...this.t.slice(a + 2 * p)];
      fundirPista(this.global, a, p);
      for (const x of this.especies.values()) fundirPista(x, a, p);
      for (const x of this.comportamiento.values()) fundirPista(x, a, p);
      hechos += p;
      if (p === disponibles) {
        this.nivel *= 2;
        if (pares === Number.POSITIVE_INFINITY) break;
      }
    }
    return hechos;
  }

  /**
   * Descarta lo posterior al ciclo c (una sim cargada que empieza en c): los
   * puntos con t > c, los histogramas y los eventos posteriores. Un punto
   * fundido que empezó antes de c se conserva entero.
   * @param {number} c
   */
  recortar(c) {
    if (this.#ultima > c) this.#ultima = c;
    let len = this.t.length;
    while (len > 0 && this.t[len - 1] > c) len--;
    if (len < this.t.length) {
      this.t.length = len;
      /** @param {Pista} p */
      const cortar = (p) => {
        const k = Math.max(0, len - p.desde);
        if (k >= p.n.length) return;
        p.n.length = k;
        for (const a of [p.media, p.min ?? [], p.max ?? []]) for (const col of a) col.length = k;
        p.kf = prefijoFundido(p.n);
      };
      cortar(this.global);
      for (const mapa of [this.especies, this.comportamiento])
        for (const [k, p] of mapa) {
          cortar(p);
          if (!p.n.some((x) => x > 0)) mapa.delete(k);
        }
      this.#recalcularNombres();
    }
    // la última muestra: la del último punto si junta una sola; si junta
    // varias (alguna pudo ser posterior a c y se conserva), c
    const u = this.t.length - 1;
    if (u < 0) this.#ultima = -1;
    else if (this.global.n[u] <= 1) this.#ultima = this.t[u];
    this.histogramas = this.histogramas.filter((x) => x.ciclo <= c);
    this.eventos = this.eventos.filter((e) => !(e?.ciclo > c));
    this.#recalcularEventos();
  }

  /** Agrega un evento (sin reducir; ver el tope de los eventos). @param {any} e */
  evento(e) {
    const copia = structuredClone(e);
    this.eventos.push(copia);
    this.#bytesEventos += bytesJson(copia) + 1;
    while (this.#bytesEventos > this.maxBytesEventos && this.eventos.length > 1) {
      this.#bytesEventos -= bytesJson(this.eventos.shift()) + 1;
      this.eventosDescartados++;
    }
  }

  /**
   * Reemplaza los eventos (en orden de ciclo; con el tope de los eventos).
   * Para migrar corridas viejas que guardaban el feed aparte.
   * @param {any[]} lista
   */
  ponerEventos(lista) {
    this.eventos = [];
    this.eventosDescartados = 0;
    this.#recalcularEventos();
    for (const e of lista) this.evento(e);
  }

  #recalcularEventos() {
    this.#bytesEventos = bytesJson(this.eventos);
  }

  #recalcularNombres() {
    this.#bytesNombres = 0;
    for (const mapa of [this.especies, this.comportamiento])
      for (const k of mapa.keys()) this.#bytesNombres += bytesJson(k) + JSON_PISTA;
  }

  /**
   * Una serie: global (sin especie) o de una especie (campos de especie o de
   * comportamiento). null si no existe. El comportamiento no guarda bandas:
   * su mínimo y su máximo son la media.
   * @param {string} nombre @param {string} [especie]
   * @returns {Serie | null}
   */
  serie(nombre, especie) {
    if (especie === undefined) {
      const c = COLS_GLOBAL.indexOf(nombre);
      return c < 0 ? null : seriePista(this.global, c, this.t);
    }
    const e = nombreEspecie(especie);
    let c = COLS_ESPECIE.indexOf(nombre);
    if (c >= 0) {
      const p = this.especies.get(e);
      return p ? seriePista(p, c, this.t) : null;
    }
    c = COLS_COMP.indexOf(nombre);
    if (c >= 0) {
      const p = this.comportamiento.get(e);
      return p ? seriePista(p, c, this.t) : null;
    }
    return null;
  }

  /**
   * Valor medio de una columna de especie en cada punto global (NaN =
   * ausente), alineado con `t`. Para gráficos apilados.
   * @param {string} nombre @param {string} especie
   * @returns {number[]}
   */
  alineada(nombre, especie) {
    const out = new Array(this.t.length).fill(Number.NaN);
    const e = nombreEspecie(especie);
    let c = COLS_ESPECIE.indexOf(nombre);
    let p = c >= 0 ? this.especies.get(e) : undefined;
    if (c < 0) {
      c = COLS_COMP.indexOf(nombre);
      p = c >= 0 ? this.comportamiento.get(e) : undefined;
    }
    if (!p) return out;
    for (let j = 0; j < p.n.length; j++) if (p.n[j]) out[p.desde + j] = p.media[c][j];
    return out;
  }

  /**
   * Media de una serie global en el último punto con t ≤ c (undefined si no hay).
   * @param {string} nombre @param {number} c
   */
  valorEn(nombre, c) {
    const col = COLS_GLOBAL.indexOf(nombre);
    if (col < 0) return undefined;
    for (let g = this.t.length - 1; g >= 0; g--)
      if (this.t[g] <= c) return this.global.media[col][g];
    return undefined;
  }

  /** Especies con alguna muestra (stats o comportamiento), en orden de aparición. */
  nombresEspecies() {
    return [...new Set([...this.especies.keys(), ...this.comportamiento.keys()])];
  }

  /** Nombres de las columnas de cada pista. */
  static get columnas() {
    return { global: COLS_GLOBAL, especie: COLS_ESPECIE, comportamiento: COLS_COMP };
  }

  /**
   * Cota rápida (O(pistas)) de tamaño(): los typed arrays exactos más el
   * JSON de nombres, eventos y lo fijo. Es lo que se compara con maxBytes.
   */
  bytesEstimados() {
    let b = this.t.length * 8 + bytesPista(this.global);
    for (const p of this.especies.values()) b += bytesPista(p);
    for (const p of this.comportamiento.values()) b += bytesPista(p);
    return b + this.#bytesFijos();
  }

  /** Lo que la fusión no achica: histogramas, nombres, eventos y el JSON fijo. */
  #bytesFijos() {
    let b = 0;
    const k = HISTOGRAMAS.length;
    for (const h of this.histogramas) b += 8 + k * 4 + k * (h.bins + 2) * 4;
    return b + this.#bytesNombres + this.#bytesEventos + JSON_FIJO;
  }

  /** Forma compacta para IndexedDB (typed arrays; structured clone). */
  serializar() {
    const hs = this.histogramas;
    const bins = hs.length ? hs[0].bins : 0;
    const uniformes = hs.every((h) => h.bins === bins);
    const lista = uniformes ? hs : hs.filter((h) => h.bins === hs[hs.length - 1].bins);
    const b = lista.length ? lista[0].bins : 0;
    const k = HISTOGRAMAS.length;
    const datos = new Float32Array(lista.length * k * (b + 2));
    const nh = new Float32Array(lista.length * k);
    lista.forEach((h, i) => {
      datos.set(h.datos.subarray(0, k * (b + 2)), i * k * (b + 2));
      nh.set(h.n.slice(0, k), i * k);
    });
    return {
      v: VERSION,
      intervalo: this.intervalo,
      maxPuntos: this.maxPuntos,
      maxBytes: this.maxBytes,
      maxBytesEventos: this.maxBytesEventos,
      maxHistogramas: this.maxHistogramas,
      nivel: this.nivel,
      ultima: this.#ultima,
      columnas: { global: COLS_GLOBAL, especie: COLS_ESPECIE, comportamiento: COLS_COMP },
      t: Float64Array.from(this.t),
      global: serializarPista(this.global),
      especies: [...this.especies].map(([nombre, p]) => ({ nombre, ...serializarPista(p) })),
      comportamiento: [...this.comportamiento].map(([nombre, p]) => ({
        nombre,
        ...serializarPista(p),
      })),
      histogramas: {
        bins: b,
        ciclos: Float64Array.from(lista.map((h) => h.ciclo)),
        n: nh,
        datos,
      },
      eventos: structuredClone(this.eventos),
      eventosDescartados: this.eventosDescartados,
    };
  }

  /**
   * Historia desde serializar() (v2 o v1) o desde la historia vieja de N1:
   * {intervalo, max, muestras: [{ciclo, total, especies}]}.
   * @param {any} o
   */
  static deserializar(o) {
    if (!o || typeof o !== 'object') return new Historia();
    if (Array.isArray(o.muestras)) return Historia.desdeMuestras(o);
    const h = new Historia({
      intervalo: o.intervalo,
      maxPuntos: o.maxPuntos,
      maxBytes: o.maxBytes,
      maxBytesEventos: o.maxBytesEventos,
      maxHistogramas: o.maxHistogramas,
    });
    /**
     * Columnas guardadas → las de ahora (por nombre; las que falten, NaN).
     * @param {any} po @param {string[]} guardadas @param {readonly string[]} actuales
     * @param {boolean} bandas
     */
    const pista = (po, guardadas, actuales, bandas) => {
      const p = deserializarPista(po, guardadas.length, bandas);
      if (guardadas.join('\n') === actuales.join('\n')) return p;
      const q = pistaNueva(actuales.length, p.desde, bandas);
      q.n = p.n;
      q.kf = p.kf;
      const nan = () => p.n.map(() => Number.NaN);
      actuales.forEach((nombre, c) => {
        const i = guardadas.indexOf(nombre);
        q.media[c] = i >= 0 ? p.media[i] : nan();
        if (q.min && q.max && p.min && p.max) {
          q.min[c] = i >= 0 ? p.min[i] : nan();
          q.max[c] = i >= 0 ? p.max[i] : nan();
        }
      });
      return q;
    };
    const cols = o.columnas ?? {};
    h.t = Array.from(o.t ?? []);
    h.global = pista(o.global, cols.global ?? COLS_GLOBAL, COLS_GLOBAL, true);
    for (const e of o.especies ?? [])
      h.especies.set(e.nombre, pista(e, cols.especie ?? COLS_ESPECIE, COLS_ESPECIE, true));
    for (const e of o.comportamiento ?? [])
      h.comportamiento.set(e.nombre, pista(e, cols.comportamiento ?? COLS_COMP, COLS_COMP, false));
    const hs = o.histogramas;
    if (hs?.ciclos?.length) {
      const k = HISTOGRAMAS.length;
      const tam = k * (hs.bins + 2);
      for (let i = 0; i < hs.ciclos.length; i++)
        h.histogramas.push({
          ciclo: hs.ciclos[i],
          bins: hs.bins,
          n: Array.from(hs.n.subarray(i * k, (i + 1) * k)),
          datos: Float32Array.from(hs.datos.subarray(i * tam, (i + 1) * tam)),
        });
    }
    h.eventos = structuredClone(o.eventos ?? []);
    h.eventosDescartados = o.eventosDescartados ?? 0;
    const u = h.t.length - 1;
    h.#ultima = Number.isFinite(o.ultima) ? o.ultima : u >= 0 ? h.t[u] : -1;
    // v1 (fusión de la mitad vieja): el nivel es la potencia de 2 ≤ la
    // menor cantidad de muestras de un punto que no sea el último
    let nivel = Number.isFinite(o.nivel) ? o.nivel : 0;
    if (!(nivel >= 1)) {
      const n = h.global.n.slice(0, -1).filter((x) => x > 0);
      const menor = n.length ? Math.min(...n) : 1;
      nivel = 2 ** Math.floor(Math.log2(menor));
    }
    h.nivel = nivel;
    h.#recalcularEventos();
    h.#recalcularNombres();
    return h;
  }

  /**
   * La historia vieja de Observar (N1: una muestra con el total y los bots
   * por especie cada `intervalo` ciclos) como historia nueva: vivos global y
   * vivos por especie. Lo que N1 no medía queda NaN (hueco), no 0.
   * @param {{intervalo?: number, muestras: {ciclo: number, total: number,
   *   especies: Record<string, number>}[]}} o
   */
  static desdeMuestras(o) {
    const h = new Historia({ intervalo: o.intervalo });
    const iv = CAMPOS_ESPECIE.indexOf('vivos');
    for (const m of o.muestras) {
      const metrics = new Float32Array(METRICAS.length).fill(Number.NaN);
      metrics[IM.ciclo] = m.ciclo;
      metrics[IM.vivos] = m.total;
      h.agregar({
        ciclo: m.ciclo,
        metrics,
        especies: Object.entries(m.especies ?? {})
          .filter(([, n]) => n > 0)
          .map(([nombre, n]) => {
            const stats = new Float32Array(CAMPOS_ESPECIE.length).fill(Number.NaN);
            stats[iv] = n;
            return { nombre, stats };
          }),
      });
    }
    return h;
  }

  /**
   * Bytes de la historia serializada: los typed arrays más el JSON del resto
   * (nombres, columnas, eventos y números sueltos).
   */
  tamaño() {
    return medirSerializada(this.serializar());
  }
}

/**
 * Bytes de un objeto serializado: byteLength de cada typed array más el
 * JSON de lo demás.
 * @param {any} o
 */
export function medirSerializada(o) {
  let bytes = 0;
  const json = JSON.stringify(o, (_k, v) => {
    if (ArrayBuffer.isView(v)) {
      bytes += v.byteLength;
      return 0;
    }
    if (v instanceof ArrayBuffer) {
      bytes += v.byteLength;
      return 0;
    }
    return v;
  });
  return bytes + utf8.encode(json).length;
}
