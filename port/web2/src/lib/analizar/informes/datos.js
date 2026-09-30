// @ts-check
// Datos de las plantillas de informe (engine/report/) a partir de lo que
// tiene la interfaz (decisiones 10 y 11). Puro, sin DOM ni runes:
//   datosCorrida(fuente, cambios)     una FuenteAnalisis de Analizar
//   datosComparacion(a, b)            dos Fuente de Comparar (con sus eventos)
//   datosReplicas(trabajo, resultados) un trabajo de réplicas de la cola
//                                     (el registro completo, con el
//                                     escenario) y sus resultados
//   trabajosReplicas(lista)           los trabajos de réplicas terminados

import { ACTIVOS } from '../../../../engine/cola.js';
import { TIPO_REPLICAS } from '../../../../engine/replicas.js';

/**
 * @typedef {import('../fuente.js').FuenteAnalisis} FuenteAnalisis
 * @typedef {import('../comparar/fuentes.js').Fuente} FuenteComparar
 * @typedef {import('../../../../engine/cola.js').Trabajo} Trabajo
 */

/**
 * Informe «Corrida» de la fuente que mira Analizar. `cambios`: los eventos
 * de la corrida (cambios en caliente y siembras, engine/corridas.js).
 * @param {FuenteAnalisis} f @param {any[]} [cambios] @param {string | number | Date} [fecha]
 * @returns {import('../../../../engine/report/corrida.js').DatosCorrida}
 */
export function datosCorrida(f, cambios = [], fecha = Date.now()) {
  return {
    historia: f.historia,
    linaje: f.linaje ?? null,
    escenario: f.escenario ?? null,
    semilla: f.semilla ?? undefined,
    titulo: f.nombre || undefined,
    cambios: structuredClone(cambios ?? []),
    fecha,
  };
}

/**
 * Informe «Comparación» de dos corridas (A y B).
 * @param {FuenteComparar} a @param {FuenteComparar} b @param {string | number | Date} [fecha]
 * @returns {import('../../../../engine/report/comparacion.js').DatosComparacion}
 */
export function datosComparacion(a, b, fecha = Date.now()) {
  /** @param {FuenteComparar} f */
  const lado = (f) => ({
    historia: f.historia,
    escenario: f.escenario ?? null,
    semilla: f.semilla,
    titulo: f.nombre || undefined,
    cambios: f.eventos ?? [],
  });
  return { a: lado(a), b: lado(b), fecha };
}

/**
 * Informe «Réplicas» de un trabajo (el registro completo de la cola, con
 * `params` = ParamsReplicas de engine/replicas.js) y sus resultados (null =
 * réplica sin terminar).
 * @param {Pick<Trabajo, 'params' | 'titulo'>} tr @param {any[]} resultados
 * @param {string | number | Date} [fecha]
 * @returns {import('../../../../engine/report/replicas.js').DatosReplicas}
 */
export function datosReplicas(tr, resultados, fecha = Date.now()) {
  const p = tr.params ?? {};
  const semillas = Array.isArray(p.semillas) ? [...p.semillas] : [];
  return {
    escenario: p.escenario ?? null,
    semillas,
    ciclos: Number(p.ciclos) || 0,
    cada: Number(p.cada) || 0,
    metrica: p.metrica,
    origen: p.origen ?? { nombre: '' },
    eventos: p.eventos ?? [],
    resultados: semillas.map((_, i) => resultados?.[i] ?? null),
    titulo: tr.titulo || undefined,
    fecha,
  };
}

/**
 * Trabajos de réplicas que se pueden informar: los terminados (y, aparte,
 * cuántos siguen en la cola), el más reciente primero.
 * @param {Trabajo[]} lista
 */
export function trabajosReplicas(lista) {
  const propios = lista.filter((x) => x.tipo === TIPO_REPLICAS);
  return {
    terminados: propios
      .filter((x) => x.estado === 'terminado')
      .sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado))),
    enCola: propios.filter((x) => ACTIVOS.includes(x.estado)).length,
  };
}
