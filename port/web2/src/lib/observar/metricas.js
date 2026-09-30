// @ts-check
// Estadísticas vivas de Observar calculadas en la página a partir del frame
// decodificado (sin DOM), y el puente con la historia del worker (N2.1).
//
// Desde N2.1 la historia de la corrida es engine/history.js y se alimenta
// con las muestras del worker ({t:'muestra'}: exports de E2, por NOMBRE de
// especie, igual con la vista clásica o la enriquecida). Lo de este archivo
// que sigue en uso: el resumen de cada frame (panel «En vivo»),
// muestraDeResumen (la corrida sin muestreo del worker —tests, sesiones sin
// él— muestrea los frames como antes) y muestrasDeHistoria (la historia
// nueva → las muestras del gráfico de población). La clase Historia de
// abajo es la de N1 (una de cada dos al llenarse); ya no la usa la corrida.
//
// - Bots por especie: con la vista enriquecida, por VIS.especie (la tabla de
//   la vista); con la clásica, por el color del bot, con el nombre que ese
//   color tuvo la última vez que se vio en la enriquecida (o el del
//   escenario). Es una aproximación (dos especies del mismo color se juntan
//   y el color muta): solo la usa el panel; la historia guarda el total y el
//   feed no la mira (src/lib/sim/corrida-nucleo.js).
// - Generación máxima: solo con la vista enriquecida (VIS.gen).
// - Los cadáveres no cuentan.
//
// Historia: una muestra cada `intervalo` ciclos (100 por defecto, decisión
// 8) con el total y los bots por especie. Al pasar del tope se queda con
// una de cada dos y el intervalo se duplica (la fusión media/mín/máx de la
// decisión 8 es del Nivel 2).

import { BOT, FLAG, offBot, offVis, VIS } from '../sim/frame.js';

/**
 * @typedef {object} Resumen
 * @property {number} ciclo
 * @property {number} vivos        bots que no son cadáveres
 * @property {number} vegetales
 * @property {number} nrgMedia     NaN sin bots
 * @property {number} genMax       NaN sin la vista enriquecida
 * @property {string} genEspecie   especie del bot de generación máxima
 * @property {boolean} rica
 * @property {Record<string, {n: number, color: number}>} especies  nombre → bots y color (Long BGR)
 */

/**
 * @typedef {object} Muestra
 * @property {number} ciclo
 * @property {number} total
 * @property {Record<string, number>} especies
 */

/** Nombre de especie sin la extensión del archivo. @param {string} n */
export const sinTxt = (n) => String(n ?? '').replace(/\.txt$/i, '');

/** Long BGR → `#rrggbb`. @param {number} c */
export function vbAHex(c) {
  const n = c | 0;
  const h = (/** @type {number} */ x) => x.toString(16).padStart(2, '0');
  return `#${h(n & 0xff)}${h((n >> 8) & 0xff)}${h((n >> 16) & 0xff)}`;
}

/**
 * Resumen de un frame.
 * @param {import('../sim/frame.js').Frame} f
 * @param {{ nombreEspecie: (i: number) => string, nombrePorColor?: Map<number, string> }} o
 * @returns {Resumen}
 */
export function resumirFrame(f, o) {
  const v = f.v;
  const rica = f.rica && f.of.vis >= 0;
  /** @type {Record<string, {n: number, color: number}>} */
  const especies = {};
  let vivos = 0;
  let vegetales = 0;
  let nrg = 0;
  let genMax = rica ? -1 : Number.NaN;
  let genEspecie = '';
  for (let i = 0; i < f.nBots; i++) {
    const b = offBot(f, i);
    const flags = v[b + BOT.flags];
    if (flags & FLAG.corpse) continue;
    vivos++;
    if (flags & FLAG.veg) vegetales++;
    nrg += v[b + BOT.nrg];
    const color = v[b + BOT.color];
    let nombre;
    if (rica) {
      const q = offVis(f, i);
      nombre = sinTxt(o.nombreEspecie(v[q + VIS.especie])) || '?';
      const gen = v[q + VIS.gen];
      if (gen > genMax) {
        genMax = gen;
        genEspecie = nombre;
      }
    } else {
      nombre = o.nombrePorColor?.get(color) ?? vbAHex(color);
    }
    const e = especies[nombre];
    if (e) e.n++;
    else especies[nombre] = { n: 1, color };
  }
  if (rica && genMax < 0) genMax = Number.NaN;
  return {
    ciclo: f.ciclo,
    vivos,
    vegetales,
    nrgMedia: vivos ? nrg / vivos : Number.NaN,
    genMax,
    genEspecie,
    rica,
    especies,
  };
}

/**
 * Muestra de la historia a partir de un resumen.
 * @param {Resumen} r @returns {Muestra}
 */
export function muestraDe(r) {
  /** @type {Record<string, number>} */
  const especies = {};
  for (const [k, e] of Object.entries(r.especies)) especies[k] = e.n;
  return { ciclo: r.ciclo, total: r.vivos, especies };
}

export const INTERVALO_MUESTRA = 100;
export const MAX_MUESTRAS = 240;

