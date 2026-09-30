// @ts-check
// Pestaña Genética de Analizar (puro): histogramas de la última muestra
// (db_sim_histogram, todas las especies; o, para una especie, los vivos del
// linaje), su evolución como mapa de calor tiempo × bins, y la comparación
// gen por gen del ADN dominante contra el fundador (diffGenes de
// engine/lineage.js) con las palabras que cambian.

import { diffGenes } from '../../../engine/lineage.js';
import { HISTOGRAMAS } from '../../../engine/metricas.js';
import { escalaLineal } from './grafico/escala.js';

/**
 * @typedef {object} Histograma
 * @property {number} ciclo
 * @property {number} min     límite inferior del primer bin
 * @property {number} max     límite superior del último bin
 * @property {number[]} bins  cuentas
 * @property {number} n       bots contados
 */

/** Kinds que también salen del linaje (campo de Individuo) para una especie. */
export const KINDS_LINAJE = Object.freeze({
  adn: 'adnLen',
  gen: 'gen',
  mut: 'mut',
  hijos: 'hijos',
});

/**
 * Histograma de un kind en una foto de la historia.
 * @param {{ciclo: number, bins: number, n: ArrayLike<number>, datos: ArrayLike<number>}} foto
 * @param {number} k  índice en HISTOGRAMAS
 * @returns {Histograma}
 */
export function histogramaDeFoto(foto, k) {
  const b = foto.bins;
  const o = k * (b + 2);
  const bins = [];
  for (let j = 0; j < b; j++) bins.push(foto.datos[o + 2 + j] || 0);
  return { ciclo: foto.ciclo, min: foto.datos[o], max: foto.datos[o + 1], bins, n: foto.n[k] || 0 };
}

/**
 * El histograma de la última foto de la historia (null si no hay).
 * @param {import('../../../engine/history.js').Historia} h @param {string} kind
 */
export function ultimoHistograma(h, kind) {
  const k = HISTOGRAMAS.indexOf(kind);
  const f = h.histogramas[h.histogramas.length - 1];
  if (k < 0 || !f) return null;
  return histogramaDeFoto(f, k);
}

/**
 * Histograma de valores sueltos en `bins` barras (como db_sim_histogram:
 * [mín, máx] de los valores, el máximo en la última barra).
 * @param {number[]} vals @param {number} bins @param {number} ciclo
 * @returns {Histograma}
 */
export function histogramaDe(vals, bins, ciclo) {
  const out = new Array(bins).fill(0);
  if (!vals.length) return { ciclo, min: 0, max: 0, bins: out, n: 0 };
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const v of vals) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  for (const v of vals) {
    const k = hi > lo ? Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins)) : 0;
    out[k]++;
  }
  return { ciclo, min: lo, max: hi, bins: out, n: vals.length };
}

/**
 * Histograma de una especie con los vivos del linaje (solo los kinds de
 * KINDS_LINAJE; null si el kind no sale del linaje).
 * @param {import('../../../engine/lineage.js').Linaje} lin @param {string} especie
 * @param {string} kind @param {number} [bins]
 */
export function histogramaEspecie(lin, especie, kind, bins = 20) {
  const campo = /** @type {Record<string, string>} */ (KINDS_LINAJE)[kind];
  if (!campo) return null;
  const vals = [];
  for (const abs of lin.vivos) {
    const x = /** @type {Record<string, any> | undefined} */ (lin.individuos.get(abs));
    if (x && x.especie === especie) vals.push(Number(x[campo]));
  }
  return histogramaDe(vals, bins, lin.ciclo);
}

/**
 * Mediana aproximada de un histograma (interpolando dentro del bin).
 * @param {Histograma} h
 */
export function mediana(h) {
  const tot = h.bins.reduce((s, x) => s + x, 0);
  if (!tot) return null;
  const b = h.bins.length;
  const ancho = (h.max - h.min) / b;
  let acc = 0;
  for (let j = 0; j < b; j++) {
    if (acc + h.bins[j] >= tot / 2) {
      const f = h.bins[j] ? (tot / 2 - acc) / h.bins[j] : 0;
      return h.min + (j + f) * ancho;
    }
    acc += h.bins[j];
  }
  return h.max;
}

