// @ts-check
// Tema claro/oscuro: lógica pura (sin DOM), la comparten src/lib/tema.svelte.js
// y el script de arranque de index.html (que la repite en línea para fijar el
// tema antes de pintar; test/tema.test.js comprueba que coinciden).
//
// 'auto' sigue al sistema (prefers-color-scheme) y no pone atributo; 'claro'
// y 'oscuro' ponen data-tema en <html>. El mundo es siempre negro (--mundo).

export const CLAVE_TEMA = 'darwinbots2.tema';

/** @typedef {'auto' | 'claro' | 'oscuro'} Tema */

/** @type {readonly Tema[]} */
export const TEMAS = ['auto', 'claro', 'oscuro'];

/**
 * @param {unknown} v valor guardado (puede faltar o venir de otra versión)
 * @returns {Tema}
 */
export function normalizarTema(v) {
  return v === 'claro' || v === 'oscuro' ? v : 'auto';
}

/**
 * @param {Tema} preferencia
 * @param {boolean} sistemaOscuro
 * @returns {'claro' | 'oscuro'} el tema que se ve
 */
export function temaEfectivo(preferencia, sistemaOscuro) {
  if (preferencia === 'auto') return sistemaOscuro ? 'oscuro' : 'claro';
  return preferencia;
}

// Colores de datos (series, eventos) pensados para fondo claro que en el
// oscuro se pierden: al dibujar se cambian por una variante clara. Los datos
// guardan siempre el color original; el resto (especies, paleta) pasa igual.
/** @type {Readonly<Record<string, string>>} */
export const COLORES_OSCURO = Object.freeze({
  '#0f5c55': '#5cc2b5',
  '#151513': '#e8e6df',
  '#a9a79f': '#6e6c65',
  '#b8481b': '#de6a3c',
  '#6f4bb8': '#9d82e3',
  '#c05621': '#e07a45',
});

/**
 * @param {string} color @param {boolean} oscuro
 * @returns {string} el color tal como se dibuja con ese tema
 */
export function colorEnTema(color, oscuro) {
  if (!oscuro || typeof color !== 'string') return color;
  return COLORES_OSCURO[color.toLowerCase()] ?? color;
}
