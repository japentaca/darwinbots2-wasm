// @ts-check
// Rutas de Bots (paso N3.2, puro). Otras pantallas abren la ficha de un bot
// con el hash:
//
//   #/bots                            la biblioteca
//   #/bots/<clave>                    la ficha del bot, pestaña Resumen
//   #/bots/<clave>/<pestaña>          esa pestaña (resumen, adn, historial)
//
// <clave> puede ser (se prueba en este orden):
//   - el id del índice (engine/biblioteca.js): 'foro:<archivo>' o
//     'propio:p:<16 hex>';
//   - la clave de un propio, 'p:<16 hex>' (engine/bots.js esClavePropia);
//   - el nombre exacto del bot (lo que enlaza Inicio: #/bots/<nombre>). Si un
//     propio y uno del foro se llaman igual, gana el primero del índice (los
//     del foro van primero); rutaFicha() evita la ambigüedad usando el id;
//   - el hash de identidad del ADN (16 hex, o 'file:<archivo>' en los del
//     foro sin perfil): si lo comparten un propio y uno del foro, gana el
//     propio.

import { esClavePropia } from '../../../engine/bots.js';
import { hashDe } from '../../router.js';

export const PESTAÑAS = /** @type {const} */ (['resumen', 'adn', 'historial']);

/** @typedef {typeof PESTAÑAS[number]} Pestaña */
/** @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada */

/**
 * Clave del bot y pestaña de las partes de la ruta (lo que viene después de
 * `bots`). Una pestaña desconocida queda en 'resumen'.
 * @param {string[]} partes
 * @returns {{clave: string | null, pestaña: Pestaña}}
 */
export function leerRuta(partes) {
  const clave = partes[0] ? String(partes[0]) : null;
  const p = partes[1];
  const pestaña = /** @type {readonly string[]} */ (PESTAÑAS).includes(p)
    ? /** @type {Pestaña} */ (p)
    : 'resumen';
  return { clave, pestaña };
}

const RE_HASH = /^[0-9a-f]{16}$/;

/**
 * La entrada del índice que corresponde a una clave de la ruta, o null.
 * @param {Entrada[]} indice @param {string | null} clave
 * @returns {Entrada | null}
 */
export function resolverClave(indice, clave) {
  if (!clave) return null;
  if (clave.startsWith('foro:') || clave.startsWith('propio:')) {
    const e = indice.find((x) => x.id === clave);
    if (e) return e;
  }
  if (esClavePropia(clave)) {
    const e = indice.find((x) => x.clase === 'propio' && x.clave === clave);
    if (e) return e;
  }
  const porNombre = indice.find((x) => x.nombre === clave);
  if (porNombre) return porNombre;
  if (RE_HASH.test(clave) || clave.startsWith('file:')) {
    const mismos = indice.filter((x) => x.hash === clave);
    return mismos.find((x) => x.clase === 'propio') ?? mismos[0] ?? null;
  }
  return null;
}

/**
 * Clave con la que se enlaza una entrada: su nombre si lo lleva a ella sin
 * ambigüedad, y si no su id.
 * @param {Entrada} e @param {Entrada[]} indice
 */
export function claveDe(e, indice) {
  return resolverClave(indice, e.nombre) === e ? e.nombre : e.id;
}

/**
 * Hash de la ficha de una entrada (pestaña 'resumen' = sin pestaña).
 * @param {Entrada} e @param {Entrada[]} indice @param {Pestaña} [pestaña]
 */
export function rutaFicha(e, indice, pestaña = 'resumen') {
  const clave = claveDe(e, indice);
  return pestaña === 'resumen' ? hashDe('bots', clave) : hashDe('bots', clave, pestaña);
}
