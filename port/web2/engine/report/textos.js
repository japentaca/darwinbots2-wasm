// @ts-check
// Textos de los informes (decisión 4: todo texto visible en es y en).
//
// Decisión de este paso: el informe trae sus propios textos en
// engine/report/textos.{es,en}.json en vez de recibir un diccionario de la
// interfaz. Es lo más simple: el informe es un archivo que se genera sin la
// interfaz (puede generarlo un worker o un test), y así engine/ no depende
// de src/i18n. test/informe.test.js verifica que los dos archivos tengan
// las mismas claves y los mismos parámetros, que no mencionen «el
// original» y que cada clave que pueden emitir los detectores (y la
// agrupación del resumen) tenga texto.
//
// Plurales: `{n#singular|plural}` elige la forma según n con
// Intl.PluralRules del idioma ('one' → la primera; cualquier otra
// categoría → la segunda) y no escribe el número: «{n} {n#bot|bots}». Las
// formas pueden llevar parámetros simples («{n#la principal|las {n}
// principales}»).
//
// Los nombres de bots, de especies y de sysvars van como parámetros y no se
// traducen. Los números se formatean según el idioma.

import en from './textos.en.json' with { type: 'json' };
import es from './textos.es.json' with { type: 'json' };

/** @typedef {'es' | 'en'} Idioma */

/** @type {Readonly<Record<Idioma, Readonly<Record<string, string>>>>} */
export const TEXTOS = Object.freeze({ es, en });
export const IDIOMAS = /** @type {readonly Idioma[]} */ (Object.freeze(['es', 'en']));

/**
 * Códigos estables de los errores de los informes (la interfaz los traduce:
 * t('informes.error.cod.<codigo>')).
 *   faltan-corridas  Comparación sin las dos historias
 *   faltan-replicas  Réplicas sin semillas o sin resultados
 *   falta-historia   Corrida sin historia
 *   falta-torneo     Torneo sin temporadas o sin la lista de partidos
 *   tipo             plantilla desconocida
 *   texto            falta un texto del informe (error de programación)
 */
export const CODIGOS_ERROR = Object.freeze([
  'faltan-corridas',
  'faltan-replicas',
  'falta-historia',
  'falta-torneo',
  'falta-barrido',
  'tipo',
  'texto',
]);

/** Error de un informe con `codigo` estable (CODIGOS_ERROR). */
export class ErrorInforme extends Error {
  /** @param {string} codigo @param {string} [detalle] */
  constructor(codigo, detalle) {
    super(detalle ? `informe: ${codigo}: ${detalle}` : `informe: ${codigo}`);
    this.codigo = codigo;
  }
}

/** @param {unknown} x @returns {Idioma} */
export const idiomaValido = (x) => (x === 'en' ? 'en' : 'es');

/**
 * Formateador de números del idioma (enteros con separador de miles; los
 * no enteros con hasta `dec` decimales).
 * @param {Idioma} idioma
 */
export function formatoNumero(idioma) {
  const loc = idioma === 'en' ? 'en-US' : 'es-AR';
  const cache = new Map();
  /** @param {number} x @param {number} [dec] */
  return (x, dec = 1) => {
    if (!Number.isFinite(x)) return '—';
    let f = cache.get(dec);
    if (!f) {
      f = new Intl.NumberFormat(loc, { maximumFractionDigits: dec });
      cache.set(dec, f);
    }
    return f.format(x);
  };
}

/**
 * Traductor de un idioma: `tx(clave, params)` reemplaza `{nombre}` por el
 * parámetro (los números se formatean). Una clave que falta lanza: los
 * tests generan el informe en los dos idiomas y así no se escapa ninguna.
 * @param {Idioma} idioma
 */
export function traductor(idioma) {
  const dic = TEXTOS[idioma];
  const num = formatoNumero(idioma);
  const reglas = new Intl.PluralRules(idioma === 'en' ? 'en-US' : 'es-AR');
  /** @param {string} clave @param {Record<string, unknown>} [p] */
  const tx = (clave, p = {}) => {
    const s = dic[clave];
    if (typeof s !== 'string') throw new ErrorInforme('texto', `«${clave}» (${idioma})`);
    return s
      .replace(PLURAL, (_m, k, uno, otros) => (reglas.select(Number(p[k])) === 'one' ? uno : otros))
      .replace(/\{(\w+)\}/g, (_m, k) => {
        if (!(k in p) || p[k] === undefined || p[k] === null) return '';
        const v = p[k];
        return typeof v === 'number' ? num(v) : String(v);
      });
  };
  return { tx, num, idioma };
}

/**
 * `{x#uno|otros}`: cada forma es texto sin llaves o con parámetros simples
 * `{y}` adentro.
 */
const PLURAL = /\{(\w+)#((?:[^{}|]|\{\w+\})*)\|((?:[^{}|]|\{\w+\})*)\}/g;

/** Parámetros de un texto (`{x}` y `{x#…|…}`), sin repetir y ordenados. @param {string} s */
export const parametrosDe = (s) =>
  [...new Set([...s.matchAll(/\{(\w+)[}#]/g)].map((m) => m[1]))].sort();
