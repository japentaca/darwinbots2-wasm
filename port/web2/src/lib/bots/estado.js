// @ts-check
// Estado de la biblioteca de Bots (paso N3.2, puro): filtros, vista
// (agrupar y ordenar), grupos plegados y la selección múltiple (un Set de
// claves, como la clásica: los archivos del foro con el mismo ADN comparten
// clave y se eligen juntos). Todo devuelve copias: la interfaz guarda el
// resultado en runes ($state.raw).
//
// Lo que se filtra, ordena y agrupa es de engine/biblioteca.js (filtrar,
// ordenar, agrupar); acá se arma la vista con los contadores de selección
// de cada grupo.

import { AGRUPACIONES, agrupar, filtrar, ORDENES, ordenar } from '../../../engine/biblioteca.js';

/**
 * @typedef {import('../../../engine/biblioteca.js').Entrada} Entrada
 * @typedef {import('../../../engine/biblioteca.js').Filtro} Filtro
 * @typedef {import('../../../engine/biblioteca.js').Agrupacion} Agrupacion
 * @typedef {import('../../../engine/biblioteca.js').ClaveGrupo} ClaveGrupo
 * @typedef {'todos' | 'favoritos' | 'propios'} ModoRapido
 * @typedef {{agrupar: Agrupacion, orden: string}} Vista
 * @typedef {'todos' | 'algunos' | 'ninguno'} EstadoGrupo
 * @typedef {{id: string, clave: ClaveGrupo, entradas: Entrada[], nSel: number,
 *   estado: EstadoGrupo, plegado: boolean}} GrupoVista
 */

/** Valor del selector de tag que significa «sin tags» (Filtro.tag = null). */
export const TAG_SIN = '\u0000';

/** @returns {Required<Filtro>} */
export const filtroInicial = () => ({
  q: '',
  foro: '',
  arquetipo: '',
  tamano: '',
  tag: '',
  fav: false,
  soloSeleccion: false,
  origen: '',
  caps: {},
});

/** Agrupar por arquetipo y ordenar por nombre, como abre la clásica. @returns {Vista} */
export const vistaInicial = () => ({ agrupar: 'arquetipo', orden: 'nombre' });

/**
 * Vista válida (valores desconocidos → los iniciales).
 * @param {any} v @returns {Vista}
 */
export function normalizarVista(v) {
  const i = vistaInicial();
  return {
    agrupar: AGRUPACIONES.includes(v?.agrupar) ? v.agrupar : i.agrupar,
    orden: ORDENES.includes(v?.orden) ? v.orden : i.orden,
  };
}

/**
 * El modo del selector rápido (Todos / Favoritos / Propios) que corresponde
 * al filtro.
 * @param {Filtro} f @returns {ModoRapido}
 */
export function modoRapido(f) {
  if (f.origen === 'propio' && !f.fav) return 'propios';
  if (f.fav && !f.origen) return 'favoritos';
  return 'todos';
}

/**
 * Filtro con el modo rápido aplicado (pisa `fav` y `origen`).
 * @param {Filtro} f @param {ModoRapido} modo @returns {Filtro}
 */
export function conModoRapido(f, modo) {
  return {
    ...f,
    fav: modo === 'favoritos',
    origen: modo === 'propios' ? 'propio' : '',
  };
}

/**
 * Valor del selector de tag → Filtro.tag.
 * @param {string} v @returns {string | null}
 */
export const tagDeSelector = (v) => (v === TAG_SIN ? null : v);

/**
 * Filtro.tag → valor del selector.
 * @param {string | null | undefined} tag
 */
export const selectorDeTag = (tag) => (tag === null ? TAG_SIN : (tag ?? ''));

/**
 * Filtro de capacidades con `cap` rotada como en la clásica: sin filtro →
 * requerida (1) → excluida (-1) → sin filtro.
 * @param {Record<string, 1 | -1>} caps @param {string} cap
 * @returns {Record<string, 1 | -1>}
 */
export function ciclarCap(caps, cap) {
  const m = caps[cap] ?? 0;
  const out = { ...caps };
  if (m === 0) out[cap] = 1;
  else if (m === 1) out[cap] = -1;
  else delete out[cap];
  return out;
}

/**
 * Cuántos filtros «avanzados» hay puestos (los del panel desplegable: foro,
 * arquetipo, tamaño, tag, solo la selección y capacidades).
 * @param {Filtro} f
 */
