// @ts-check
// Geometría completa de un gráfico de Analizar (puro): ejes, ticks, paths
// de líneas o de áreas apiladas, bandas mín–máx y la marca de un ciclo.
// Grafico.svelte solo la dibuja.
//
// Dominio: si se pide uno, se usa tal cual (así todos los gráficos de una
// pantalla quedan alineados aunque alguna serie empiece más tarde). El punto
// anterior al dominio entra solo en el trazo (para que la línea llegue al
// borde): no cuenta para la escala Y, ni para el tooltip, ni para el resumen.

import {
  escalaLineal,
  indiceCercano,
  pathBanda,
  pathLinea,
  pathsApilados,
  primeroDesde,
  primeroDespues,
  reducirColumnas,
  sumaCapas,
  ticksCiclos,
  ticksEjeY,
  ticksLindos,
} from './escala.js';

/**
 * @typedef {object} SerieGrafico
 * @property {string} clave     estable (para el #each)
 * @property {string} nombre    visible (especie o métrica)
 * @property {string} color
 * @property {ArrayLike<number>} t      ciclos (crecientes)
 * @property {ArrayLike<number>} v      valores (NaN = ausente: la línea se corta)
 * @property {ArrayLike<number>} [min]  mínimo del punto (tramos fundidos)
 * @property {ArrayLike<number>} [max]
 * @property {ArrayLike<number>} [n]    muestras por punto (n > 1 = fundido; 0 = ausente)
 */

/**
 * @typedef {object} Margen
 * @property {number} L @property {number} R @property {number} T @property {number} B
 */

/**
 * Resumen de lo que muestra un gráfico (para su aria-label): el último
 * valor, el mínimo y el máximo dentro del dominio. En un apilado es el
 * total; en líneas, la primera serie (la más importante) y `series` dice
 * cuántas hay.
 * @typedef {{nombre: string | null, ultimo: number, min: number, max: number, series: number}} ResumenGrafico
 */

export const MARGEN = Object.freeze({ L: 40, R: 8, T: 8, B: 20 });

/**
 * Índices [a, b) de `t` dentro de [c0, c1].
 * @param {ArrayLike<number>} t @param {number} c0 @param {number} c1
 */
export function indicesDominio(t, c0, c1) {
  return [primeroDesde(t, c0), primeroDespues(t, c1)];
}

/**
 * @param {{series: SerieGrafico[], modo: 'lineas' | 'apilado', ancho: number, alto: number,
 *   dominio?: [number, number] | null, margen?: Margen, cero?: boolean}} o
 *   cero: el eje Y de las líneas arranca en 0 (conteos); si no, se ajusta a
 *   los datos cuando el rango es chico (ticksEjeY). Los apilados, siempre en 0.
 */
