// @ts-check
// Experimentar en modo avanzado (paso N3.7; decisión 14 de port/web2/PLAN.md):
// lógica pura, sin DOM ni runes.
//
// Todos los parámetros del catálogo (engine/opciones.js), agrupados como en
// GRUPOS, con buscador (nombre es/en y variable del core), marca de
// «cambiado» respecto de la base del escenario, vuelta a la base por
// parámetro y por grupo, y vivo / requiere nueva (C12). El borrador es el
// mismo que edita el modo básico: escribir un parámetro fusiona su clave en
// `opciones.cambios` con fusionarCambios y limpiarCambios (borrador.js), así
// los controles compuestos del básico leen lo que se cambió acá y viceversa.
//
// Acopladas: opt:1 es derivado (se muestra con su valor efectivo, no se
// edita); escribir 97 arrastra 101 (lo hace fusionarCambios), por eso la
// vuelta a la base de un grupo va en el orden del catálogo (97 antes que 101).

import {
  fusionarCambios,
  GRUPOS,
  normalizarValor,
  PARAMETROS,
  parametro,
  valorEfectivo,
  valoresResueltos,
} from '../../../engine/opciones.js';
import { efectivos, limpiarCambios } from './borrador.js';

/**
 * @typedef {import('../../../engine/escenarios/index.js').Escenario} Escenario
 * @typedef {import('../../../engine/opciones.js').Parametro} Parametro
 * @typedef {'basico' | 'avanzado'} Modo
 */

/** Clave de localStorage del modo elegido. */
export const CLAVE_MODO = 'darwinbots2.experimentar.modo';

/**
 * Modo recordado (sin almacenamiento o con un valor raro: 'basico').
 * @param {Pick<Storage, 'getItem'> | null | undefined} almacen
 * @returns {Modo}
 */
export function leerModo(almacen) {
  try {
    return almacen?.getItem(CLAVE_MODO) === 'avanzado' ? 'avanzado' : 'basico';
  } catch {
    return 'basico';
  }
}

/**
 * Recuerda el modo; si no se puede guardar, vale solo para esta sesión.
 * @param {Pick<Storage, 'setItem'> | null | undefined} almacen @param {Modo} modo
 */
export function guardarModo(almacen, modo) {
  try {
    almacen?.setItem(CLAVE_MODO, modo);
  } catch {
    // Modo privado o almacenamiento bloqueado.
  }
}

/**
 * Texto para buscar: minúsculas y sin tildes.
 * @param {unknown} s
 */
export const plano = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * ¿El parámetro coincide con la búsqueda? Por nombre en español o en inglés,
 * por la variable del core o por la clave (`opt:11`). Varias palabras: tienen
 * que estar todas.
 * @param {Parametro} p @param {string} q
 */
export function coincideBusqueda(p, q) {
  const palabras = plano(q).split(/\s+/).filter(Boolean);
  if (!palabras.length) return true;
  const texto = plano(`${p.es} ${p.en} ${p.variable} ${p.clave}`);
  return palabras.every((w) => texto.includes(w));
}

/**
 * Valor efectivo del parámetro en la base del escenario (sin sus cambios).
 * @param {string} base @param {string} clave
 */
export const valorBase = (base, clave) => valorEfectivo(valoresResueltos(base, {}), clave);

/**
 * @typedef {{
 *   p: Parametro,
 *   valor: number,
 *   base: number,
 *   cambiado: boolean,
 *   sinAplicar: boolean,
 *   editable: boolean,
 * }} FilaAvanzada
 * @typedef {{id: string, es: string, en: string, filas: FilaAvanzada[], total: number,
 *   cambiados: number}} GrupoAvanzado
 */

/**
 * Filas del modo avanzado, por grupo. `cambiado` = distinto de la base del
 * escenario; `sinAplicar` = distinto de la referencia (la sim actual o el
 * escenario elegido, como en el básico). `total` y `cambiados` cuentan el
 * grupo entero (sin filtros); `filas` son las que pasan los filtros. Con
 * `grupo` = 'todos' (o una búsqueda) van todos los grupos con alguna fila.
 * @param {Escenario} b @param {Escenario | null} ref
 * @param {{grupo?: string, q?: string, soloCambiados?: boolean}} [filtro]
 * @returns {GrupoAvanzado[]}
 */
