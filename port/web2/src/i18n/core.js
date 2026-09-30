// @ts-check
// Lógica pura del i18n: sin DOM, sin Svelte, testeable con node:test.

/** @typedef {Record<string, string>} Diccionario */
/** @typedef {Record<string, string | number>} Params */

export const IDIOMAS = /** @type {const} */ (['es', 'en']);
export const IDIOMA_FUENTE = 'es';

/**
 * Reemplaza `{nombre}` por `params.nombre`. Los marcadores sin valor quedan igual.
 * @param {string} texto
 * @param {Params} [params]
 * @returns {string}
 */
export function interpolar(texto, params) {
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (marca, nombre) =>
    Object.hasOwn(params, nombre) ? String(params[nombre]) : marca,
  );
}

/**
 * Traduce una clave: idioma pedido → idioma fuente → la clave misma.
 * @param {Record<string, Diccionario>} diccionarios
 * @param {string} idioma
 * @param {string} clave
 * @param {Params} [params]
 * @returns {string}
 */
export function traducir(diccionarios, idioma, clave, params) {
  const texto = diccionarios[idioma]?.[clave] ?? diccionarios[IDIOMA_FUENTE]?.[clave] ?? clave;
  return interpolar(texto, params);
}

/**
 * Normaliza un código de idioma (`en-US` → `en`); si no es soportado, el fuente.
 * @param {string | null | undefined} codigo
 * @returns {string}
 */
export function normalizarIdioma(codigo) {
  const base = String(codigo ?? '')
    .toLowerCase()
    .split(/[-_]/)[0];
  return /** @type {readonly string[]} */ (IDIOMAS).includes(base) ? base : IDIOMA_FUENTE;
}

/**
 * Idioma y área de un archivo de textos (`./es/observar.json` → es, observar).
 * @param {string} ruta
 * @returns {{ idioma: string, area: string } | null}
 */
export function areaDeRuta(ruta) {
  const m = /(?:^|\/)([a-z]{2})\/([\w-]+)\.json$/.exec(String(ruta).replaceAll('\\', '/'));
  return m ? { idioma: m[1], area: m[2] } : null;
}

/**
 * Junta los archivos por área (decisión C9) en un diccionario por idioma.
 * Cada clave tiene que empezar por `<área>.`; una clave repetida en dos
 * archivos del mismo idioma es un error.
 * @param {{ idioma: string, area: string, dic: Diccionario }[]} archivos
 * @returns {Record<string, Diccionario>}
 */
export function juntarAreas(archivos) {
  /** @type {Record<string, Diccionario>} */
  const out = {};
  /** @type {Record<string, Record<string, string>>} clave → área que la trajo */
  const origen = {};
  for (const { idioma, area, dic } of archivos) {
    out[idioma] ??= {};
    origen[idioma] ??= {};
    for (const [k, v] of Object.entries(dic)) {
      if (!k.startsWith(`${area}.`)) {
        throw new Error(`i18n: la clave ${k} no lleva el prefijo del área ${area} (${idioma})`);
      }
      if (Object.hasOwn(out[idioma], k)) {
        throw new Error(
          `i18n: la clave ${k} está en ${origen[idioma][k]} y en ${area} (${idioma})`,
        );
      }
      out[idioma][k] = v;
      origen[idioma][k] = area;
    }
  }
  return out;
}
