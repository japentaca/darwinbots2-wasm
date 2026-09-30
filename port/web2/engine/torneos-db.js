// @ts-check
// Persistencia de los torneos (decisión 17 de port/web2/PLAN.md): la nueva
// usa su propia IndexedDB, `darwinbots2`, que abre engine/almacen.js (base
// única, con todos los almacenes y su versión). Los torneos usan dos:
// 'torneos' (clave id) y 'partidos' (clave id autoincremental, con índice
// `league`). La clásica guarda en `darwinbots-ligas` ('leagues' y
// 'matches'): la copia de esa base a esta es del Nivel 3 y no está aquí.
//
// La lógica (engine/torneos.js) solo ve la interfaz Almacen de
// engine/almacen.js (get, put, delete, list, porIndice y tx). Este módulo
// conserva sus nombres de siempre y delega en la apertura común.
//
// Origen: LgDB de port/web/league.js (líneas 29-71): mismo esquema de dos
// almacenes y la misma semántica de put (IndexedDB guarda una copia y
// devuelve la clave; el objeto original no recibe el id).

import { almacenIndexedDB, almacenMemoria, DB2_NOMBRE, STORES } from './almacen.js';

/** @typedef {import('./almacen.js').Almacen} Almacen */

export { almacenIndexedDB, almacenMemoria, DB2_NOMBRE };

/** Los almacenes de los torneos dentro de darwinbots2 (definidos en engine/almacen.js). */
export const STORES_TORNEOS = Object.freeze({
  torneos: STORES.torneos,
  partidos: STORES.partidos,
});
