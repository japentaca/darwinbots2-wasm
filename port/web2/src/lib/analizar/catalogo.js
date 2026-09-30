// @ts-check
// Catálogo de gráficos del Panel de Analizar (decisión 7: seis grupos; Nivel
// 2: «Panel (4 gráficos de un catálogo)»), puro. Cada entrada es una serie
// de la historia (engine/history.js):
//
//   g:<clave>  métrica global (db_sim_metrics): una línea con su banda
//              mín–máx en los tramos fundidos;
//   e:<campo>  campo por especie (db_sim_species_stats): áreas apiladas si
//              es un total (bots, energía…), líneas si es una media;
//   c:<campo>  comportamiento por especie (acumulado entre muestras):
//              áreas apiladas.
//
// El texto visible sale de t(`analizar.m.<fuente>.<campo>`) (test de claves
// en test/analizar.test.js). Los nombres de especie no se traducen.

import { Historia } from '../../../engine/history.js';
import { GRUPOS, METRICAS } from '../../../engine/metricas.js';

/**
 * @typedef {object} EntradaCatalogo
 * @property {string} id       'g:vivos', 'e:adnMedia', 'c:nacimientos'
 * @property {'g' | 'e' | 'c'} fuente
 * @property {string} col      columna de la historia
 * @property {string} grupo    uno de GRUPOS
 * @property {'lineas' | 'apilado'} modo
 * @property {boolean} cero    eje Y desde 0 (apilados y conteos); si no, se
 *                             ajusta a los datos cuando el rango es chico
 */

/** Grupos de métricas globales que son conteos (eje desde 0). */
const GRUPOS_CONTEO = new Set(['poblacion', 'comportamiento']);
/** Globales de esos grupos que no son conteos. */
const NO_CONTEO = new Set(['maxAbsNum']);

/** Grupo y modo de cada campo por especie guardado. */
const ESPECIE = Object.freeze({
  vivos: ['poblacion', 'apilado'],
  vegetales: ['poblacion', 'apilado'],
  multibots: ['poblacion', 'apilado'],
  genMedia: ['evolucion', 'lineas'],
  genMin: ['evolucion', 'lineas'],
  genMax: ['evolucion', 'lineas'],
  mutMedia: ['evolucion', 'lineas'],
  mutMax: ['evolucion', 'lineas'],
  edadMedia: ['evolucion', 'lineas'],
  edadMax: ['evolucion', 'lineas'],
  hijosMedia: ['evolucion', 'lineas'],
  adnMedia: ['genetica', 'lineas'],
  adnMin: ['genetica', 'lineas'],
  adnMax: ['genetica', 'lineas'],
  genesMedia: ['genetica', 'lineas'],
  kills: ['comportamiento', 'apilado'],
  shell: ['comportamiento', 'apilado'],
  slime: ['comportamiento', 'apilado'],
  venom: ['comportamiento', 'apilado'],
  poison: ['comportamiento', 'apilado'],
  nrgTotal: ['energia', 'apilado'],
  bodyTotal: ['energia', 'apilado'],
  waste: ['energia', 'apilado'],
  cloroplastos: ['energia', 'apilado'],
});

/** @type {ReadonlyArray<EntradaCatalogo>} */
export const CATALOGO = Object.freeze([
  ...METRICAS.filter((m) => m.clave !== 'ciclo').map(
    (m) =>
      /** @type {EntradaCatalogo} */ ({
        id: `g:${m.clave}`,
        fuente: 'g',
        col: m.clave,
        grupo: m.grupo,
        modo: 'lineas',
        cero: GRUPOS_CONTEO.has(m.grupo) && !NO_CONTEO.has(m.clave),
      }),
  ),
  ...Historia.columnas.especie
    .filter((c) => c in ESPECIE)
    .map((c) => {
      const [grupo, modo] = ESPECIE[/** @type {keyof typeof ESPECIE} */ (c)];
      return /** @type {EntradaCatalogo} */ ({
        id: `e:${c}`,
        fuente: 'e',
        col: c,
        grupo,
        modo,
        cero: modo === 'apilado',
      });
    }),
  ...Historia.columnas.comportamiento
    .filter((c) => c !== 'ticks')
    .map(
      (c) =>
        /** @type {EntradaCatalogo} */ ({
          id: `c:${c}`,
          fuente: 'c',
          col: c,
          grupo: 'comportamiento',
          modo: 'apilado',
          cero: true,
        }),
    ),
]);

const POR_ID = new Map(CATALOGO.map((e) => [e.id, e]));

/** @param {string} id */
export const entrada = (id) => POR_ID.get(id) ?? null;

/** Entradas por grupo, en el orden de GRUPOS. */
export function porGrupo() {
  return GRUPOS.map((g) => ({ grupo: g, entradas: CATALOGO.filter((e) => e.grupo === g) }));
}

/** Clave i18n del nombre de una entrada. @param {EntradaCatalogo} e */
export const claveNombre = (e) => `analizar.m.${e.fuente}.${e.col}`;

/** Los 4 del Panel si no hay nada recordado. */
export const PANEL_POR_DEFECTO = Object.freeze([
  'e:vivos',
  'c:nacimientos',
  'e:adnMedia',
  'g:nrgTotal',
]);
export const CLAVE_PANEL = 'darwinbots2.analizar.panel';

/**
 * Elección válida del Panel: 4 ids del catálogo (lo que falte o no exista
 * se completa con los de por defecto).
 * @param {unknown} v
 * @returns {string[]}
 */
export function panelValido(v) {
  const out = [];
  const lista = Array.isArray(v) ? v : [];
  for (let i = 0; i < 4; i++) {
    const id = lista[i];
    out.push(typeof id === 'string' && POR_ID.has(id) ? id : PANEL_POR_DEFECTO[i]);
  }
  return out;
}

