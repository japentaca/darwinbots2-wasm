// @ts-check
// De dónde salen las corridas que se comparan: la actual de la página (su
// núcleo, src/lib/sim/corrida-nucleo.js) o una guardada (engine/corridas.js,
// con su historia en corridas-datos, C14). Puro: las dependencias llegan
// como parámetros.

import { Historia } from '../../../../engine/history.js';

/**
 * @typedef {object} Fuente
 * @property {string} id              'actual' o el id de la guardada
 * @property {string} nombre
 * @property {import('../../../../engine/escenarios/index.js').Escenario | null} escenario
 *   el escenario con el que ARRANCÓ (los cambios en caliente van en eventos)
 * @property {number | null} semilla
 * @property {import('../../../../engine/corridas.js').EventoCorrida[]} eventos
 * @property {Historia} historia
 */

export const ID_ACTUAL = 'actual';

/**
 * La corrida actual (null si no hay o no tiene historia).
 * @param {{estado: {escenario: any, semilla: number | null, nombre: string,
 *   eventos: any[]}, historia: Historia} | null | undefined} corrida
 * @param {string} nombrePorDefecto
 * @returns {Fuente | null}
 */
export function fuenteActual(corrida, nombrePorDefecto) {
  if (!corrida) return null;
  const e = corrida.estado;
  return {
    id: ID_ACTUAL,
    nombre: e.nombre || nombrePorDefecto,
    escenario: e.escenario ? structuredClone(e.escenario) : null,
    semilla: e.semilla,
    eventos: structuredClone(e.eventos ?? []),
    historia: corrida.historia,
  };
}

/**
 * Una corrida guardada con su historia (vacía si se guardó sin ella).
 * @param {{cargar: (id: string) => Promise<{corrida: any, extra: Record<string, any>} | null>}} corridas
 * @param {string} id
 * @returns {Promise<Fuente | null>}
 */
export async function fuenteGuardada(corridas, id) {
  const r = await corridas.cargar(id);
  if (!r) return null;
  const c = r.corrida;
  const h = r.extra?.historia ?? c.historia;
  return {
    id,
    nombre: c.nombre,
    escenario: c.escenario ?? null,
    semilla: c.semilla ?? null,
    eventos: c.eventos ?? [],
    historia: h ? Historia.deserializar(h) : new Historia(),
  };
}

/**
 * Serie de una métrica global de una fuente para el gráfico: media y banda
 * (mínimo y máximo de los puntos fundidos; en los demás, la media).
 * @param {Historia} h @param {string} clave
 * @returns {{t: number[], media: number[], bajo: number[], alto: number[]}}
 */
export function serieBanda(h, clave) {
  const s = h.serie(clave);
  if (!s) return { t: [], media: [], bajo: [], alto: [] };
  return { t: s.t, media: s.media, bajo: s.min, alto: s.max };
}