export function gruposAvanzado(b, ref, filtro = {}) {
  const { grupo = 'todos', q = '', soloCambiados = false } = filtro;
  const eb = efectivos(b);
  const er = ref ? efectivos(ref) : null;
  const buscando = plano(q).trim() !== '';
  const rb = valoresResueltos(b.opciones.base, {});
  /** @type {GrupoAvanzado[]} */
  const out = [];
  for (const g of GRUPOS) {
    const todas = PARAMETROS.filter((p) => p.grupo === g.id).map((p) => {
      const valor = eb(p.clave);
      const base = valorEfectivo(rb, p.clave);
      return {
        p,
        valor,
        base,
        cambiado: !Object.is(valor, base),
        sinAplicar: er ? !Object.is(valor, er(p.clave)) : false,
        editable: !p.derivado,
      };
    });
    const filas = todas.filter(
      (f) =>
        (buscando || grupo === 'todos' || grupo === g.id) &&
        (!buscando || coincideBusqueda(f.p, q)) &&
        (!soloCambiados || f.cambiado),
    );
    if (!filas.length) continue;
    out.push({
      id: g.id,
      es: g.es,
      en: g.en,
      filas,
      total: todas.length,
      cambiados: todas.filter((f) => f.cambiado).length,
    });
  }
  return out;
}

/**
 * Resumen de todos los grupos (para la lista lateral): total y cambiados.
 * @param {Escenario} b
 * @returns {{id: string, es: string, en: string, total: number, cambiados: number}[]}
 */
export function resumenGrupos(b) {
  return gruposAvanzado(b, null).map(({ id, es, en, total, cambiados }) => ({
    id,
    es,
    en,
    total,
    cambiados,
  }));
}

/**
 * Borrador con el parámetro en `v` (validado con normalizarValor). Un
 * derivado no se escribe. Devuelve el borrador o el código de error.
 * @param {Escenario} b @param {string} clave @param {unknown} v
 * @returns {{ok: true, borrador: Escenario} | {ok: false, codigo: string}}
 */
export function escribirParametro(b, clave, v) {
  const p = parametro(clave);
  if (!p) return { ok: false, codigo: 'clave-desconocida' };
  if (p.derivado) return { ok: false, codigo: 'clave-derivada' };
  const n = normalizarValor(p, v);
  if (!n.ok) return n;
  const cambios = limpiarCambios(
    b.opciones.base,
    fusionarCambios(b.opciones.cambios, { [clave]: n.v }),
  );
  return { ok: true, borrador: { ...b, opciones: { ...b.opciones, cambios } } };
}

/**
 * Borrador con esos parámetros de vuelta en el valor de la base (en el orden
 * del catálogo; los derivados se saltean: siguen a los suyos).
 * @param {Escenario} b @param {string[]} claves
 * @returns {Escenario}
 */
export function volverABase(b, claves) {
  const set = new Set(claves);
  let out = b;
  for (const p of PARAMETROS) {
    if (!set.has(p.clave) || p.derivado) continue;
    const r = escribirParametro(out, p.clave, valorBase(b.opciones.base, p.clave));
    if (r.ok) out = r.borrador;
  }
  return out;
}

/**
 * Claves de un grupo del catálogo.
 * @param {string} grupo
 */
export const clavesDeGrupo = (grupo) =>
  PARAMETROS.filter((p) => p.grupo === grupo).map((p) => p.clave);

/**
 * Número tecleado → número (acepta coma decimal) o null si no es un número.
 * La validación de tipo y rango es la de normalizarValor.
 * @param {unknown} texto
 */
export function numeroDeTexto(texto) {
  const s = String(texto ?? '')
    .trim()
    .replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
