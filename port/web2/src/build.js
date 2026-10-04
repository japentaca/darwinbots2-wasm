// @ts-check
// Id de build y URLs del wasm (PLAN.md C4). Vite reemplaza `__BUILD_ID__` por
// DB_BUILD_ID en el build; fuera de Vite (node:test) no está definido y vale 'dev'.

/* global __BUILD_ID__ */
/** @type {string | undefined} */
// @ts-expect-error: constante inyectada por `define` en vite.config.js.
const inyectado = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : undefined;

/** Id del build (en Pages, el commit corto). */
export const BUILD_ID = inyectado || 'dev';

/**
 * Raíz del sitio vista desde la app, que se publica en `/app/` (PLAN-SITIO.md
 * S1). En desarrollo la app está en `/` y `../` resuelve igual a `/`.
 */
export const RAIZ_SITIO = '../';

/** Carpeta del wasm, relativa a la app (C2). */
export const BASE_WASM = `${RAIZ_SITIO}build-wasm/`;

/**
 * URL absoluta de algo publicado en la raíz del sitio (`build-wasm/`,
 * `classic/bots/…`), resuelta contra la página.
 * @param {string} ruta
 * @returns {string}
 */
export function urlSitio(ruta) {
  return new URL(`${RAIZ_SITIO}${ruta}`, document.baseURI).href;
}

/**
 * URL versionada de un artefacto del wasm (`dbcore.js`, `dbcore.wasm`).
 * @param {string} nombre
 * @returns {string}
 */
export function urlWasm(nombre) {
  return `${BASE_WASM}${nombre}?v=${BUILD_ID}`;
}
