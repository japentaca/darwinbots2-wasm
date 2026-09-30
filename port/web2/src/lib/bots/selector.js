// @ts-check
// Búsqueda del selector de bots (SelectorBot.svelte, puro): sobre el índice
// de la biblioteca (engine/biblioteca.js), los del foro y los propios, con
// la misma búsqueda que la lista de Bots (coincide: nombre, archivo, tags y
// notas). Orden: el nombre exacto, los que empiezan con lo buscado, los
// favoritos, los propios y el resto, cada tramo por nombre.

import { coincide } from '../../../engine/biblioteca.js';

/** @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada */

/** Cuántos resultados muestra el selector a la vez. */
export const MAX_RESULTADOS = 60;

/**
 * @param {Entrada[]} indice
 * @param {string} q
 * @param {number} [max]
 * @returns {{lista: Entrada[], total: number}}
 */
export function buscarBots(indice, q, max = MAX_RESULTADOS) {
  const txt = String(q ?? '')
    .trim()
    .toLowerCase();
  const hallados = indice.filter((e) => coincide(e, { q: txt }));
  /** @param {Entrada} e */
  const tramo = (e) => {
    const n = e.nombre.toLowerCase();
    if (txt && n === txt) return 0;
    if (txt && n.startsWith(txt)) return 1;
    if (e.marcas.fav) return 2;
    if (e.clase === 'propio') return 3;
    return 4;
  };
  const orden = hallados
    .map((e) => ({ e, t: tramo(e) }))
    .sort(
      (a, b) => a.t - b.t || a.e.nombre.localeCompare(b.e.nombre) || a.e.id.localeCompare(b.e.id),
    )
    .map((x) => x.e);
  return { lista: orden.slice(0, Math.max(0, max)), total: hallados.length };
}
