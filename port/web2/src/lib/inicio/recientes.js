// @ts-check
// «Bots recientes» de Inicio (paso N1.6): los bots de la corrida actual y
// de las guardadas, sin repetir, con su color y la categoría del Bestiary.
// Puro: la corrida actual, la lista de corridas y el índice del Bestiary
// se pasan.

import { CATEGORIAS } from './claves.js';

export const MAX_RECIENTES = 4;

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {{ name: string, board?: string, veg?: boolean }} FilaBestiario
 * @typedef {{
 *   escenario?: Escenario | null,
 *   especies?: string[],
 *   colores?: Record<string, string>,
 * }} FuenteBots
 * @typedef {{ nombre: string, color: string | null, vegetal: boolean,
 *   categoria: string | null }} BotReciente
 *   categoria = sufijo de `inicio.categoria.` (null = sin dato)
 */

/**
 * Categoría de un bot: la del tablero del Bestiary, 'propio' si el
 * escenario lo marca así, o null.
 * @param {FilaBestiario | undefined} fila @param {string | undefined} origen
 * @returns {string | null}
 */
export function categoriaDe(fila, origen) {
  if (fila?.board && CATEGORIAS[fila.board]) return CATEGORIAS[fila.board];
  if (fila?.veg) return 'vegetal';
  if (origen === 'propio') return 'propio';
  return null;
}

/**
 * Bots de una corrida en orden: primero los animales del escenario, después
 * sus vegetales, después las especies vistas que no estaban en el escenario.
 * @param {FuenteBots} f
 * @returns {{ nombre: string, color: string | null, vegetal: boolean, origen?: string }[]}
 */
function botsDe(f) {
  const out = [];
  const esp = f.escenario?.especies ?? [];
  const orden = [...esp.filter((s) => !s.vegetal), ...esp.filter((s) => s.vegetal)];
  for (const s of orden)
    out.push({
      nombre: s.bot,
      color: f.colores?.[s.bot] ?? s.color ?? null,
      vegetal: !!s.vegetal,
      origen: s.origen,
    });
  for (const n of f.especies ?? [])
    if (esNombreDeBot(n)) out.push({ nombre: n, color: f.colores?.[n] ?? null, vegetal: false });
  return out;
}

/**
 * ¿Es el nombre de un bot? No lo son los cadáveres ('Corpse'), la especie
 * desconocida ('?') ni los grupos por color de la vista clásica ('#…').
 * @param {unknown} n
 * @returns {n is string}
 */
export function esNombreDeBot(n) {
  return typeof n === 'string' && n !== '' && n !== '?' && n !== 'Corpse' && !n.startsWith('#');
}

/**
 * Hasta `max` bots: los de la corrida actual y después los de las
 * guardadas (en el orden recibido: la más reciente primero), sin repetir
 * nombres. El color es el primero conocido; la categoría sale del Bestiary.
 * @param {{ actual?: FuenteBots | null, corridas?: FuenteBots[],
 *   bestiario?: FilaBestiario[] | null, max?: number }} o
 * @returns {BotReciente[]}
 */
export function botsRecientes(o) {
  const max = o.max ?? MAX_RECIENTES;
  const porNombre = new Map((o.bestiario ?? []).map((b) => [b.name, b]));
  /** @type {Map<string, BotReciente>} */
  const vistos = new Map();
  const fuentes = [...(o.actual ? [o.actual] : []), ...(o.corridas ?? [])];
  for (const f of fuentes)
    for (const b of botsDe(f)) {
      const ya = vistos.get(b.nombre);
      if (ya) {
        if (!ya.color && b.color) ya.color = b.color;
        continue;
      }
      if (vistos.size >= max) continue;
      const fila = porNombre.get(b.nombre);
      vistos.set(b.nombre, {
        nombre: b.nombre,
        color: b.color,
        vegetal: b.vegetal || !!fila?.veg,
        categoria: categoriaDe(fila, b.origen),
      });
    }
  return [...vistos.values()];
}
