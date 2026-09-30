// @ts-check
// Carga port/build-wasm/dbcore.js (MODULARIZE, script clásico) en node y
// devuelve el Module ya instanciado. Los tests que lo usan se saltean si el
// wasm no está compilado (el job web2 del CI no compila el wasm).

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));

/** port/ */
export const PORT_DIR = path.resolve(aqui, '..', '..', '..');
/** port/build-wasm/ */
export const BUILD_WASM = path.join(PORT_DIR, 'build-wasm');
/** port/web/ (la clásica, congelada) */
export const WEB = path.join(PORT_DIR, 'web');
/** port/web2/ */
export const WEB2 = path.resolve(aqui, '..', '..');

/** true si dbcore.js y dbcore.wasm están compilados. */
export function hayWasm() {
  return (
    fs.existsSync(path.join(BUILD_WASM, 'dbcore.wasm')) &&
    fs.existsSync(path.join(BUILD_WASM, 'dbcore.js'))
  );
}

/** Motivo para `t.skip` / `{ skip }` cuando falta el wasm. */
export const SIN_WASM =
  'falta port/build-wasm/dbcore.wasm (cmake --build --preset wasm --target dbcore.js)';

/**
 * Instancia un Module nuevo de dbcore.
 * @returns {Promise<any>}
 */
export async function cargarDbCore() {
  const require = createRequire(import.meta.url);
  const createDbCore = require(path.join(BUILD_WASM, 'dbcore.js'));
  return createDbCore({ locateFile: (/** @type {string} */ f) => path.join(BUILD_WASM, f) });
}