export class Historia {
  /** @type {Muestra[]} */
  muestras = [];
  intervalo;
  max;

  /** @param {{ intervalo?: number, max?: number, muestras?: Muestra[] }} [o] */
  constructor(o = {}) {
    this.intervalo = o.intervalo ?? INTERVALO_MUESTRA;
    this.max = Math.max(4, o.max ?? MAX_MUESTRAS);
    if (o.muestras) this.muestras = o.muestras.map((m) => ({ ...m, especies: { ...m.especies } }));
  }

  /** Ciclo desde el que toca la próxima muestra. */
  get proxima() {
    const u = this.muestras[this.muestras.length - 1];
    return u ? u.ciclo + this.intervalo : 0;
  }

  /**
   * Agrega la muestra si ya toca (ciclo ≥ próxima). Devuelve si la agregó.
   * @param {Muestra} m
   */
  agregar(m) {
    if (m.ciclo < this.proxima) return false;
    this.muestras.push(m);
    if (this.muestras.length > this.max) {
      // una de cada dos, conservando la última
      const n = this.muestras.length;
      this.muestras = this.muestras.filter((_, i) => (n - 1 - i) % 2 === 0);
      this.intervalo *= 2;
    }
    return true;
  }

  /**
   * Descarta las muestras de después del ciclo c (la sim cargada empieza
   * en c: lo posterior no pasó en ella).
   * @param {number} c
   */
  recortar(c) {
    this.muestras = this.muestras.filter((m) => m.ciclo <= c);
  }

  /**
   * La última muestra con ciclo ≤ c (undefined si no hay).
   * @param {number} c
   */
  hasta(c) {
    for (let i = this.muestras.length - 1; i >= 0; i--) {
      if (this.muestras[i].ciclo <= c) return this.muestras[i];
    }
    return undefined;
  }

  /** Nombres de especie en orden de aparición. */
  nombres() {
    /** @type {string[]} */
    const out = [];
    const vistos = new Set();
    for (const m of this.muestras) {
      for (const k of Object.keys(m.especies)) {
        if (!vistos.has(k)) {
          vistos.add(k);
          out.push(k);
        }
      }
    }
    return out;
  }

  /** Copia serializable. */
  aJSON() {
    return { intervalo: this.intervalo, max: this.max, muestras: this.muestras };
  }
}

/**
 * Variación de bots vivos respecto de hace `ventana` ciclos (null si la
 * historia no llega tan atrás). Acepta la historia de N1 (hasta) o la de
 * engine/history.js (valorEn).
 * @param {Historia | import('../../../engine/history.js').Historia} h @param {Resumen} r
 * @param {number} [ventana]
 */
export function variacion(h, r, ventana = 1000) {
  const c = r.ciclo - ventana;
  if ('valorEn' in h) {
    const v = h.valorEn('vivos', c);
    return v === undefined ? null : r.vivos - Math.round(v);
  }
  const m = h.hasta(c);
  return m ? r.vivos - m.total : null;
}

/** Máximo de muestras del gráfico de población del panel. */
export const MAX_GRAFICO = 240;

/**
 * La historia nueva (engine/history.js) como muestras del gráfico: vivos en
 * total y por especie en cada punto. Con más de `max` puntos, se promedian
 * de a grupos consecutivos, PONDERANDO cada punto por las muestras que junta
 * (n: tras la fusión los puntos viejos juntan más que los nuevos). Cada
 * grupo toma el ciclo de su primer punto; una especie ausente en una
 * muestra cuenta 0 dentro del grupo (también dentro de un punto fundido en
 * que estuvo solo en parte). Las especies ausentes en todo el grupo no
 * aparecen.
 * @param {import('../../../engine/history.js').Historia} h @param {number} [max]
 * @returns {Muestra[]}
 */
export function muestrasDeHistoria(h, max = MAX_GRAFICO) {
  const t = h.t;
  const len = t.length;
  if (!len) return [];
  const sv = /** @type {import('../../../engine/history.js').Serie} */ (h.serie('vivos'));
  const total = sv.media;
  const peso = sv.n;
  /** @type {Map<number, number>} ciclo de un punto → índice global */
  const indice = new Map(t.map((c, g) => [c, g]));
  const nombres = [...h.especies.keys()];
  // por especie y punto global: media × muestras presentes (NaN = ausente)
  const porEspecie = nombres.map((nombre) => {
    const out = new Float64Array(len).fill(Number.NaN);
    const s = h.serie('vivos', nombre);
    if (s)
      for (let j = 0; j < s.t.length; j++) {
        const g = indice.get(s.t[j]);
        if (g !== undefined) out[g] = s.media[j] * s.n[j];
      }
    return out;
  });
  const k = Math.max(1, Math.ceil(len / Math.max(1, max)));
  /** @type {Muestra[]} */
  const out = [];
  for (let a = 0; a < len; a += k) {
    const b = Math.min(len, a + k);
    let w = 0;
    let tot = 0;
    for (let g = a; g < b; g++) {
      const n = peso[g] || 1;
      w += n;
      tot += total[g] * n;
    }
    /** @type {Record<string, number>} */
    const especies = {};
    nombres.forEach((nombre, i) => {
      const v = porEspecie[i];
      let s = 0;
      let hay = false;
      for (let g = a; g < b; g++)
        if (!Number.isNaN(v[g])) {
          s += v[g];
          hay = true;
        }
      if (hay) especies[nombre] = s / w;
    });
    out.push({ ciclo: t[a], total: tot / w, especies });
  }
  return out;
}

