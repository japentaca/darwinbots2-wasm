// @ts-check
// Informes (decisión 11 de port/web2/PLAN.md): punto de entrada. Cada
// plantilla es una función pura datos → {html, archivo, datos}; el .html es
// autocontenido (engine/report/plantilla.js).
//
// Plantillas del Nivel 2:
//   'corrida'      engine/report/corrida.js
//   'comparacion'  engine/report/comparacion.js (dos corridas superpuestas)
//   'replicas'     engine/report/replicas.js (un trabajo de réplicas de la cola)
// Del Nivel 3:
//   'torneo'       engine/report/torneo.js (una temporada de un torneo)
// Del Nivel 4:
//   'barrido'      engine/report/barrido.js (un barrido de parámetros de la cola)

import { informeBarrido } from './barrido.js';
import { informeComparacion } from './comparacion.js';
import { informeCorrida } from './corrida.js';
import { informeReplicas } from './replicas.js';
import { ErrorInforme } from './textos.js';
import { informeTorneo } from './torneo.js';

export { informeBarrido } from './barrido.js';
export { informeComparacion } from './comparacion.js';
export { informeCorrida } from './corrida.js';
export { nombreArchivo } from './plantilla.js';
export { informeReplicas, semillasDescartadas } from './replicas.js';
export { CODIGOS_ERROR, ErrorInforme, IDIOMAS, TEXTOS, traductor } from './textos.js';
export { eloPorPartido, informeTorneo } from './torneo.js';

/** @typedef {'corrida' | 'comparacion' | 'replicas' | 'torneo' | 'barrido'} TipoInforme */
// TIPOS son las plantillas que ofrece la pantalla Informes; el barrido se
// genera desde Comparar › Barrido (generarInforme('barrido', …) igual vale).
export const TIPOS = /** @type {readonly TipoInforme[]} */ (
  Object.freeze(['corrida', 'comparacion', 'replicas', 'torneo'])
);

/**
 * @typedef {{html: string, archivo: string, datos: unknown}} Informe
 * @typedef {import('./comparacion.js').DatosComparacion} DatosComparacion
 * @typedef {import('./replicas.js').DatosReplicas} DatosReplicas
 * @typedef {import('./torneo.js').DatosTorneo} DatosTorneo
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
    case 'torneo':
      return informeTorneo(datos, op);
    case 'barrido':
      return informeBarrido(datos, op);
    default:
      throw new ErrorInforme('tipo', String(tipo));
  }
}
