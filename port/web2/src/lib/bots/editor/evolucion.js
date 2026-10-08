// @ts-check
// Lógica pura de PanelEvolucionar («Evolucionar», PLAN-EDITOR E4.4): sin DOM
// ni Svelte, así se prueba en node. Lo que el panel no hace a mano: revisar los
// campos antes de pedir variantes, el diff de una variante con la forma que
// espera DiffGenes, la nota de adopción, el último trabajo de este bot, su
// progreso, la clave de cada error y la semilla de cada ronda.
//
// Numeración: las variantes son base 0 en el trabajo (`i`, el orden del
// worker); al usuario se le muestran desde 1 («Variante 1»), y la nota de
// adopción usa la misma numeración.

import { diffGenes } from '../../../../engine/lineage.js';
import {
  ErrorEvolucion,
  LIMITES_EVOLUCION,
  MUTACIONES,
  TIPO_EVOLUCION,
} from '../../trabajos/evolucion.js';
import { LIMITES } from '../../trabajos/prueba.js';

/** Intensidades que ofrece el panel (el factor de db_sim_bot_mutate). */
export const INTENSIDADES = Object.freeze([1, 4, 16]);

/** Tipos de mutación del panel: el valor del motor (`mutaciones`) y su clave de texto. */
export const TIPOS_MUTACION = Object.freeze([
  Object.freeze({ valor: 2, clave: 'ambos' }),
  Object.freeze({ valor: 0, clave: 'vida' }),
  Object.freeze({ valor: 1, clave: 'reproduccion' }),
]);

/** Códigos de ErrorEvolucion (src/lib/trabajos/evolucion.js). */
const CODIGOS_EVOLUCION = Object.freeze([
  'textos',
  'sinVariantes',
  'k',
  'mutaciones',
  'factor',
  'indice',
]);
/** Códigos de ErrorPrueba (los de parámetros de la prueba que usa la evolución). */
const CODIGOS_PRUEBA = Object.freeze([
  'adn',
  'modo',
  'base',
  'copias',
  'ciclos',
  'semillas',
  'semilla',
  'alga',
  'indice',
]);

/**
 * Clave de i18n del mensaje de un error de parámetros de la evolución o de la
 * prueba, o null si el código no es de ninguna de las dos.
 * @param {string | undefined} codigo
 * @returns {string | null}
 */
export function claveError(codigo) {
  if (!codigo) return null;
  if (CODIGOS_EVOLUCION.includes(codigo)) return `editor.evolucion.error.${codigo}`;
  if (CODIGOS_PRUEBA.includes(codigo)) return `editor.probar.error.${codigo}`;
  return null;
}

/**
 * Valida los campos de una ronda antes de pedir las variantes (el worker
 * acotaría k en silencio; la cuenta de variantes no debe llegar sin control).
 * Lanza ErrorEvolucion ('k', 'factor' o 'mutaciones'); devuelve los valores
 * numéricos.
 * @param {{k: unknown, factor: unknown, mutaciones: unknown}} o
 * @returns {{k: number, factor: number, mutaciones: number}}
 */
export function comprobarRonda(o) {
  const k = Math.trunc(Number(o.k));
  if (!(k >= LIMITES_EVOLUCION.k[0] && k <= LIMITES_EVOLUCION.k[1]))
    throw new ErrorEvolucion('k', String(o.k));
  const factor = Math.trunc(Number(o.factor));
  if (!(factor >= LIMITES_EVOLUCION.factor[0] && factor <= LIMITES_EVOLUCION.factor[1]))
    throw new ErrorEvolucion('factor', String(o.factor));
  const mutaciones = Number(o.mutaciones);
  if (!MUTACIONES.includes(mutaciones))
    throw new ErrorEvolucion('mutaciones', String(o.mutaciones));
  return { k, factor, mutaciones };
}

/**
 * Diff de una variante contra el texto de referencia, con la forma de
 * diffVersiones (engine/bots.js) que espera DiffGenes: sin origen de los genes.
 * @param {string} original @param {string} variante
 */
export function adaptarDiff(original, variante) {
  return { ...diffGenes(original, variante), origenesA: null, origenesB: null };
}

/**
 * La nota que se sugiere al adoptar la variante i (base 0).
 * @param {(clave: string, params?: Record<string, string | number>) => string} t
 * @param {{i: number, semilla: number, factor: number}} o
 */
export function notaAdopcion(t, { i, semilla, factor }) {
  return t('editor.evolucion.notaAdoptada', {
    n: i + 1,
    semilla,
    factor: t('editor.evolucion.factor', { f: factor }),
  });
}

/**
 * El último trabajo de evolución de esta clave (el más nuevo por `creado`), o
 * null. Ignora los trabajos de otros tipos (la prueba, por ejemplo).
 * @template {{tipo?: string, params?: any, creado?: string}} T
 * @param {T[]} lista @param {string} clave
 * @returns {T | null}
 */
export function ultimoTrabajo(lista, clave) {
  const propios = lista.filter((x) => x.tipo === TIPO_EVOLUCION && x.params?.clave === clave);
  propios.sort((a, b) => String(b.creado ?? '').localeCompare(String(a.creado ?? '')));
  return propios[0] ?? null;
}

/**
 * Progreso 0..1 de un trabajo: cada unidad cuenta 1 cuando está hecha y su
 * fracción mientras corre.
 * @param {{unidades?: {estado?: string, progreso?: number}[]} | null} trabajo
 */
export function progresoTrabajo(trabajo) {
  const us = trabajo?.unidades;
  if (!us?.length) return 0;
  return us.reduce((a, u) => a + (u.estado === 'hecha' ? 1 : u.progreso || 0), 0) / us.length;
}

/**
 * Semilla de una ronda: entera en 1..SEMILLA_MAX. `azar` (Math.random por
 * defecto) se inyecta para probarla.
 * @param {() => number} [azar]
 */
export function semillaAleatoria(azar = Math.random) {
  const max = LIMITES.semilla[1];
  return Math.min(max, 1 + Math.floor(azar() * max));
}
