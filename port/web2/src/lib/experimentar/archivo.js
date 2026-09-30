// @ts-check
// Escenarios propios (decisión 12): armado a partir del borrador, ids,
// exportar e importar .json y los textos de error por código. Lógica pura
// (sin DOM ni IndexedDB: el almacén va en ./propios.js).

import {
  IDS_FABRICA,
  normalizarPropio,
  validarPropio,
} from '../../../engine/escenarios/fabrica.js';
import { ErrorEscenario, textoEn } from '../../../engine/escenarios/index.js';

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../../engine/escenarios/index.js').ErrorValidacion} ErrorValidacion
 * @typedef {(clave: string, params?: Record<string, string | number>) => string} Traductor
 * @typedef {{clave: string, params?: Record<string, string | number>}} Mensaje
 */

/**
 * Códigos de validación con texto (experimentar.validacion.<código>): los
 * de validar() de engine/escenarios, los de normalizarValor() de
 * engine/opciones.js y los de la lectura del archivo ('json', 'vacio').
 * El test comprueba que cubren los del motor.
 */
export const CODIGOS_VALIDACION = Object.freeze([
  'json',
  'vacio',
  'no-objeto',
  'formato',
  'id',
  'id-reservado',
  'nombre',
  'descripcion',
  'etiquetas',
  'destino',
  'opciones',
  'base',
  'clave-desconocida',
  'clave-derivada',
  'valor-tipo',
  'valor-enum',
  'valor-rango',
  'especies',
  'especie',
  'especie-bot',
  'especie-origen',
  'especie-hash',
  'especie-cantidad',
  'especie-color',
  'especie-vegetal',
  'especie-energia',
  'especie-adn',
  'especie-hash-adn',
  'objetos',
  'obstaculo',
  'obstaculo-tamano',
  'obstaculo-forma',
  'obstaculo-tipo',
  'teleporter',
  'teleporters-tope',
]);

/** Códigos de ErrorAlmacen (engine/almacen.js) con texto propio. */
export const CODIGOS_ALMACEN = Object.freeze(['version-vieja', 'sin-indexeddb']);

/**
 * Id [a-z0-9-] a partir de un texto (sin tildes), que no choque con los de
 * fábrica ni con `ocupados` (sufijo -2, -3…).
 * @param {string} texto @param {Iterable<string>} [ocupados]
 */
