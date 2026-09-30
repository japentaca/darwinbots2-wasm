// @ts-check
// Datos que lee Inicio (paso N1.6): escenarios propios del almacén
// 'escenarios' de darwinbots2 (decisión 17), una semilla nueva y la
// traducción de errores a claves de aviso y la forma plural de un número.

import { almacenIndexedDB } from '../../../engine/almacen.js';
import { normalizarPropio } from '../../../engine/escenarios/fabrica.js';
import { avisoDeError, CLAVES_ERROR } from '../observar/errores.js';
import { ERRORES, ETIQUETAS } from './claves.js';

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../../engine/almacen.js').Almacen} Almacen
 */

/**
 * Separa las filas del almacén en escenarios válidos (normalizados, por
 * nombre) y la cantidad de inválidos (se omiten: la galería no se rompe).
 * @param {unknown[]} filas @param {'es' | 'en'} [idioma]
 * @returns {{ validos: Escenario[], invalidos: number }}
 */
export function separarPropios(filas, idioma = 'es') {
  /** @type {Escenario[]} */
  const validos = [];
  let invalidos = 0;
  for (const f of filas ?? []) {
    try {
      validos.push(normalizarPropio(f));
    } catch {
      invalidos++;
    }
  }
  /** @param {Escenario} e */
  const n = (e) => (typeof e.nombre === 'string' ? e.nombre : e.nombre[idioma] || e.nombre.es);
  validos.sort((a, b) => n(a).localeCompare(n(b), idioma));
  return { validos, invalidos };
}

/** @type {Almacen | null} */
let almacen = null;

/**
 * Escenarios propios (IndexedDB). Rechaza si la base no abre.
 * @param {'es' | 'en'} [idioma]
 */
export async function listarPropios(idioma = 'es') {
  almacen ??= almacenIndexedDB();
  return separarPropios(await almacen.list('escenarios'), idioma);
}

/** Semilla nueva en [1, 2^31-2]. */
export const semillaNueva = () => 1 + Math.floor(Math.random() * 2147483646);

/**
 * Sufijo de `inicio.etiqueta.` de una etiqueta, o null si no tiene
 * traducción (se muestra tal cual).
 * @param {string} etiqueta
 */
export const claveEtiqueta = (etiqueta) =>
  Object.hasOwn(ETIQUETAS, etiqueta) ? ETIQUETAS[etiqueta] : null;

/** @type {Map<string, Intl.PluralRules>} */
const reglasPlural = new Map();

/**
 * Forma plural de `n` en el idioma: 'uno' o 'otros' (sufijo de las claves
 * de PLURALES; es y en solo distinguen «one» de «other»).
 * @param {number} n @param {string} idioma
 * @returns {'uno' | 'otros'}
 */
export function formaPlural(n, idioma) {
  let r = reglasPlural.get(idioma);
  if (!r) {
    r = new Intl.PluralRules(idioma);
    reglasPlural.set(idioma, r);
  }
  return r.select(n) === 'one' ? 'uno' : 'otros';
}

/**
 * Clave y parámetros de un error, según su clase o código:
 *   ErrorCorrida / ErrorConexion con texto propio   observar.aviso.error.*
 *     (src/lib/observar/errores.js: inexistente, sinDbsim, dbsimInvalido…)
 *   ErrorTxt (desde-txt.js)                         inicio.error.<clave> {archivo}
 *   ErrorAlmacen 'version-vieja'                    inicio.error.versionVieja
 *   ErrorEscenario 'sin-adn'                        inicio.error.sinAdn {bot}, o
 *     inicio.error.sinAlga al sembrar un .txt (el único ADN que se busca es
 *     el del alga: el del bot viene en el archivo)
 *   cualquier otro                                  inicio.error.<contexto> {msg}
 * @param {unknown} e
 * @param {'iniciar' | 'retomar' | 'archivo' | 'corridas' | 'escenarios' | 'bestiario'} contexto
 * @returns {{ clave: string, params: Record<string, string> }}
 */
export function claveError(e, contexto) {
  const err = /** @type {any} */ (e);
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (err?.name === 'ErrorCorrida' || err?.name === 'ErrorConexion') {
    const a = avisoDeError(err);
    if (CLAVES_ERROR.includes(a.clave) && !/\.(desconocido|otro)$/.test(a.clave))
      return { clave: a.clave, params: a.params ?? {} };
  }
  if (err?.name === 'ErrorTxt' && ERRORES.includes(err.clave))
    return { clave: `inicio.error.${err.clave}`, params: { archivo: String(err.archivo ?? '') } };
  if (err?.codigo === 'version-vieja') return { clave: 'inicio.error.versionVieja', params: {} };
  if (err?.codigo === 'sin-adn') {
    if (contexto === 'archivo') return { clave: 'inicio.error.sinAlga', params: {} };
    return {
      clave: 'inicio.error.sinAdn',
      params: { bot: String(err.errores?.[0]?.detalle ?? '') },
    };
  }
  return { clave: `inicio.error.${contexto}`, params: { msg } };
}