/**
 * Mapa de calor de un kind a lo largo de la corrida: una columna por foto
 * (a lo sumo `maxCols`, tomadas parejas), `filas` bins sobre el rango común
 * [mín, máx] de todas las fotos. Cada bin de una foto se reparte al bin
 * común de su centro; cada columna va normalizada (fracción de bots).
 * @param {import('../../../engine/history.js').Historia} h @param {string} kind
 * @param {number} [filas] @param {number} [maxCols]
 */
export function mapaCalor(h, kind, filas = 20, maxCols = 120) {
  const k = HISTOGRAMAS.indexOf(kind);
  if (k < 0 || h.histogramas.length < 2) return null;
  const todas = h.histogramas;
  const paso = Math.max(1, Math.ceil(todas.length / maxCols));
  const fotos = todas.filter((_, i) => i % paso === 0 || i === todas.length - 1);
  const hs = fotos.map((f) => histogramaDeFoto(f, k)).filter((x) => x.n > 0);
  if (hs.length < 2) return null;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const x of hs) {
    lo = Math.min(lo, x.min);
    hi = Math.max(hi, x.max);
  }
  if (!(hi > lo)) hi = lo + 1;
  const celdas = new Float32Array(hs.length * filas);
  let maxFrac = 0;
  hs.forEach((x, c) => {
    const b = x.bins.length;
    const tot = x.bins.reduce((s, v) => s + v, 0) || 1;
    for (let j = 0; j < b; j++) {
      if (!x.bins[j]) continue;
      const centro = x.max > x.min ? x.min + ((j + 0.5) * (x.max - x.min)) / b : x.min;
      const r = Math.min(filas - 1, Math.max(0, Math.floor(((centro - lo) / (hi - lo)) * filas)));
      celdas[c * filas + r] += x.bins[j] / tot;
    }
    for (let r = 0; r < filas; r++) maxFrac = Math.max(maxFrac, celdas[c * filas + r]);
  });
  return { ciclos: hs.map((x) => x.ciclo), min: lo, max: hi, filas, celdas, maxFrac };
}

/**
 * Ciclo donde termina la última columna del mapa: el último ciclo de la
 * historia si es posterior a la última foto; si no, la última foto más la
 * separación media entre fotos.
 * @param {number[]} ciclos @param {number} ultimo
 */
export function finMapa(ciclos, ultimo) {
  const n = ciclos.length;
  if (!n) return ultimo;
  const u = ciclos[n - 1];
  if (ultimo > u) return ultimo;
  return n > 1 ? u + (u - ciclos[0]) / (n - 1) : u + 1;
}

/**
 * El mapa de calor como pocos paths (uno por nivel de intensidad, en vez de
 * un rect por celda): columnas = fotos, filas = bins (el menor abajo). Cada
 * columna se ubica por su ciclo (X lineal de ciclos[0] a `fin`) y llega
 * hasta la foto siguiente: las fotos no están parejas en el tiempo (se
 * submuestrean y se saltean las vacías).
 * @param {{ciclos: number[], filas: number, celdas: Float32Array, maxFrac: number}} m
 * @param {number} x0 @param {number} x1 @param {number} y0 @param {number} y1
 * @param {number} [niveles] @param {number} [fin]  ciclo del borde derecho (finMapa)
 * @returns {{op: number, d: string}[]}
 */
export function pathsMapa(m, x0, x1, y0, y1, niveles = 6, fin) {
  const cols = m.ciclos.length;
  const c0 = m.ciclos[0];
  const cf = fin ?? finMapa(m.ciclos, Number.NEGATIVE_INFINITY);
  const X = escalaLineal(c0, cf > c0 ? cf : c0 + 1, x0, x1);
  const ch = (y1 - y0) / m.filas;
  const ds = new Array(niveles).fill('');
  for (let c = 0; c < cols; c++) {
    const xa = X(m.ciclos[c]);
    const xb = c + 1 < cols ? X(m.ciclos[c + 1]) : x1;
    const cw = Math.max(0.5, xb - xa);
    for (let r = 0; r < m.filas; r++) {
      const f = m.celdas[c * m.filas + r];
      if (!(f > 0) || !(m.maxFrac > 0)) continue;
      const nivel = Math.min(niveles - 1, Math.floor((f / m.maxFrac) * niveles));
      const y = y1 - (r + 1) * ch;
      ds[nivel] +=
        `M${xa.toFixed(1)} ${y.toFixed(1)}h${(cw + 0.3).toFixed(1)}v${(ch + 0.3).toFixed(1)}h${(-cw - 0.3).toFixed(1)}Z`;
    }
  }
  return ds.map((d, i) => ({ op: (i + 1) / niveles, d })).filter((x) => x.d);
}

