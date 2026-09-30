// @ts-check
// «Desde un archivo» de Inicio (paso N1.6): un .txt de un bot se siembra
// como un escenario mínimo de una especie (decisión 12): la base clásica,
// el alga de «Sopa primordial» y el bot con su ADN embebido (origen
// 'propio', con su hash). Se valida y normaliza con engine/escenarios.
// Puro: los textos visibles (nombre, descripción) los pasa quien llama.

import { escenarioFabrica } from '../../../engine/escenarios/fabrica.js';
import { normalizar } from '../../../engine/escenarios/index.js';
import { lgHash } from '../../../engine/league.js';
import { hashTexto } from './vista.js';

/** Cuántas copias del bot se siembran. */
export const CANTIDAD_BOT = 10;
/** Escenario de fábrica del que se toma el alga. */
export const ESCENARIO_ALGA = 'sopa-primordial';

/** Colores para el bot (se elige uno por el nombre, sin el verde del alga). */
export const PALETA = Object.freeze([
  '#ff4040',
  '#4aa3ff',
  '#ff8c1a',
  '#ff4f9a',
  '#c98500',
  '#9b6bff',
  '#e05252',
  '#3987e5',
]);

/**
 * Nombre del bot a partir del nombre del archivo (sin carpeta ni .txt).
 * @param {string} archivo
 */
export function nombreDeArchivo(archivo) {
  const base = String(archivo ?? '')
    .split(/[\\/]/)
    .pop();
  return (base ?? '').replace(/\.txt$/i, '').trim() || 'bot';
}

/**
 * ¿Tiene algo además de comentarios y espacios? (un .txt vacío no siembra
 * nada).
 * @param {string} adn
 */
export function tieneCodigo(adn) {
  return adn
    .split('\n')
    .map((l) => l.replace(/'.*$/, '').trim())
    .some((l) => l !== '');
}

/**
 * Error al armar el escenario de un .txt, con clave estable
 * (`inicio.error.<clave>`): 'txtVacio' (el archivo no tiene código) o
 * 'sinAlga' (no está el alga de base). `archivo` = nombre del archivo.
 */
export class ErrorTxt extends Error {
  /** @param {'txtVacio' | 'sinAlga'} clave @param {string} archivo */
  constructor(clave, archivo) {
    super(`${clave}: ${archivo}`);
    this.name = 'ErrorTxt';
    this.clave = clave;
    this.archivo = archivo;
  }
}

/**
 * Escenario de una especie a partir del texto de un .txt. Lanza
 * ErrorTxt('txtVacio') si el texto no tiene código, ErrorTxt('sinAlga') si
 * falta el alga de base y ErrorEscenario('invalido') si el resultado no
 * valida.
 * @param {string} texto
 * @param {string} archivo  nombre del archivo (da el nombre del bot)
 * @param {{ nombre?: string, descripcion?: string, etiquetas?: string[] }} [o]
 * @returns {import('../../../engine/escenarios/index.js').Escenario}
 */
export function escenarioDesdeTxt(texto, archivo, o = {}) {
  const adn = String(texto ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');
  const bot = nombreDeArchivo(archivo);
  const nombreArchivo =
    String(archivo ?? '')
      .split(/[\\/]/)
      .pop() ?? '';
  if (!tieneCodigo(adn)) throw new ErrorTxt('txtVacio', nombreArchivo);
  const base = escenarioFabrica(ESCENARIO_ALGA);
  const alga = base?.especies.find((s) => s.vegetal);
  if (!alga) throw new ErrorTxt('sinAlga', nombreArchivo);
  const hash = lgHash(adn);
  const especies = [
    {
      bot: alga.bot,
      ...(alga.hash ? { hash: alga.hash } : {}),
      cantidad: alga.cantidad,
      color: alga.color,
      vegetal: true,
    },
  ];
  // Un bot que se llame igual que el alga se sembraría dos veces con el
  // mismo nombre: se reemplaza el alga por el bot.
  if (bot === alga.bot) especies.length = 0;
  especies.push({
    bot,
    origen: 'propio',
    hash,
    adn,
    cantidad: CANTIDAD_BOT,
    color: PALETA[hashTexto(bot) % PALETA.length],
    vegetal: false,
  });
  return normalizar({
    formato: 1,
    id: `txt-${hash}`,
    nombre: o.nombre || bot,
    ...(o.descripcion ? { descripcion: o.descripcion } : {}),
    etiquetas: o.etiquetas ?? [],
    opciones: { base: 'clasica', cambios: {} },
    especies,
  });
}
