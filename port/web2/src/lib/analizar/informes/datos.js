// @ts-check
// Datos de las plantillas de informe (engine/report/) a partir de lo que
// tiene la interfaz (decisiones 10 y 11). Puro, sin DOM ni runes:
//   datosCorrida(fuente, cambios)     una FuenteAnalisis de Analizar
//   datosComparacion(a, b)            dos Fuente de Comparar (con sus eventos)
//   datosReplicas(trabajo, resultados) un trabajo de réplicas de la cola
//                                     (el registro completo, con el
//                                     escenario) y sus resultados
//   trabajosReplicas(lista)           los trabajos de réplicas que se pueden
//                                     informar (terminados, o cancelados o
//                                     fallidos con alguna réplica hecha)
//   claveError(e)                     texto traducible de un error con código
//                                     (engine/report/ y png.js)

import { ACTIVOS } from '../../../../engine/cola.js';
import { TIPO_REPLICAS } from '../../../../engine/replicas.js';
import { CODIGOS_ERROR } from '../../../../engine/report/textos.js';
import { CODIGOS_ERROR_PNG } from './png.js';

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

/** Estados cerrados sin terminar: se informan si tienen alguna réplica hecha. */
const PARCIALES = Object.freeze(['cancelado', 'fallido']);

/**
 * Trabajos de réplicas que se pueden informar (y, aparte, cuántos siguen en
 * la cola), el más reciente primero: los terminados y los cancelados o
 * fallidos con al menos una réplica hecha (informe parcial). Cada uno con
 * `hechas` (réplicas terminadas), `n` (réplicas pedidas) y `parcial`.
 * @param {Trabajo[]} lista
 */
export function trabajosReplicas(lista) {
  const propios = lista.filter((x) => x.tipo === TIPO_REPLICAS);
  const listos = propios
    .map((x) => {
      const unidades = Array.isArray(x.unidades) ? x.unidades : [];
      const hechas = unidades.filter((u) => u?.estado === 'hecha').length;
      return { ...x, hechas, n: unidades.length, parcial: x.estado !== 'terminado' };
    })
    .filter((x) => x.estado === 'terminado' || (PARCIALES.includes(x.estado) && x.hechas > 0))
    .sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado)));
  return { listos, enCola: propios.filter((x) => ACTIVOS.includes(x.estado)).length };
}

/** Códigos de error con texto propio en informes.json (`informes.error.cod.<codigo>`). */
export const CODIGOS_ERROR_UI = Object.freeze([...CODIGOS_ERROR, ...CODIGOS_ERROR_PNG]);

/**
 * Texto traducible de un error: si trae un `codigo` conocido, su clave
 * (`informes.error.cod.<codigo>`); si no, null (se muestra su mensaje).
 * @param {unknown} e
 * @returns {string | null}
 */
export function claveError(e) {
  const c = e && typeof e === 'object' && 'codigo' in e ? String(e.codigo) : '';
  return c && CODIGOS_ERROR_UI.includes(c) ? `informes.error.cod.${c}` : null;
}

/**
 * Corridas por defecto de Informes: origen (y A de la Comparación) = la que
 * mira Analizar (`propia`: 'actual' o el id de la guardada) si está entre
 * las opciones, si no la primera; B = la actual si A es una guardada, si no
 * la guardada más reciente que no sea A ('' si no hay otra).
 * @param {string[]} ids opciones (la actual primero, después las guardadas
 *   de la más reciente a la más vieja) @param {string} propia
 * @param {string} actual el id de la corrida actual en las opciones
 */
export function corridasPorDefecto(ids, propia, actual) {
  const origen = ids.includes(propia) ? propia : (ids[0] ?? '');
  const b =
    origen !== actual && ids.includes(actual)
      ? actual
      : (ids.find((x) => x !== origen && x !== actual) ?? '');
  return { origen, a: origen, b };
}

/**
 * Informe «Torneo» (paso N3.5): una temporada de un torneo (League de
 * engine/league.js) con sus partidos. `titulo`: el nombre visible del
 * torneo (traducido si es uno por defecto); `temporada`: la del informe
 * (por defecto la última).
 * @param {import('../../../../engine/league.js').League} L
 * @param {import('../../../../engine/league.js').Match[]} partidos
 * @param {{temporada?: number, titulo?: string, fecha?: string | number | Date}} [o]
 * @returns {import('../../../../engine/report/torneo.js').DatosTorneo}
 */
export function datosTorneo(L, partidos, o = {}) {
  return {
    torneo: structuredClone(L),
    partidos: structuredClone(partidos.filter((m) => !m.league || m.league === L.id)),
    temporada: o.temporada,
    titulo: o.titulo || undefined,
    fecha: o.fecha ?? Date.now(),
  };
}
