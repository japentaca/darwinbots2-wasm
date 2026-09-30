// @ts-check
// Id de build y URLs del wasm (PLAN.md C4). Vite reemplaza `__BUILD_ID__` por
// DB_BUILD_ID en el build; fuera de Vite (node:test) no está definido y vale 'dev'.

/* global __BUILD_ID__ */
/** @type {string | undefined} */
// @ts-expect-error: constante inyectada por `define` en vite.config.js.
const inyectado = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : undefined;

/** Id del build (en Pages, el commit corto). */
export const BUILD_ID = inyectado || 'dev';

/** Carpeta del wasm, relativa a la raíz del sitio (C2). */
export const BASE_WASM = './build-wasm/';

/**
 * URL versionada de un artefacto del wasm (`dbcore.js`, `dbcore.wasm`).
 * @param {string} nombre
 * @returns {string}
 */
export function urlWasm(nombre) {
  return `${BASE_WASM}${nombre}?v=${BUILD_ID}`;
}
