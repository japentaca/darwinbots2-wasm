// @ts-check
// Estado del idioma (rune) y t() reactivo para los componentes. Los textos
// vienen de un archivo por área e idioma (`./es/app.json`, `./en/mundo.json`…,
// decisión C9) y se juntan al cargar.
//
// Carga por demanda (N4.5): cada idioma es un chunk aparte (idioma-es.js,
// idioma-en.js) y solo se baja el que se usa. El inicial se espera con un
// await de nivel superior: los módulos que importan este (App, main.js)
// no corren hasta que está, así la primera pantalla no parpadea con claves.
// El otro idioma se baja al elegirlo en la barra; mientras llega sigue el
// anterior. Si a un idioma le faltara una clave, traducir() (core.js) cae a
// `es` solo si ya está cargado (inicial o elegido antes); si no, muestra
// la clave. claves.test.js exige las mismas claves en los dos idiomas, así
// que en la práctica no pasa.

import { recargarTrasFallo } from '../lib/recarga.js';
import { areaDeRuta, IDIOMAS, juntarAreas, normalizarIdioma, traducir } from './core.js';

/** @type {Record<string, () => Promise<{ archivos: Record<string, Record<string, string>> }>>} */
const CARGADORES = {
  es: () => import('./idioma-es.js'),
  en: () => import('./idioma-en.js'),
};

/** Diccionarios ya cargados, por idioma. @type {Record<string, Record<string, string>>} */
const diccionarios = {};
/** @type {Map<string, Promise<void>>} */
const cargas = new Map();

/**
 * Baja y junta los textos de un idioma (una vez; las llamadas repetidas
 * esperan la misma carga). Si falla, se puede reintentar.
 * @param {string} codigo
 * @returns {Promise<void>}
 */
function cargarIdioma(codigo) {
  let p = cargas.get(codigo);
  if (!p) {
    p = CARGADORES[codigo]().then(({ archivos }) => {
      const juntos = juntarAreas(
        Object.entries(archivos).flatMap(([ruta, dic]) => {
          const a = areaDeRuta(ruta);
          return a ? [{ ...a, dic }] : [];
        }),
      );
      diccionarios[codigo] = juntos[codigo] ?? {};
    });
    p.catch(() => cargas.delete(codigo));
    cargas.set(codigo, p);
  }
  return p;
}

const CLAVE_ALMACEN = 'darwinbots2.idioma';

/** @returns {string} */
function idiomaInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE_ALMACEN);
    if (guardado) return normalizarIdioma(guardado);
  } catch {
    // Sin almacenamiento (modo privado, bloqueado): se usa el del navegador.
  }
  return normalizarIdioma(globalThis.navigator?.language);
}

const inicial = idiomaInicial();
try {
  await cargarIdioma(inicial);
} catch (e) {
  // Chunk de textos inexistente (deploy nuevo con un index viejo) o sin red:
  // al arrancar no hay corrida en memoria, así que se recarga UNA vez
  // (lib/recarga.js); si no, index.html muestra ya su aviso bilingüe con
  // Recargar (sin esperar sus 8 s) y sigue el error.
  if (recargarTrasFallo(false)) {
    window.location.reload();
    await new Promise(() => {});
  }
  /** @type {any} */ (window).__avisoCarga?.();
  throw e;
}

const estado = $state({ idioma: inicial });

/** Idiomas disponibles. */
export const idiomas = IDIOMAS;

/** @returns {string} idioma actual */
export function idioma() {
  return estado.idioma;
}

/** Último idioma pedido: si llegan dos pedidos seguidos, gana el último. */
let pedido = inicial;

// Recarga por un idioma que no baja: marca propia en sessionStorage, que a
// diferencia de la de lib/recarga.js no se borra al montar (esa se borra a
// los 5 s y cada clic sin red volvería a recargar). Se borra cuando un
// idioma baja bien; mientras está, los fallos solo avisan.
export const CLAVE_RECARGA_IDIOMA = 'darwinbots2.recargaIdioma';

/** @returns {Storage | null} */
function sesionAlmacen() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * ¿Recargar tras un fallo al bajar un idioma? Una sola vez por pestaña
 * (hasta que otro idioma baje bien), nunca con una corrida en memoria ni
 * si no se puede dejar la marca.
 * @param {boolean} hayCorrida
 */
function recargarPorIdioma(hayCorrida) {
  const a = sesionAlmacen();
  if (hayCorrida || !a) return false;
  try {
    if (a.getItem(CLAVE_RECARGA_IDIOMA)) return false;
    a.setItem(CLAVE_RECARGA_IDIOMA, '1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Cambia el idioma y lo recuerda en este navegador. Si sus textos no están
 * cargados, primero los baja (mientras, sigue el idioma anterior). Si no
 * bajan (sin red, deploy nuevo): sin corrida en memoria recarga la página
 * una vez (la marca CLAVE_RECARGA_IDIOMA evita una recarga por clic); si
 * no, devuelve false y la barra avisa. Nunca lanza.
 * @param {string} codigo
 * @param {{ hayCorrida?: boolean }} [o]  sin el dato, se asume que hay
 *   corrida (no se recarga)
 * @returns {Promise<boolean>} false si los textos del idioma pedido (el
 *   último) no se pudieron bajar
 */
export async function setIdioma(codigo, { hayCorrida = true } = {}) {
  const l = normalizarIdioma(codigo);
  pedido = l;
  const bajar = !(l in diccionarios);
  try {
    await cargarIdioma(l);
  } catch (e) {
    console.error(e);
    // Ya se pidió otro idioma: este fallo no importa.
    if (pedido !== l) return true;
    if (recargarPorIdioma(hayCorrida)) {
      window.location.reload();
      await new Promise(() => {});
    }
    return false;
  }
  // Bajó de la red: la próxima falla podrá recargar otra vez.
  if (bajar)
    try {
      sesionAlmacen()?.removeItem(CLAVE_RECARGA_IDIOMA);
    } catch {
      // almacenamiento bloqueado
    }
  if (pedido !== l) return true;
  estado.idioma = l;
  try {
    localStorage.setItem(CLAVE_ALMACEN, estado.idioma);
  } catch {
    // Si no se puede guardar, el cambio vale solo para esta sesión.
  }
  return true;
}

/**
 * Texto traducido; reactivo porque lee el estado del idioma.
 * @param {string} clave
 * @param {import('./core.js').Params} [params]
 * @returns {string}
 */
export function t(clave, params) {
  return traducir(diccionarios, estado.idioma, clave, params);
}

/**
 * Número con el formato del idioma actual (16.000 / 16,000); reactivo.
 * @param {number} n
 * @param {Intl.NumberFormatOptions} [opciones]
 * @returns {string}
 */
export function num(n, opciones) {
  if (!Number.isFinite(n)) return '—';
  const clave = `${estado.idioma}|${opciones ? JSON.stringify(opciones) : ''}`;
  let f = formatos.get(clave);
  if (!f) {
    f = new Intl.NumberFormat(estado.idioma, opciones);
    formatos.set(clave, f);
  }
  return f.format(n);
}

/** @type {Map<string, Intl.NumberFormat>} */
const formatos = new Map();
