// @ts-check
// Enlaces al manual de darwinbots-wasm.org (S10 de PLAN-SITIO.md): la app se
// publica en /app/ del mismo sitio, así que el español queda en ../manual/
// y el inglés en ../en/manual/, relativos a la página (RAIZ_SITIO de
// build.js, como el wasm y el Bestiario). Los destinos finos (la página de
// una sysvar o de un operador) salen de vocabulario.json, que genera
// port/sitio/generar.mjs junto al manual.

import { RAIZ_SITIO } from '../build.js';

/** @typedef {'es' | 'en'} Idioma */

/** Entrada del vocabulario: página del manual (u), título (t) y resumen (r). */
/** @typedef {{u: string, t: string, r: string}} EntradaManual */

/** @typedef {{sysvars: Record<string, EntradaManual>, direcciones: Record<string, EntradaManual>,
 *   operadores: Record<string, EntradaManual>}} Vocabulario */

/** Carpeta del manual en un idioma, relativa a la raíz del sitio. */
export const PREFIJO_MANUAL = /** @param {Idioma} idioma */ (idioma) =>
  `${idioma === 'en' ? 'en/' : ''}manual/`;

/**
 * URL de una página del manual (ruta con barra final: `app/inicio/`).
 * @param {Idioma} idioma @param {string} ruta
 */
export function urlManual(idioma, ruta) {
  return new URL(`${RAIZ_SITIO}${PREFIJO_MANUAL(idioma)}${ruta}`, document.baseURI).href;
}

/** Vocabularios ya bajados (null: el archivo no está o no bajó), por idioma. */
/** @type {Map<Idioma, Promise<Vocabulario | null>>} */
const vocabularios = new Map();

/**
 * El vocabulario del manual en un idioma (sysvars, direcciones y operadores,
 * con su página y su resumen). Se baja la primera vez que se usa y queda
 * cacheado; si no está (la app abierta sola, sin el sitio), resuelve null y
 * las tarjetas del editor no aparecen.
 * @param {Idioma} idioma
 * @returns {Promise<Vocabulario | null>}
 */
export function vocabularioManual(idioma) {
  let p = vocabularios.get(idioma);
  if (!p) {
    p = fetch(urlManual(idioma, 'vocabulario.json'))
      .then((r) => (r.ok ? /** @type {Promise<Vocabulario>} */ (r.json()) : null))
      .catch(() => null);
    vocabularios.set(idioma, p);
  }
  return p;
}

/**
 * La página de una sysvar del vocabulario: acepta `nrg`, `.nrg` y la
 * dirección (`310`). null si no tiene página o no hay vocabulario.
 * @param {Vocabulario | null} vocab @param {string} nombre
 * @returns {EntradaManual | null}
 */
export function paginaSysvar(vocab, nombre) {
  if (!vocab) return null;
  const n = String(nombre ?? '');
  if (/^\d+$/.test(n)) return vocab.direcciones[n] ?? null;
  const sinPunto = n.replace(/^\*?\./, '').toLowerCase();
  return vocab.sysvars[sinPunto] ?? null;
}