/**
 * Una muestra con la forma de {t:'muestra'} del worker armada con el resumen
 * de un frame (la corrida sin muestreo del worker). Con la vista clásica
 * los grupos por color no son especies: solo el total.
 * @param {Resumen} r
 */
export function muestraDeResumen(r) {
  const metrics = new Float32Array(56);
  metrics[0] = r.ciclo;
  metrics[2] = r.vivos;
  metrics[3] = r.vegetales;
  metrics[4] = r.vivos - r.vegetales;
  metrics[11] = Number.isFinite(r.genMax) ? r.genMax : 0;
  metrics[22] = Number.isFinite(r.nrgMedia) ? r.nrgMedia : 0;
  const especies = r.rica
    ? Object.entries(r.especies)
        .filter(([, e]) => e.n > 0)
        .map(([nombre, e]) => {
          const stats = new Float32Array(27).fill(Number.NaN);
          stats[1] = e.n;
          stats[24] = e.color;
          return { nombre, stats };
        })
    : [];
  return { ciclo: r.ciclo, metrics, especies };
}

/**
 * Lo que el panel y el detector toman de una muestra del worker: bots por
 * especie (sin «.txt» ni «Corpse»), su color (Long BGR) y la generación
 * máxima con su especie.
 * @param {{ciclo: number, metrics: ArrayLike<number>,
 *   especies?: {nombre: string, stats: ArrayLike<number>}[]}} m
 */
export function resumenMuestra(m) {
  /** @type {Record<string, number>} */
  const especies = {};
  /** @type {Record<string, number>} */
  const colores = {};
  let genMax = -1;
  let genEspecie = '';
  for (const e of m.especies ?? []) {
    const nombre = sinTxt(e.nombre);
    if (!nombre || /^corpse$/i.test(nombre)) continue;
    especies[nombre] = (especies[nombre] ?? 0) + e.stats[1];
    colores[nombre] = e.stats[24];
    if (e.stats[7] > genMax) {
      genMax = e.stats[7];
      genEspecie = nombre;
    }
  }
  return {
    ciclo: m.ciclo,
    total: m.metrics[2],
    especies,
    colores,
    genMax: genMax >= 0 ? genMax : Number.NaN,
    genEspecie,
    teleporters: m.metrics[47] ?? 0,
  };
}

/**
 * Capas del gráfico apilado: hasta `maxCapas` especies (las de más bots en
 * el pico) y el resto junto en «otras» (nombre null). Los bots de una
 * muestra que no están en ninguna especie (muestras de la vista clásica:
 * solo el total) también van a «otras».
 * @param {Muestra[]} muestras @param {number} [maxCapas]
 * @returns {{ nombre: string | null, valores: number[] }[]}
 */
export function capasApiladas(muestras, maxCapas = 7) {
  /** @type {Map<string, number>} pico por especie */
  const pico = new Map();
  /** @type {string[]} */
  const orden = [];
  for (const m of muestras) {
    for (const [k, n] of Object.entries(m.especies)) {
      if (!pico.has(k)) {
        pico.set(k, 0);
        orden.push(k);
      }
      if (n > /** @type {number} */ (pico.get(k))) pico.set(k, n);
    }
  }
  const elegidas =
    orden.length <= maxCapas
      ? orden
      : [...orden]
          .sort((a, b) => /** @type {number} */ (pico.get(b)) - /** @type {number} */ (pico.get(a)))
          .slice(0, maxCapas - 1);
  const set = new Set(elegidas);
  const capas = orden
    .filter((k) => set.has(k))
    .map((k) => ({
      nombre: /** @type {string | null} */ (k),
      valores: muestras.map((m) => m.especies[k] ?? 0),
    }));
  /** bots de la muestra sin especie (total − suma de especies) */
  const sinEspecie = muestras.map((m) => {
    const suma = Object.values(m.especies).reduce((s, n) => s + n, 0);
    return Math.max(0, (m.total ?? suma) - suma);
  });
  if (orden.length > elegidas.length || sinEspecie.some((n) => n > 0)) {
    capas.push({
      nombre: null,
      valores: muestras.map(
        (m, i) =>
          Object.entries(m.especies).reduce((s, [k, n]) => (set.has(k) ? s : s + n), 0) +
          sinEspecie[i],
      ),
    });
  }
  return capas;
}

/**
 * Tope «redondo» del eje y (1, 2 o 5 × 10^k) para un máximo.
 * @param {number} max
 */
export function topeEje(max) {
  if (!(max > 0)) return 10;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const k of [1, 2, 5, 10]) if (k * p >= max) return k * p;
  return 10 * p;
}