/**
 * La elección recordada (localStorage con try/catch: sin almacenamiento,
 * la de por defecto).
 * @param {{getItem: (k: string) => string | null} | null | undefined} almacen
 */
export function leerPanel(almacen) {
  try {
    const s = almacen?.getItem(CLAVE_PANEL);
    return panelValido(s ? JSON.parse(s) : null);
  } catch {
    return panelValido(null);
  }
}

/**
 * @param {{setItem: (k: string, v: string) => void} | null | undefined} almacen
 * @param {string[]} ids
 */
export function guardarPanel(almacen, ids) {
  try {
    almacen?.setItem(CLAVE_PANEL, JSON.stringify(panelValido(ids)));
  } catch {
    // sin almacenamiento: la elección vale para esta visita
  }
}

// ---- Colores y series ---------------------------------------------------------

/** Paleta de reserva (especies sin color conocido), la de los bocetos. */
export const PALETA = Object.freeze([
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#7aa9e8',
  '#b8481b',
  '#c98500',
  '#6f4bb8',
  '#3aa0a0',
  '#8a8a2a',
]);
export const COLOR_OTRAS = '#a9a79f';
export const COLOR_GLOBAL = '#0f5c55';

/**
 * Color de una especie: el de la corrida o uno de la paleta según su nombre
 * (estable entre gráficos).
 * @param {string} nombre @param {Record<string, string>} colores
 */
export function colorEspecie(nombre, colores) {
  const c = colores[nombre];
  if (c) return c;
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0;
  return PALETA[h % PALETA.length];
}

/**
 * Especies ordenadas por su máximo de bots vivos (las más importantes
 * primero); a igualdad, por nombre.
 * @param {Historia} h
 */
export function especiesPorImportancia(h) {
  return h
    .nombresEspecies()
    .map((nombre) => {
      let max = 0;
      for (const v of h.alineada('vivos', nombre)) if (v > max) max = v;
      return { nombre, max };
    })
    .sort((a, b) => b.max - a.max || a.nombre.localeCompare(b.nombre))
    .map((x) => x.nombre);
}

/**
 * Una columna de especie alineada con el eje global `h.t`: media, mínimo,
 * máximo y muestras por punto; donde la especie no está, NaN (y n = 0), así
 * la línea se corta en la ausencia en vez de unir los huecos (la sparkline
 * de Especies hace lo mismo). `t` es una copia (la historia viva crece).
 * @param {Historia} h @param {string} col @param {string} nombre
 */
export function serieAlineada(h, col, nombre) {
  const t = h.t.slice();
  const v = h.alineada(col, nombre);
  const len = t.length;
  const min = new Array(len).fill(Number.NaN);
  const max = new Array(len).fill(Number.NaN);
  const n = new Array(len).fill(0);
  const s = h.serie(col, nombre);
  if (s) {
    // los t de la serie son un subconjunto creciente de h.t
    let g = 0;
    for (let j = 0; j < s.t.length; j++) {
      while (g < len && t[g] < s.t[j]) g++;
      if (g >= len) break;
      if (t[g] !== s.t[j]) continue;
      min[g] = s.min[j];
      max[g] = s.max[j];
      n[g] = s.n[j];
    }
  }
  return { t, v, min, max, n };
}

/**
 * Series de una entrada del catálogo para Grafico.svelte.
 * @param {Historia} h @param {EntradaCatalogo} e
 * @param {{colores: Record<string, string>, nombreGlobal: string, otras: string,
 *   maxEspecies?: number, especies?: string[], soloEspecie?: string | null}} o
 *   especies: el orden de importancia (si ya se calculó); soloEspecie: solo esa
 * @returns {import('./grafico/geometria.js').SerieGrafico[]}
 */
export function seriesDe(h, e, o) {
  const max = o.maxEspecies ?? 8;
  if (e.fuente === 'g') {
    const s = h.serie(e.col);
    if (!s) return [];
    return [
      {
        clave: e.id,
        nombre: o.nombreGlobal,
        color: COLOR_GLOBAL,
        t: s.t,
        v: s.media,
        min: s.min,
        max: s.max,
        n: s.n,
      },
    ];
  }
  let especies = o.especies ?? especiesPorImportancia(h);
  if (o.soloEspecie) especies = especies.filter((x) => x === o.soloEspecie);
  const top = especies.slice(0, max);
  const resto = especies.slice(max);
  if (e.modo === 'apilado') {
    const t = h.t.slice();
    const series = top.map((nombre) => ({
      clave: nombre,
      nombre,
      color: colorEspecie(nombre, o.colores),
      t,
      v: h.alineada(e.col, nombre),
    }));
    if (resto.length) {
      const v = new Array(t.length).fill(0);
      for (const nombre of resto) {
        const a = h.alineada(e.col, nombre);
        for (let i = 0; i < t.length; i++) if (Number.isFinite(a[i])) v[i] += a[i];
      }
      series.push({ clave: '\u0000otras', nombre: o.otras, color: COLOR_OTRAS, t, v });
    }
    // sin ningún dato: nada que apilar
    return series.some((s) => s.v.some((x) => Number.isFinite(x))) ? series : [];
  }
  /** @type {import('./grafico/geometria.js').SerieGrafico[]} */
  const out = [];
  for (const nombre of top) {
    const s = serieAlineada(h, e.col, nombre);
    if (!s.v.some((x) => Number.isFinite(x))) continue;
    out.push({ clave: nombre, nombre, color: colorEspecie(nombre, o.colores), ...s });
  }
  return out;
}