// ---- ADN: palabras que cambian dentro de un gen ------------------------------
//
// Nunca una matriz n × m sobre el ADN entero: la distancia sale de diffGenes
// (gen por gen) y, dentro de cada gen modificado, del largo de la
// subsecuencia común (Myers, memoria O(n + m)). La matriz solo se usa para
// marcar las palabras de los genes que se muestran, con tope de tamaño.

/** Celdas máximas de la matriz de diffPalabras (más: el medio va entero como cambio). */
export const MAX_CELDAS_DIFF = 250000;

/**
 * Largo de la subsecuencia común más larga de dos listas (algoritmo de
 * Myers: tiempo O((n + m)·D), memoria O(n + m)), tras quitar el prefijo y
 * el sufijo comunes. Si la distancia de edición supera `maxD` devuelve una
 * cota (el largo que tendría con distancia maxD).
 * @param {ArrayLike<unknown>} a @param {ArrayLike<unknown>} b @param {number} [maxD]
 */
export function lcsLongitud(a, b, maxD = 4000) {
  let i0 = 0;
  while (i0 < a.length && i0 < b.length && a[i0] === b[i0]) i0++;
  let ea = a.length;
  let eb = b.length;
  while (ea > i0 && eb > i0 && a[ea - 1] === b[eb - 1]) {
    ea--;
    eb--;
  }
  const comun = i0 + (a.length - ea);
  const n = ea - i0;
  const m = eb - i0;
  if (!n || !m) return comun;
  const max = Math.min(n + m, maxD);
  const off = max + 1;
  const V = new Int32Array(2 * max + 3);
  for (let d = 0; d <= max; d++)
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && V[off + k - 1] < V[off + k + 1])
          ? V[off + k + 1]
          : V[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[i0 + x] === b[i0 + y]) {
        x++;
        y++;
      }
      V[off + k] = x;
      if (x >= n && y >= m) return comun + (n + m - d) / 2;
    }
  return comun + Math.max(0, Math.floor((n + m - max) / 2));
}

/** @param {string} s */
const palabras = (s) => s.split(/\s+/).filter(Boolean);

/**
 * Diferencia palabra por palabra de dos genes (texto con palabras separadas
 * por espacios): subsecuencia común más larga, tras quitar el prefijo y el
 * sufijo comunes. Si el medio distinto es enorme (más de MAX_CELDAS_DIFF
 * celdas) se marca entero como cambio. Devuelve las palabras de A
 * (igual/quitado) y las de B (igual/agregado).
 * @param {string} a @param {string} b
 */
export function diffPalabras(a, b) {
  const pa = palabras(a);
  const pb = palabras(b);
  let i0 = 0;
  while (i0 < pa.length && i0 < pb.length && pa[i0] === pb[i0]) i0++;
  let ea = pa.length;
  let eb = pb.length;
  while (ea > i0 && eb > i0 && pa[ea - 1] === pb[eb - 1]) {
    ea--;
    eb--;
  }
  /** @type {{w: string, cambio: boolean}[]} */
  const ta = pa.slice(0, i0).map((w) => ({ w, cambio: false }));
  /** @type {{w: string, cambio: boolean}[]} */
  const tb = pb.slice(0, i0).map((w) => ({ w, cambio: false }));
  const ma = pa.slice(i0, ea);
  const mb = pb.slice(i0, eb);
  const n = ma.length;
  const m = mb.length;
  if (n && m && n * m <= MAX_CELDAS_DIFF) {
    const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
      for (let j = m - 1; j >= 0; j--)
        L[i][j] = ma[i] === mb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0;
    let j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && ma[i] === mb[j]) {
        ta.push({ w: ma[i++], cambio: false });
        tb.push({ w: mb[j++], cambio: false });
      } else if (j >= m || (i < n && L[i + 1][j] >= L[i][j + 1]))
        ta.push({ w: ma[i++], cambio: true });
      else tb.push({ w: mb[j++], cambio: true });
    }
  } else {
    for (const w of ma) ta.push({ w, cambio: true });
    for (const w of mb) tb.push({ w, cambio: true });
  }
  for (const w of pa.slice(ea)) ta.push({ w, cambio: false });
  for (const w of pb.slice(eb)) tb.push({ w, cambio: false });
  return { a: ta, b: tb };
}

