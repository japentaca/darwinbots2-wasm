// @ts-check
// Pestaña Eventos de Analizar (puro): los eventos de la historia de la
// corrida (los del feed de Observar: src/lib/observar/eventos.js, guardados
// sin reducir) agrupados en filtros por tipo.

/** Filtros de la lista: tipos de evento de cada uno (null = todos). */
export const FILTROS = Object.freeze({
  todos: null,
  especies: ['especieNueva', 'llegada'],
  extinciones: ['extincion'],
  records: ['pico', 'generacion'],
  cambios: ['cambio', 'objetos'],
  siembras: ['sembrado', 'inicio'],
  corrida: ['guardada', 'cargada', 'importada'],
});

/** Color del pin de cada tipo en el gráfico. */
const COLORES = Object.freeze({
  extincion: '#151513',
  especieNueva: '#0f5c55',
  llegada: '#0f5c55',
  pico: '#2a78d6',
  generacion: '#2a78d6',
  cambio: '#b8481b',
  objetos: '#b8481b',
  sembrado: '#c98500',
  inicio: '#c98500',
});

/** @param {string} tipo */
export const colorEvento = (tipo) =>
  /** @type {Record<string, string>} */ (COLORES)[tipo] ?? '#898781';

/** Filtro al que pertenece un tipo (el primero que lo nombra). @param {string} tipo */
export function filtroDe(tipo) {
  for (const [k, v] of Object.entries(FILTROS)) if (v?.includes(tipo)) return k;
  return 'todos';
}

/**
 * @typedef {{ciclo: number, tipo: string, params?: Record<string, any>}} EventoAnalizar
 */

/**
 * Eventos en orden de ciclo (estable), con un índice absoluto para las
 * claves y el filtro pedido. `base` = eventos ya descartados por el tope de
 * la historia (Historia.eventosDescartados): así el índice de un evento no
 * cambia cuando se descartan los más viejos y la marca sigue en el mismo.
 * @param {EventoAnalizar[]} eventos @param {string} filtro @param {number} [base]
 */
export function filtrarEventos(eventos, filtro, base = 0) {
  const tipos = /** @type {Record<string, string[] | null>} */ (FILTROS)[filtro] ?? null;
  return eventos
    .map((e, i) => ({ ...e, i: base + i }))
    .filter((e) => Number.isFinite(e.ciclo) && (!tipos || tipos.includes(e.tipo)))
    .sort((a, b) => a.ciclo - b.ciclo || a.i - b.i);
}

/**
 * Cuántos eventos hay en cada filtro.
 * @param {EventoAnalizar[]} eventos
 */
export function cuentas(eventos) {
  /** @type {Record<string, number>} */
  const out = {};
  for (const k of Object.keys(FILTROS)) out[k] = filtrarEventos(eventos, k).length;
  return out;
}