export function filtrosAvanzados(f) {
  let n = 0;
  if (f.foro) n++;
  if (f.arquetipo) n++;
  if (f.tamano) n++;
  if (f.tag !== '' && f.tag !== undefined) n++;
  if (f.soloSeleccion) n++;
  n += Object.keys(f.caps ?? {}).length;
  return n;
}

/**
 * ¿Hay algún filtro puesto (búsqueda incluida)?
 * @param {Filtro} f
 */
export const hayFiltro = (f) =>
  filtrosAvanzados(f) > 0 || !!String(f.q ?? '').trim() || !!f.fav || !!f.origen;

/** Id estable de un grupo (para plegarlo). @param {Agrupacion} como @param {unknown} valor */
export const idGrupo = (como, valor) => `${como}|${String(valor)}`;

/**
 * Estado de la selección en una lista de entradas.
 * @param {Entrada[]} entradas @param {Set<string>} sel
 * @returns {{nSel: number, estado: EstadoGrupo}}
 */
export function estadoSeleccion(entradas, sel) {
  const claves = new Set(entradas.map((e) => e.clave));
  let nSel = 0;
  for (const k of claves) if (sel.has(k)) nSel++;
  const estado = nSel === 0 ? 'ninguno' : nSel === claves.size ? 'todos' : 'algunos';
  return { nSel, estado };
}

/**
 * La vista de la biblioteca: filtrada, ordenada y agrupada, con la
 * selección de cada grupo y si está plegado.
 * @param {Entrada[]} indice @param {Filtro} f @param {Vista} v
 * @param {Set<string>} sel @param {Set<string>} [plegados] ids de grupo
 * @returns {{visibles: Entrada[], grupos: GrupoVista[]}}
 */
export function armarVista(indice, f, v, sel, plegados = new Set()) {
  const visibles = filtrar(indice, f, sel);
  const ordenadas = ordenar(visibles, v.orden);
  const grupos = agrupar(ordenadas, v.agrupar).map((g) => {
    const id = idGrupo(g.clave.tipo, g.clave.valor);
    return { id, ...g, ...estadoSeleccion(g.entradas, sel), plegado: plegados.has(id) };
  });
  return { visibles, grupos };
}

// ---- Selección múltiple ---------------------------------------------------------

/** Claves distintas de una lista, en orden. @param {Entrada[]} l */
export const clavesDe = (l) => [...new Set(l.map((e) => e.clave))];

/**
 * Selección con `clave` agregada o quitada.
 * @param {Set<string>} sel @param {string} clave @returns {Set<string>}
 */
export function alternar(sel, clave) {
  const s = new Set(sel);
  if (s.has(clave)) s.delete(clave);
  else s.add(clave);
  return s;
}

/** @param {Set<string>} sel @param {Iterable<string>} claves @returns {Set<string>} */
export function agregarClaves(sel, claves) {
  const s = new Set(sel);
  for (const k of claves) s.add(k);
  return s;
}

/** @param {Set<string>} sel @param {Iterable<string>} claves @returns {Set<string>} */
export function quitarClaves(sel, claves) {
  const s = new Set(sel);
  for (const k of claves) s.delete(k);
  return s;
}

/**
 * La casilla de un grupo (como la clásica): si todo el grupo está elegido,
 * lo quita; si no, lo agrega entero.
 * @param {Set<string>} sel @param {Entrada[]} entradas @returns {Set<string>}
 */
export function alternarGrupo(sel, entradas) {
  const claves = clavesDe(entradas);
  return claves.every((k) => sel.has(k)) ? quitarClaves(sel, claves) : agregarClaves(sel, claves);
}

/**
 * Selección cargada desde una selección con nombre: solo las claves que
 * están en el índice (las de bots borrados se ignoran, como la clásica).
 * @param {{claves: string[]}} guardada @param {Entrada[]} indice @returns {Set<string>}
 */
export function seleccionDesde(guardada, indice) {
  const hay = new Set(indice.map((e) => e.clave));
  return new Set(guardada.claves.filter((k) => hay.has(k)));
}

/**
 * Selección sin las claves que ya no están en el índice (tras borrar un
 * propio o recargar).
 * @param {Set<string>} sel @param {Entrada[]} indice @returns {Set<string>}
 */
export function podarSeleccion(sel, indice) {
  const hay = new Set(indice.map((e) => e.clave));
  const s = new Set([...sel].filter((k) => hay.has(k)));
  return s.size === sel.size ? sel : s;
}

/**
 * Plegados con un grupo alternado.
 * @param {Set<string>} plegados @param {string} id @returns {Set<string>}
 */
export const alternarPlegado = (plegados, id) => alternar(plegados, id);