/**
 * Distancia entre dos ADN a partir de su diffGenes: fracción de palabras
 * que no están en la parte común (0 = idénticos), sobre el total de las
 * dos. Genes iguales no suman diferencia; agregados y quitados, todas sus
 * palabras; en uno modificado, las que quedan fuera de su subsecuencia
 * común (lcsLongitud, memoria O(n + m)).
 * @param {{genesA: string[], genesB: string[],
 *   cambios: import('../../../engine/lineage.js').CambioGen[]}} d
 */
export function distanciaDiff(d) {
  let tot = 0;
  let dif = 0;
  for (const c of d.cambios) {
    const wa = c.a === null ? [] : palabras(d.genesA[c.a]);
    const wb = c.b === null ? [] : palabras(d.genesB[c.b]);
    tot += wa.length + wb.length;
    if (c.tipo === 'igual') continue;
    if (c.tipo === 'cambiado') dif += wa.length + wb.length - 2 * lcsLongitud(wa, wb);
    else dif += wa.length + wb.length;
  }
  return tot ? dif / tot : 0;
}

/**
 * Número de un gen en la comparación: el de su posición en el ADN
 * dominante (base 1); un gen borrado no está en el dominante y lleva el
 * número que tenía en el fundador (`fundador: true`). Así un mismo número
 * nombra siempre el mismo gen del dominante, en las celdas y en la lista.
 * @param {import('../../../engine/lineage.js').CambioGen} c
 */
export function numeroGen(c) {
  return c.b !== null ? { n: c.b + 1, fundador: false } : { n: (c.a ?? 0) + 1, fundador: true };
}

/**
 * Comparación de dos fotos del ADN dominante (la del fundador y otra):
 * diffGenes, distancia, las celdas de todos los genes y el detalle palabra
 * por palabra de los primeros `maxCambios` genes distintos.
 * @param {{adn: string}} a @param {{adn: string}} b @param {number} [maxCambios]
 */
export function compararFotos(a, b, maxCambios = 30) {
  const d = diffGenes(a.adn, b.adn);
  const distintos = d.cambios.filter((c) => c.tipo !== 'igual').length;
  const todas = (/** @type {string} */ g) => palabras(g).map((w) => ({ w, cambio: true }));
  const cambios = d.cambios
    .map((c, k) => ({ ...c, k }))
    .filter((c) => c.tipo !== 'igual')
    .slice(0, maxCambios)
    .map((c) => {
      const genA = c.a === null ? null : d.genesA[c.a];
      const genB = c.b === null ? null : d.genesB[c.b];
      const p = genA !== null && genB !== null ? diffPalabras(genA, genB) : null;
      return {
        ...c,
        ...numeroGen(c),
        antes: p ? p.a : genA === null ? null : todas(genA),
        despues: p ? p.b : genB === null ? null : todas(genB),
      };
    });
  return {
    d,
    distintos,
    cambios,
    resto: Math.max(0, distintos - maxCambios),
    distancia: distanciaDiff(d),
    celdas: d.cambios.map((c, k) => ({ k, tipo: c.tipo, ...numeroGen(c) })),
  };
}

/**
 * @typedef {{hash?: number, ciclo?: number, adn: string}} FotoAdn
 */

/**
 * Memoria de comparaciones por par de hashes de fotos (el ADN no cambia si
 * el hash no cambia): así no se recalcula en cada refresco en vivo. Guarda
 * las últimas `limite`. Una foto sin hash usa su ciclo y su largo.
 * @param {number} [limite]
 */
export function memoComparaciones(limite = 32) {
  /** @type {Map<string, ReturnType<typeof compararFotos>>} */
  const memo = new Map();
  /** @param {FotoAdn} f */
  const id = (f) => (f.hash !== undefined ? `h${f.hash}` : `c${f.ciclo}:${f.adn.length}`);
  /** @param {FotoAdn} a @param {FotoAdn} b @param {number} [maxCambios] */
  const comparar = (a, b, maxCambios = 30) => {
    const k = `${id(a)}|${id(b)}|${maxCambios}`;
    let r = memo.get(k);
    if (r) {
      memo.delete(k);
      memo.set(k, r);
      return r;
    }
    r = compararFotos(a, b, maxCambios);
    memo.set(k, r);
    if (memo.size > limite) memo.delete(/** @type {string} */ (memo.keys().next().value));
    return r;
  };
  comparar.cuantas = () => memo.size;
  return comparar;
}
