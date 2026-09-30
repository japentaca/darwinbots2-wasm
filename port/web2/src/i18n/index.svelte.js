// @ts-check
// Estado del idioma (rune) y t() reactivo para los componentes. Los textos
// vienen de un archivo por área e idioma (`./es/app.json`, `./en/mundo.json`…,
// decisión C9) y se juntan al cargar.

import { areaDeRuta, IDIOMAS, juntarAreas, normalizarIdioma, traducir } from './core.js';

/** @type {Record<string, Record<string, string>>} */
const archivos = import.meta.glob('./*/*.json', { eager: true, import: 'default' });

const diccionarios = juntarAreas(
  Object.entries(archivos).flatMap(([ruta, dic]) => {
    const a = areaDeRuta(ruta);
    return a ? [{ ...a, dic }] : [];
  }),
);

const CLAVE_ALMACEN = 'darwinbots2.idioma';

/** @returns {string} */
function idiomaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACEN);
    if (guardado) return normalizarIdioma(guardado);
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): se usa el del navegador.
  }
  return normalizarIdioma(globalThis.navigator?.language);
}

const estado = $state({ idioma: idiomaInicial() });

/** Idiomas disponibles. */
export const idiomas = IDIOMAS;

/** @returns {string} idioma actual */
export function idioma() {
  return estado.idioma;
}

/**
 * Cambia el idioma y lo recuerda en este navegador.
 * @param {string} codigo
 */
export function setIdioma(codigo) {
  estado.idioma = normalizarIdioma(codigo);
  try {
    localStorage.setItem(CLAVE_ALMACEN, estado.idioma);
  } catch {
    // Si no se puede guardar, el cambio vale solo para esta sesión.
  }
}

/**
 * Texto traducido; reactivo porque lee el estado del idioma.
 * @param {string} clave
 * @param {import('./core.js').Params} [params]
 * @returns {string}
 */
export function t(clave, params) {
  return traducir(diccionarios, estado.idioma, clave, params);
}

/**
 * Número con el formato del idioma actual (16.000 / 16,000); reactivo.
 * @param {number} n
 * @param {Intl.NumberFormatOptions} [opciones]
 * @returns {string}
 */
export function num(n, opciones) {
  if (!Number.isFinite(n)) return '—';
  const clave = `${estado.idioma}|${opciones ? JSON.stringify(opciones) : ''}`;
  let f = formatos.get(clave);
  if (!f) {
    f = new Intl.NumberFormat(estado.idioma, opciones);
    formatos.set(clave, f);
  }
  return f.format(n);
}

/** @type {Map<string, Intl.NumberFormat>} */
const formatos = new Map();
