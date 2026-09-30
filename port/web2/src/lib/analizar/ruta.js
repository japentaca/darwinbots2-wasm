// @ts-check
// Rutas de Analizar (puro). Otras pantallas abren Analizar en una corrida y
// una pestaña concretas con el hash:
//
//   #/analizar                       la corrida actual, pestaña Panel
//   #/analizar/<id>                  la corrida guardada <id>
//   #/analizar/<id>/<pestaña>        esa corrida en la pestaña
//   #/analizar/actual/<pestaña>      la corrida actual en la pestaña
//
// <pestaña> es una de PESTAÑAS (panel, especies, filogenia, genetica,
// eventos, comparar, informes); una desconocida se ignora (queda la que
// estaba). Ejemplo: el chip de trabajos de la barra superior lleva a
// rutaAnalizar('actual', 'comparar') = '#/analizar/actual/comparar'.

import { hashDe } from '../../router.js';

export const PESTAÑAS = /** @type {const} */ ([
  'panel',
  'especies',
  'filogenia',
  'genetica',
  'eventos',
  'comparar',
  'informes',
]);

/** @typedef {typeof PESTAÑAS[number]} Pestaña */

export const ID_ACTUAL = 'actual';

/**
 * Corrida y pestaña de las partes de la ruta (lo que viene después de
 * `analizar`).
 * @param {string[]} partes
 * @returns {{sel: string, pestaña: Pestaña | null}}
 */
export function leerRuta(partes) {
  const sel = partes[0] || ID_ACTUAL;
  const p = partes[1];
  const pestaña = /** @type {readonly string[]} */ (PESTAÑAS).includes(p)
    ? /** @type {Pestaña} */ (p)
    : null;
  return { sel, pestaña };
}

/**
 * Hash de Analizar en una corrida (por defecto, la actual) y una pestaña.
 * @param {string | null} [id] @param {Pestaña} [pestaña]
 */
export function rutaAnalizar(id, pestaña) {
  const c = id || ID_ACTUAL;
  if (pestaña) return hashDe('analizar', c, pestaña);
  return c === ID_ACTUAL ? hashDe('analizar') : hashDe('analizar', c);
}
