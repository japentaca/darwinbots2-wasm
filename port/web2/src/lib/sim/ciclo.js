// @ts-check
// Ciclo tal como se muestra: el core arranca en -1 antes del primer tick y
// eso no se enseña; lo negativo, lo no finito y lo que no es número valen 0,
// y se trunca a entero. Puro.

/**
 * @param {unknown} ciclo
 * @returns {number}
 */
export function cicloVisible(ciclo) {
  const n = Math.trunc(Number(ciclo));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
