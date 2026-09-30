// @ts-check
// Claves de i18n que el mundo arma con plantilla (`mundo.lente.${x}`…): los
// sufijos válidos se declaran acá y test/claves.test.js comprueba que cada
// combinación exista en todos los idiomas.

import { FLAG } from '../sim/frame.js';
import { ACCIONES, LENTES } from './render-enriquecido.js';

/** Tipos de bot del tooltip (`mundo.tipo.<tipo>`). */
export const TIPOS_BOT = Object.freeze(['animal', 'vegetal', 'cadaver']);

/**
 * Claves de fallo de carga que publica engine/worker.js ({t:'error', clave})
 * o que arma la conexión (`mundo.errorCarga.<clave>`). Una clave desconocida
 * cae al texto genérico `mundo.error`.
 */
export const ERRORES_CARGA = Object.freeze(['init-base', 'carga']);

/**
 * Tipo de bot según sus flags.
 * @param {number} flags BOT.flags
 * @returns {'animal' | 'vegetal' | 'cadaver'}
 */
export function tipoBot(flags) {
  return flags & FLAG.corpse ? 'cadaver' : flags & FLAG.veg ? 'vegetal' : 'animal';
}

/** Plantillas del área mundo: prefijo + cada sufijo = una clave. */
export const CLAVES_ARMADAS = Object.freeze([
  { prefijo: 'mundo.lente.', sufijos: Object.keys(LENTES) },
  { prefijo: 'mundo.accion.', sufijos: [...ACCIONES] },
  { prefijo: 'mundo.tipo.', sufijos: [...TIPOS_BOT] },
  { prefijo: 'mundo.errorCarga.', sufijos: [...ERRORES_CARGA] },
]);
