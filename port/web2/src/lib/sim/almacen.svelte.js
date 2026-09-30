// @ts-check
// La base IndexedDB `darwinbots2` de la página (decisión 17): UNA conexión
// para todas las pantallas (corridas, escenarios propios, bots, torneos…),
// abierta en el primer uso. Los avisos de la conexión quedan en
// `estadoAlmacen` (runes) para que cualquier pantalla los muestre:
//   versionVieja  otra pestaña abrió una versión más nueva: hay que recargar
//                 (cada operación rechaza con ErrorAlmacen('version-vieja'))
//   bloqueado     otra pestaña con una versión vieja impide abrir la base

import { almacenIndexedDB } from '../../../engine/almacen.js';

export const estadoAlmacen = $state({ versionVieja: false, bloqueado: false });

/** @type {ReturnType<typeof almacenIndexedDB> | null} */
let unico = null;

/**
 * El almacén de la página (engine/almacen.js sobre IndexedDB).
 * @returns {ReturnType<typeof almacenIndexedDB>}
 */
export function almacen() {
  unico ??= almacenIndexedDB({
    alCambioVersion: () => {
      estadoAlmacen.versionVieja = true;
    },
    alBloqueo: () => {
      estadoAlmacen.bloqueado = true;
    },
  });
  return unico;
}
