// @ts-check
// Textos de Internet Mode armados con claves (internet.registro.<tipo>,
// internet.error.<clave>): las listas de sufijos están declaradas para que el
// test compruebe que existen en todos los idiomas.

import { vbACss } from '../mundo/color.js';

/** Tipos de entrada del registro (nucleo.js). */
export const TIPOS_REGISTRO = Object.freeze([
  'parEntra',
  'parSale',
  'parSale.latido',
  'parSale.conexion',
  'llegada',
  'llegadaMulti',
  'salida',
  'salidaMulti',
  'mas',
  'otro',
  'activadoPestanas',
  'activadoRelay',
  'sinPuerto',
  'fallo',
  'desactivado.usuario',
  'desactivado.simNueva',
  'desactivado.externo',
]);

/** Claves de error (del encendido y de la tarjeta). */
export const ERRORES = Object.freeze([
  'noSeActivo',
  'modoReinicio',
  'topeTeleporters',
  'apodoCaracteres',
  'apodoLargo',
  'salaLarga',
  'urlVacia',
  'urlFormato',
  'urlProtocolo',
  'urlInsegura',
]);

/** Claves con plural (`.uno` / `.otros`). */
export const PLURALES_IM = Object.freeze([
  'internet.chip',
  'internet.pares.vivos',
  'internet.colas.esperan',
]);

/**
 * Nombre de bot sin la extensión del archivo (los nombres no se traducen).
 * @param {string} n
 */
export const sinTxt = (n) => String(n ?? '').replace(/\.txt$/i, '');

/**
 * Texto de una entrada del registro.
 * @param {import('./nucleo.js').EntradaRegistro} e
 * @param {(clave: string, params?: Record<string, string | number>) => string} t
 * @param {(n: number) => string} [num]
 */
export function textoEntrada(e, t, num = String) {
  const p = { ...e.params };
  if (typeof p.bot === 'string') p.bot = sinTxt(p.bot);
  if (typeof p.celulas === 'number') p.celulas = num(p.celulas);
  if (typeof p.n === 'number') p.n = num(p.n);
  const tipo = TIPOS_REGISTRO.includes(e.tipo) ? e.tipo : 'otro';
  if (tipo === 'otro' && p.texto === undefined) p.texto = e.tipo;
  return t(`internet.registro.${tipo}`, p);
}

/**
 * Texto de un error.
 * @param {{ clave: string, params?: Record<string, string | number> }} e
 * @param {(clave: string, params?: Record<string, string | number>) => string} t
 */
export function textoError(e, t) {
  const clave = ERRORES.includes(e.clave) ? e.clave : 'noSeActivo';
  return t(`internet.error.${clave}`, e.params ?? {});
}

/** Color de una especie de Internet (Long BGR) en CSS. @param {number} c */
export const colorEspecie = (c) => vbACss(c);
