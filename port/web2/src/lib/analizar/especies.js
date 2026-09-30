// @ts-check
// Pestaña Especies de Analizar (puro): una fila por especie con lo que dice
// la historia (engine/history.js) y el linaje (engine/lineage.js), orden por
// columna y sparkline de bots vivos.

import { pathLinea } from './grafico/escala.js';

/**
 * @typedef {object} FilaEspecie
 * @property {string} nombre
 * @property {number} vivos       en el último punto (0 si ya no está)
 * @property {number} max         máximo histórico de bots vivos
 * @property {number | null} cicloMax
 * @property {number | null} aparicion  ciclo de la primera muestra (o de registro)
 * @property {number | null} extincion  último ciclo con bots si ya no está (null = viva)
 * @property {number | null} genMax
 * @property {number | null} mutMedia
 * @property {number | null} adnMedia
 * @property {number | null} nrgMedia   energía por bot
 * @property {number | null} edadMedia
 * @property {number | null} hijosMedia
 * @property {string | null} madre      especie madre (árbol de especies)
 * @property {number[]} spark           bots vivos alineados con t (NaN = ausente)
 */

/** Columnas ordenables (clave de FilaEspecie). */
export const COLUMNAS = Object.freeze([
  'nombre',
  'vivos',
  'max',
  'aparicion',
  'extincion',
  'genMax',
  'mutMedia',
  'adnMedia',
  'nrgMedia',
  'edadMedia',
  'hijosMedia',
]);

/**
 * Último valor finito de una serie alineada (null si no hay).
 * @param {ArrayLike<number>} a
 */
function ultimo(a) {
  for (let i = a.length - 1; i >= 0; i--) if (Number.isFinite(a[i])) return a[i];
  return null;
}

/**
 * @param {import('../../../engine/history.js').Historia} h
 * @param {import('../../../engine/lineage.js').Linaje | null} lin
 * @returns {FilaEspecie[]}
 */
export function filasEspecies(h, lin) {
  const nombres = [...new Set([...h.nombresEspecies(), ...(lin ? lin.especies.keys() : [])])];
  const n = h.t.length;
  return nombres.map((nombre) => {
    const vivos = h.alineada('vivos', nombre);
    let max = 0;
    /** @type {number | null} */
    let cicloMax = null;
    let pri = -1;
    let ult = -1;
    for (let i = 0; i < n; i++) {
      const v = vivos[i];
      if (!Number.isFinite(v)) continue;
      if (pri < 0) pri = i;
      if (v > 0) ult = i;
      if (v > max) {
        max = v;
        cicloMax = h.t[i];
      }
    }
    const presente = n > 0 && Number.isFinite(vivos[n - 1]) && vivos[n - 1] > 0;
    const genMaxS = h.alineada('genMax', nombre);
    let genMax = null;
    for (const g of genMaxS) if (Number.isFinite(g) && (genMax === null || g > genMax)) genMax = g;
    const nrgT = ultimo(h.alineada('nrgTotal', nombre));
    const vivosU = ultimo(vivos);
    const reg = lin?.especies.get(nombre);
    return {
      nombre,
      vivos: presente ? vivos[n - 1] : 0,
      max,
      cicloMax,
      aparicion: pri >= 0 ? h.t[pri] : (reg?.ciclo ?? null),
      extincion: presente || ult < 0 ? null : h.t[Math.min(n - 1, ult)],
      genMax,
      mutMedia: ultimo(h.alineada('mutMedia', nombre)),
      adnMedia: ultimo(h.alineada('adnMedia', nombre)),
      nrgMedia: nrgT !== null && vivosU ? nrgT / vivosU : null,
      edadMedia: ultimo(h.alineada('edadMedia', nombre)),
      hijosMedia: ultimo(h.alineada('hijosMedia', nombre)),
      madre: reg?.madre ?? null,
      spark: vivos,
    };
  });
}

/**
 * Filas ordenadas por una columna (null va al final en los dos sentidos).
 * @param {FilaEspecie[]} filas @param {string} col @param {boolean} asc
 */
export function ordenarFilas(filas, col, asc) {
  const k = /** @type {keyof FilaEspecie} */ (COLUMNAS.includes(col) ? col : 'vivos');
  const s = asc ? 1 : -1;
  return [...filas].sort((a, b) => {
    const x = a[k];
    const y = b[k];
    if (k === 'nombre') return s * String(x).localeCompare(String(y));
    const nx = x === null || x === undefined;
    const ny = y === null || y === undefined;
    if (nx || ny) return nx === ny ? a.nombre.localeCompare(b.nombre) : nx ? 1 : -1;
    return s * (Number(x) - Number(y)) || a.nombre.localeCompare(b.nombre);
  });
}

/** Columnas de comportamiento que muestra la ficha de una especie. */
export const COMPORTAMIENTO_FICHA = Object.freeze([
  'disparosNrg',
  'disparosBody',
  'disparosVenom',
  'reproducciones',
  'lazosNuevos',
  'subidasShell',
  'muertes',
]);

/**
 * Comportamiento reciente de una especie: por bot y cada 1.000 ciclos, en
 * los últimos `ventana` puntos de la historia (el acumulado de cada punto
 * es la media por muestra × sus muestras; se divide por los bots vivos
 * medios y por los ciclos cubiertos). null si no hay datos.
 * @param {import('../../../engine/history.js').Historia} h @param {string} especie
 * @param {number} [ventana]
 */
export function comportamientoEspecie(h, especie, ventana = 10) {
  const vivos = h.serie('vivos', especie);
  const out = [];
  for (const col of COMPORTAMIENTO_FICHA) {
    const s = h.serie(col, especie);
    if (!s?.t.length) continue;
    const a = Math.max(0, s.t.length - ventana);
    let suma = 0;
    let muestras = 0;
    for (let i = a; i < s.t.length; i++) {
      if (!Number.isFinite(s.media[i])) continue;
      suma += s.media[i] * s.n[i];
      muestras += s.n[i];
    }
    let bots = 0;
    let k = 0;
    if (vivos)
      for (let i = 0; i < vivos.t.length; i++)
        if (vivos.t[i] >= s.t[a] && Number.isFinite(vivos.media[i])) {
          bots += vivos.media[i];
          k++;
        }
    const media = k ? bots / k : 0;
    const ciclos = muestras * h.intervalo;
    out.push({ col, v: media > 0 && ciclos > 0 ? (suma / media / ciclos) * 1000 : 0 });
  }
  return out.length ? out : null;
}

/**
 * Path de una sparkline (ancho × alto) de valores alineados con t. Donde la
 * especie no estaba (NaN) la línea se corta, igual que en los gráficos de
 * líneas por especie (catalogo.js: serieAlineada); un valor aislado se ve
 * como un punto. Simplificada por píxel (pathLinea).
 * @param {ArrayLike<number>} t @param {ArrayLike<number>} v @param {number} ancho @param {number} alto
 */
export function sparkline(t, v, ancho, alto) {
  const n = t.length;
  if (n < 2) return '';
  const t0 = t[0];
  const span = t[n - 1] - t0 || 1;
  let max = 0;
  for (let i = 0; i < n; i++) if (Number.isFinite(v[i]) && v[i] > max) max = v[i];
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i++) {
    xs.push(1 + ((t[i] - t0) / span) * (ancho - 2));
    ys.push(
      Number.isFinite(v[i]) ? alto - 1 - (max > 0 ? (v[i] / max) * (alto - 2) : 0) : Number.NaN,
    );
  }
  return pathLinea(xs, ys);
}
