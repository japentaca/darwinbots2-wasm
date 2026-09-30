// @ts-check
// De dónde lee Analizar: la corrida actual (en vivo, la de
// src/lib/sim/corrida.svelte.js) o una guardada (solo lectura: su historia
// y su linaje salen de corridas-datos, C14, sin cargar la sim). Puro: el
// almacén de corridas se inyecta.

import { Historia } from '../../../engine/history.js';
import { Linaje } from '../../../engine/lineage.js';

/**
 * @typedef {object} FuenteAnalisis
 * @property {'actual' | 'guardada'} tipo
 * @property {string | null} id
 * @property {string} nombre
 * @property {number | null} semilla
 * @property {any} escenario
 * @property {Historia} historia
 * @property {Linaje} linaje
 * @property {Record<string, string>} colores
 */

/**
 * Colores de las especies de una corrida guardada: los del escenario y los
 * de las siembras en caliente (el resto sale de la paleta).
 * @param {any} corrida
 * @returns {Record<string, string>}
 */
export function coloresDe(corrida) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const s of corrida?.escenario?.especies ?? [])
    if (s?.bot && typeof s.color === 'string') out[s.bot] ??= s.color;
  for (const ev of corrida?.eventos ?? [])
    if (ev?.tipo === 'siembra' && ev.especie?.nombre) out[ev.especie.nombre] ??= ev.especie.color;
  return out;
}

/**
 * Fuente de una corrida guardada a partir de lo que devuelve
 * corridas.cargar(id) (engine/corridas.js). Acepta las viejas, con la
 * historia en los metadatos (antes de C14) o sin linaje.
 * @param {{corrida: any, extra?: Record<string, any>}} r
 * @returns {FuenteAnalisis}
 */
export function fuenteGuardada(r) {
  const c = r.corrida ?? {};
  const extra = r.extra ?? {};
  const hist = extra.historia ?? c.historia;
  return {
    tipo: 'guardada',
    id: c.id ?? null,
    nombre: c.nombre ?? '',
    semilla: c.semilla ?? null,
    escenario: c.escenario ?? null,
    historia: hist ? Historia.deserializar(hist) : new Historia(),
    linaje: extra.linaje ? Linaje.deserializar(extra.linaje) : new Linaje(),
    colores: coloresDe(c),
  };
}

/**
 * Carga una guardada (null si no existe).
 * @param {{cargar: (id: string) => Promise<any>}} corridas @param {string} id
 */
export async function cargarGuardada(corridas, id) {
  const r = await corridas.cargar(id);
  return r ? fuenteGuardada(r) : null;
}

/**
 * Fuente de la corrida actual (la historia y el linaje son los vivos del
 * núcleo: se leen de nuevo en cada actualización).
 * @param {{historia: Historia, linaje: Linaje, estado: {nombre: string, id: string | null,
 *   semilla: number | null, escenario: any, colores: Record<string, string>}}} nucleo
 * @returns {FuenteAnalisis}
 */
export function fuenteActual(nucleo) {
  const e = nucleo.estado;
  return {
    tipo: 'actual',
    id: e.id,
    nombre: e.nombre,
    semilla: e.semilla,
    escenario: e.escenario,
    historia: nucleo.historia,
    linaje: nucleo.linaje,
    colores: e.colores,
  };
}