export function idLibre(texto, ocupados = []) {
  const usados = new Set([...IDS_FABRICA, ...ocupados]);
  const base =
    String(texto ?? '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50)
      .replace(/-+$/, '') || 'escenario';
  if (!usados.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}-${n}`;
    if (!usados.has(id)) return id;
  }
}

/**
 * Etiquetas escritas separadas por comas (sin vacías ni repetidas).
 * @param {unknown} texto
 * @returns {string[]}
 */
export function parsearEtiquetas(texto) {
  const out = [];
  for (const x of String(texto ?? '').split(',')) {
    const e = x.trim();
    if (e && !out.includes(e)) out.push(e);
  }
  return out;
}

/**
 * Escenario propio a partir del borrador, con nombre, descripción y
 * etiquetas. `id`: el de un propio que se reemplaza; si falta, uno libre.
 * @param {Escenario} b
 * @param {{nombre: string, descripcion?: string, etiquetas?: string[], id?: string}} meta
 * @param {Iterable<string>} [ocupados]  ids de los propios que ya existen
 * @returns {{ok: true, escenario: Escenario} | {ok: false, errores: ErrorValidacion[]}}
 */
export function comoPropio(b, meta, ocupados = []) {
  const nombre = String(meta.nombre ?? '').trim();
  const x = {
    ...structuredClone(b),
    id: meta.id ?? idLibre(nombre, ocupados),
    nombre,
    descripcion: String(meta.descripcion ?? '').trim(),
    etiquetas: [...(meta.etiquetas ?? [])],
  };
  const errores = validarPropio(x);
  if (errores.length) return { ok: false, errores };
  return { ok: true, escenario: normalizarPropio(x) };
}

/**
 * Copia propia de un escenario (p. ej. uno de fábrica): mismo contenido,
 * nombre «<nombre> (copia)» en el idioma y un id libre.
 * @param {Escenario} e @param {'es' | 'en'} idioma @param {string} sufijo  « (copia)»
 * @param {Iterable<string>} [ocupados]
 * @returns {Escenario}
 */
export function duplicar(e, idioma, sufijo, ocupados = []) {
  const nombre = `${textoEn(e.nombre, idioma)}${sufijo}`;
  const descripcion = e.descripcion ? textoEn(e.descripcion, idioma) : '';
  const r = comoPropio(e, { nombre, descripcion, etiquetas: e.etiquetas }, ocupados);
  if (!r.ok) throw new ErrorEscenario('invalido', r.errores);
  return r.escenario;
}

/**
 * Texto del .json exportado.
 * @param {Escenario} e
 */
export const exportarEscenario = (e) => `${JSON.stringify(e, null, 2)}\n`;

/**
 * Lee un .json importado. Si su id es el de uno de fábrica o el de un propio
 * que ya existe, se le da uno libre (se importa como escenario nuevo, sin
 * pisar nada).
 * @param {string} texto @param {Iterable<string>} [ocupados]
 * @returns {{ok: true, escenario: Escenario, renombrado: boolean}
 *   | {ok: false, errores: ErrorValidacion[]}}
 */
export function importarEscenario(texto, ocupados = []) {
  if (String(texto ?? '').trim() === '')
    return { ok: false, errores: [{ codigo: 'vacio', ruta: '' }] };
  /** @type {unknown} */
  let x;
  try {
    x = JSON.parse(texto);
  } catch (e) {
    return {
      ok: false,
      errores: [{ codigo: 'json', ruta: '', detalle: e instanceof Error ? e.message : String(e) }],
    };
  }
  let renombrado = false;
  const ocup = new Set(ocupados);
  if (typeof x === 'object' && x !== null && !Array.isArray(x)) {
    const o = /** @type {Record<string, any>} */ (x);
    if (typeof o.id === 'string' && (IDS_FABRICA.includes(o.id) || ocup.has(o.id))) {
      x = { ...o, id: idLibre(o.id, ocup) };
      renombrado = true;
    }
  }
  const errores = validarPropio(x);
  if (errores.length) return { ok: false, errores };
  return { ok: true, escenario: normalizarPropio(x), renombrado };
}

/**
 * Texto de un error de validación (código conocido o uno genérico).
 * @param {ErrorValidacion} e @param {Traductor} tr
 */
export function textoValidacion(e, tr) {
  const params = { ruta: e.ruta || '—', detalle: e.detalle ?? '' };
  if (CODIGOS_VALIDACION.includes(e.codigo))
    return tr(`experimentar.validacion.${e.codigo}`, params);
  return tr('experimentar.validacion.otro', { ...params, codigo: e.codigo });
}

/**
 * Clave y parámetros del texto de un error cualquiera (almacén, escenario,
 * otro).
 * @param {unknown} err
 * @returns {Mensaje}
 */
export function mensajeError(err) {
  const e = /** @type {any} */ (err);
  if (e && e.name === 'QuotaExceededError') return { clave: 'experimentar.error.cuota' };
  if (e instanceof ErrorEscenario) {
    if (e.codigo === 'sin-adn')
      return { clave: 'experimentar.error.sinAdn', params: { bot: e.errores[0]?.detalle ?? '' } };
    if (e.codigo === 'semilla') return { clave: 'experimentar.error.semilla' };
    return { clave: 'experimentar.error.invalido' };
  }
  if (e && typeof e.codigo === 'string' && CODIGOS_ALMACEN.includes(e.codigo))
    return { clave: `experimentar.error.almacen.${e.codigo}` };
  const msg = e instanceof Error ? e.message : String(err);
  const conocido = codigoError(msg);
  if (conocido) return { clave: `experimentar.error.${conocido}`, params: { msg } };
  return { clave: 'experimentar.error.otro', params: { msg } };
}

/**
 * Errores sin clase propia que se reconocen por el mensaje (texto:
 * experimentar.error.<código>):
 *   fabricaInexistente  el escenario de fábrica pedido no existe
 *   borrarFabrica       se intentó borrar uno de fábrica (propios.js)
 *   bestiario           no se pudo leer classic/bots/bots.json
 *   bestiarioBot        no se pudo leer el .txt de un bot del Bestiary
 */
export const ERRORES_CONOCIDOS = Object.freeze(
  /** @type {[RegExp, string][]} */ ([
    [/^sin escenario /, 'fabricaInexistente'],
    [/^de fábrica: /, 'borrarFabrica'],
    [/^bots\.json: /, 'bestiario'],
    [/\.txt: \d+$/, 'bestiarioBot'],
  ]),
);

/**
 * Código de un error conocido por su mensaje, o '' si no lo es.
 * @param {string} msg
 */
export function codigoError(msg) {
  for (const [re, codigo] of ERRORES_CONOCIDOS) if (re.test(msg)) return codigo;
  return '';
}
