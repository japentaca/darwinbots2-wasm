// @ts-check
// Escalas de los gráficos de Comparar (puras): eje X lineal por ciclo y eje
// Y con marcas «redondas» (1, 2, 5 × 10^k).

/**
 * Una serie de GraficoBandas.svelte: la media y su banda (bajo–alto).
 * @typedef {{etiqueta: string, color: string, t: number[], media: number[],
 *   bajo: number[], alto: number[]}} SerieBanda
 */

/**
 * Paso redondo ≥ rango/marcas.
 * @param {number} rango @param {number} marcas
 */
export function pasoRedondo(rango, marcas = 4) {
  if (!(rango > 0)) return 1;
  const bruto = rango / marcas;
  const p = 10 ** Math.floor(Math.log10(bruto));
  for (const m of [1, 2, 5, 10]) if (m * p >= bruto) return m * p;
  return 10 * p;
}

/**
 * Eje Y de [min, max] (se extiende a marcas redondas; con min ≥ 0 arranca
 * en 0) sobre [top, top + alto] en píxeles (arriba = valores altos).
 * @param {number} min @param {number} max @param {number} top @param {number} alto
 */
export function ejeY(min, max, top, alto) {
  let lo = min >= 0 ? 0 : min;
  let hi = max;
  if (!(hi > lo)) hi = lo + 1;
  const paso = pasoRedondo(hi - lo);
  lo = Math.floor(lo / paso) * paso;
  hi = Math.ceil(hi / paso) * paso;
  /** @param {number} v */
  const a = (v) => top + alto * (1 - (v - lo) / (hi - lo));
  /** @type {{v: number, y: number}[]} */
  const marcas = [];
  for (let v = lo; v <= hi + paso / 2; v += paso) {
    const r = Number(v.toPrecision(12));
    marcas.push({ v: r, y: a(r) });
  }
  return { lo, hi, a, marcas };
}

/**
 * Eje X de [c0, c1] sobre [izq, izq + ancho], con 3 marcas (inicio, mitad, fin).
 * @param {number} c0 @param {number} c1 @param {number} izq @param {number} ancho
 */
export function escalaX(c0, c1, izq, ancho) {
  const span = c1 > c0 ? c1 - c0 : 1;
  /** @param {number} c */
  const a = (c) => izq + (ancho * (c - c0)) / span;
  const marcas = [0, 0.5, 1].map((k) => {
    const v = Math.round(c0 + span * k);
    return { v, x: a(v) };
  });
  return { a, marcas: c1 > c0 ? marcas : [marcas[0]] };
}
