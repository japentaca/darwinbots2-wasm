// @ts-check
// Informes (decisión 11 de port/web2/PLAN.md): punto de entrada. Cada
// plantilla es una función pura datos → {html, archivo, datos}; el .html es
// autocontenido (engine/report/plantilla.js).
//
// Plantillas del Nivel 2:
//   'corrida'      engine/report/corrida.js
//   'comparacion'  engine/report/comparacion.js (dos corridas superpuestas)
//   'replicas'     engine/report/replicas.js (un trabajo de réplicas de la cola)
// La de Torneo es del Nivel 3.

import { informeComparacion } from './comparacion.js';
import { informeCorrida } from './corrida.js';
import { informeReplicas } from './replicas.js';

export { informeComparacion } from './comparacion.js';
export { informeCorrida } from './corrida.js';
export { nombreArchivo } from './plantilla.js';
export { informeReplicas, semillasDescartadas } from './replicas.js';
export { IDIOMAS, TEXTOS, traductor } from './textos.js';

/** @typedef {'corrida' | 'comparacion' | 'replicas'} TipoInforme */
export const TIPOS = /** @type {readonly TipoInforme[]} */ (
  Object.freeze(['corrida', 'comparacion', 'replicas'])
);

/**
 * @typedef {{html: string, archivo: string, datos: unknown}} Informe
 * @typedef {import('./comparacion.js').DatosComparacion} DatosComparacion
 * @typedef {import('./replicas.js').DatosReplicas} DatosReplicas
 */

/**
 * Genera un informe del tipo pedido.
 * @param {TipoInforme} tipo @param {any} datos @param {{idioma?: 'es' | 'en'}} [op]
 * @returns {Informe}
 */
export function generarInforme(tipo, datos, op) {
  switch (tipo) {
    case 'corrida':
      return informeCorrida(datos, op);
    case 'comparacion':
      return informeComparacion(datos, op);
    case 'replicas':
      return informeReplicas(datos, op);
    default:
      throw new Error(`informe: tipo desconocido «${tipo}»`);
  }
}
