// @ts-check
// Recarga tras un deploy (puro, N4.4). Las pantallas y lo que arranca en
// segundo plano se cargan con import() dinámico; si entre tanto se publicó
// otra versión, los chunks viejos ya no existen y Vite emite
// `vite:preloadError`. src/main.js recarga la página UNA vez: deja una marca
// en sessionStorage y la borra unos segundos después de montar, así un fallo
// que persiste tras recargar (sin red, chunk roto) no entra en un bucle y
// App.svelte muestra el error con el botón Recargar. Con una corrida en
// memoria no se recarga sola (se perdería): App avisa que hay una versión
// nueva y que conviene guardar la corrida antes de recargar.

export const CLAVE_RECARGA = 'darwinbots2.recargaTrasDeploy';
/** Milisegundos tras montar la app en que se borra la marca. */
export const ESPERA_BORRAR_MARCA = 5000;

/**
 * @typedef {{getItem: (k: string) => string | null,
 *   setItem: (k: string, v: string) => void,
 *   removeItem: (k: string) => void}} Almacen
 */

/** @returns {Almacen | null} */
function almacenPorDefecto() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * ¿Hay que recargar ante un fallo de import()? Si sí, deja la marca.
 * No recarga si ya lo hizo (marca puesta), si hay una corrida en memoria o
 * si no puede dejar la marca (sin ella no hay garantía de una sola vez).
 * @param {boolean} hayCorrida @param {Almacen | null} [almacen]
 */
export function recargarTrasFallo(hayCorrida, almacen = almacenPorDefecto()) {
  if (hayCorrida || !almacen) return false;
  try {
    if (almacen.getItem(CLAVE_RECARGA)) return false;
    almacen.setItem(CLAVE_RECARGA, '1');
    return true;
  } catch {
    return false;
  }
}

/** Borra la marca (la app montó bien). @param {Almacen | null} [almacen] */
export function borrarMarcaRecarga(almacen = almacenPorDefecto()) {
  try {
    almacen?.removeItem(CLAVE_RECARGA);
  } catch {
    // almacenamiento bloqueado
  }
}