export function geometria(o) {
  const { series, modo, ancho, alto } = o;
  const m = o.margen ?? MARGEN;
  const x0 = m.L;
  const x1 = Math.max(m.L + 10, ancho - m.R);
  const y0 = m.T;
  const y1 = Math.max(m.T + 10, alto - m.B);

  // Dominio de ciclos: el pedido, o el de todas las series.
  let c0 = Number.POSITIVE_INFINITY;
  let c1 = Number.NEGATIVE_INFINITY;
  for (const s of series)
    if (s.t.length) {
      c0 = Math.min(c0, s.t[0]);
      c1 = Math.max(c1, s.t[s.t.length - 1]);
    }
  const hayDatos = Number.isFinite(c0) && series.some((s) => s.t.length >= 1);
  if (o.dominio) [c0, c1] = o.dominio;
  if (!hayDatos || !(c1 >= c0))
    return {
      vacio: true,
      x0,
      x1,
      y0,
      y1,
      c0: 0,
      c1: 1,
      capas: [],
      xt: [],
      yt: [],
      X: null,
      Y: null,
      resumen: null,
    };
  if (c1 === c0) {
    // un solo ciclo: al centro
    c0 -= 0.5;
    c1 += 0.5;
  }
  const X = escalaLineal(c0, c1, x0, x1);

  /** @type {{clave: string, nombre: string, color: string, d: string, banda: string}[]} */
  let capas = [];
  let yt;
  /** @type {(v: number) => number} */
  let Y;
  /** @type {ResumenGrafico | null} */
  let resumen = null;
  if (modo === 'apilado') {
    const t = series[0]?.t ?? [];
    const [a0, b] = indicesDominio(t, c0, c1);
    const a = Math.max(0, a0 - 1); // el anterior, solo para el trazo
    const xs = [];
    for (let i = a; i < b; i++) xs.push(X(t[i]));
    const vals = series.map((s) => Array.prototype.slice.call(s.v, a, b));
    const red = reducirColumnas(xs, vals);
    const sumas = sumaCapas(red.capas, red.xs.length);
    // el tope, solo con las columnas dentro del dominio
    let tope = 0;
    for (let k = 0; k < sumas.length; k++)
      if (red.xs[k] >= x0 - 0.5) tope = Math.max(tope, sumas[k]);
    const tk = ticksLindos(0, tope > 0 ? tope : 1, 4);
    Y = escalaLineal(0, tk.max, y1, y0);
    yt = tk.ticks.map((v) => ({ v, y: Y(v) }));
    const ds = pathsApilados(red.xs, red.capas, Y);
    capas = series.map((s, i) => ({
      clave: s.clave,
      nombre: s.nombre,
      color: s.color,
      d: ds[i],
      banda: '',
    }));
    // resumen: el total por punto (sin reducir)
    let mn = Number.POSITIVE_INFINITY;
    let mx = Number.NEGATIVE_INFINITY;
    let ult = Number.NaN;
    for (let i = a0; i < b; i++) {
      let suma = 0;
      let alguno = false;
      for (const s of series) {
        const v = s.v[i];
        if (Number.isFinite(v)) {
          suma += Math.max(0, v);
          alguno = true;
        }
      }
      if (!alguno) continue;
      mn = Math.min(mn, suma);
      mx = Math.max(mx, suma);
      ult = suma;
    }
    if (Number.isFinite(ult))
      resumen = { nombre: null, ultimo: ult, min: mn, max: mx, series: series.length };
  } else {
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const s of series) {
      const [a, b] = indicesDominio(s.t, c0, c1);
      for (let i = a; i < b; i++) {
        const fundido = s.n && s.n[i] > 1;
        const vmin = fundido && s.min ? s.min[i] : s.v[i];
        const vmax = fundido && s.max ? s.max[i] : s.v[i];
        if (Number.isFinite(vmin)) lo = Math.min(lo, vmin);
        if (Number.isFinite(vmax)) hi = Math.max(hi, vmax);
      }
    }
    const tk = ticksEjeY(lo, hi, !!o.cero, 4);
    Y = escalaLineal(tk.min, tk.max, y1, y0);
    yt = tk.ticks.map((v) => ({ v, y: Y(v) }));
    capas = series.map((s) => {
      const [a0, b] = indicesDominio(s.t, c0, c1);
      const a = Math.max(0, a0 - 1); // el anterior, solo para el trazo
      const xs = [];
      const ys = [];
      const ymin = [];
      const ymax = [];
      const n = [];
      for (let i = a; i < b; i++) {
        xs.push(X(s.t[i]));
        ys.push(Y(s.v[i]));
        if (s.n && s.min && s.max) {
          ymin.push(Y(s.min[i]));
          ymax.push(Y(s.max[i]));
          n.push(s.n[i]);
        }
      }
      return {
        clave: s.clave,
        nombre: s.nombre,
        color: s.color,
        d: pathLinea(xs, ys),
        banda: n.length ? pathBanda(xs, ymin, ymax, n) : '',
      };
    });
    for (const s of series) {
      const [a, b] = indicesDominio(s.t, c0, c1);
      let mn = Number.POSITIVE_INFINITY;
      let mx = Number.NEGATIVE_INFINITY;
      let ult = Number.NaN;
      for (let i = a; i < b; i++) {
        const v = s.v[i];
        if (!Number.isFinite(v)) continue;
        mn = Math.min(mn, v);
        mx = Math.max(mx, v);
        ult = v;
      }
      if (Number.isFinite(ult)) {
        resumen = { nombre: s.nombre, ultimo: ult, min: mn, max: mx, series: series.length };
        break;
      }
    }
  }
  const xt = ticksCiclos(c0, c1, Math.max(2, Math.floor((x1 - x0) / 90))).map((v) => ({
    v,
    x: X(v),
  }));
  return { vacio: false, x0, x1, y0, y1, c0, c1, capas, xt, yt, X, Y, resumen };
}

/**
 * Valores de las series en el punto más cercano al ciclo `c` (tooltip),
 * solo entre los puntos dentro del dominio (si se da). Devuelve el ciclo
 * del punto y cada valor presente.
 * @param {SerieGrafico[]} series @param {number} c @param {[number, number] | null} [dominio]
 * @returns {{ciclo: number, filas: {clave: string, nombre: string, color: string, v: number,
 *   min: number | null, max: number | null}[]} | null}
 */
export function valoresEn(series, c, dominio = null) {
  let mejor = null;
  let dist = Number.POSITIVE_INFINITY;
  for (const s of series) {
    let i = indiceCercano(s.t, c);
    if (i < 0) continue;
    if (dominio) {
      const [a, b] = indicesDominio(s.t, dominio[0], dominio[1]);
      if (a >= b) continue;
      i = Math.min(b - 1, Math.max(a, i));
    }
    const d = Math.abs(s.t[i] - c);
    if (d < dist) {
      dist = d;
      mejor = s.t[i];
    }
  }
  if (mejor === null) return null;
  const ciclo = mejor;
  const filas = [];
  for (const s of series) {
    const i = indiceCercano(s.t, ciclo);
    if (i < 0 || s.t[i] !== ciclo || !Number.isFinite(s.v[i])) continue;
    const fundido = !!(s.n && s.n[i] > 1 && s.min && s.max);
    filas.push({
      clave: s.clave,
      nombre: s.nombre,
      color: s.color,
      v: s.v[i],
      min: fundido && s.min ? s.min[i] : null,
      max: fundido && s.max ? s.max[i] : null,
    });
  }
  return { ciclo, filas };
}
