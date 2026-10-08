// @ts-check
// Resaltado simple del ADN (pestaña ADN del inspector): parte el texto en
// líneas de tokens con una clase cada uno. Puro; el componente pinta cada
// token en un <span>. Los sysvars y opcodes no se traducen.
//
// Clases: 'com' comentario (desde ' hasta el fin de la línea, incluidas las
// cabeceras '#generation…), 'clave' estructura del gen (cond, start, stop,
// else, end), 'sysvar' (.nombre o *.nombre), 'num' número (con * opcional:
// *310), 'op' opcode que escribe memoria (store, inc, dec), '' el resto.
//
// PLAN-EDITOR E2.3: además, las piezas puras de la pestaña ADN rehecha (los
// genes del texto con su estado, la pila de cada gen a partir de la traza, la
// cola de SalvarobText y lo que se lleva al editor). Ninguna evalúa ADN: la
// traza y la memoria las da el motor.

import { hashAdn } from '../../../engine/adn.js';
import { bloquesAdn } from '../../../engine/lab.js';
import { alinear, parsearTraza, sysvarsLeidos, tokensEjecutables } from '../../../engine/pila.js';
import { SYSVARS } from '../bots/editor/vocabulario.js';

// PLAN-EDITOR E4.2: la cola de SalvarobText vive en engine/variantes.js (sin
// DOM, la usa el worker de la evolución); aquí se re-exporta para el inspector.
export { sinColaDeGuardado } from '../../../engine/variantes.js';

/** Palabras de estructura de un gen. */
const CLAVES = new Set(['cond', 'start', 'stop', 'else', 'end']);

/** Opcodes que escriben memoria. */
const OPS = new Set(['store', 'inc', 'dec']);

/**
 * @typedef {{ c: string, s: string }} Token
 */

/**
 * Clase de una palabra (sin espacios).
 * @param {string} w
 * @returns {string}
 */
export function claseDe(w) {
  const x = w.toLowerCase();
  if (CLAVES.has(x)) return 'clave';
  if (/^\*?\.[a-z_][\w]*$/i.test(w)) return 'sysvar';
  if (/^\*?[-+]?\d+(\.\d+)?$/.test(w)) return 'num';
  if (OPS.has(x)) return 'op';
  return '';
}

/**
 * Tokens de una línea, conservando los espacios (juntos, reproducen la línea).
 * @param {string} linea
 * @returns {Token[]}
 */
export function tokensLinea(linea) {
  /** @type {Token[]} */
  const out = [];
  const q = linea.indexOf("'");
  const codigo = q >= 0 ? linea.slice(0, q) : linea;
  for (const m of codigo.matchAll(/(\s+)|(\S+)/g)) {
    if (m[1]) out.push({ c: '', s: m[1] });
    else out.push({ c: claseDe(m[2]), s: m[2] });
  }
  if (q >= 0) out.push({ c: 'com', s: linea.slice(q) });
  return out;
}

/**
 * Texto del ADN → líneas de tokens. Acepta CRLF (SalvarobText usa \r\n) y
 * descarta los NUL de relleno.
 * @param {string} texto
 * @returns {Token[][]}
 */
export function resaltarAdn(texto) {
  const limpio = String(texto ?? '').replaceAll('\0', '');
  const lineas = limpio.split(/\r?\n/);
  while (lineas.length && lineas[lineas.length - 1].trim() === '') lineas.pop();
  return lineas.map(tokensLinea);
}

// ---- Pestaña ADN rehecha (PLAN-EDITOR E2.3) ----------------------------------

/**
 * @typedef {import('../../../engine/pila.js').PasoAlineado} PasoAlineado
 */

/** Clave de sessionStorage con lo que el inspector deja para el editor. */
export const CLAVE_PILA_PENDIENTE = 'dbw2.editor.pila:pendiente';

/** Dirección de cada sysvar del vocabulario del editor (sin el punto). */
const DIRECCIONES = new Map(SYSVARS);

/**
 * Las líneas del ADN agrupadas por gen (bloquesAdn): un segmento por gen
 * (`gen: true`, `n` base 0) y tramos de texto sueltos (`gen: false`, `n: -1`).
 * Los genes apagados no son genes: van en el texto suelto.
 * @param {string} texto
 * @returns {{gen: boolean, n: number, lineas: Token[][]}[]}
 */
export function segmentosAdn(texto) {
  const lineas = resaltarAdn(texto);
  const genes = bloquesAdn(texto).filter((b) => b.tipo === 'gen');
  /** @type {{gen: boolean, n: number, lineas: Token[][]}[]} */
  const out = [];
  for (const [l, linea] of lineas.entries()) {
    const g = genes.find((b) => l >= b.l0 && l <= b.l1);
    const n = g ? g.n : -1;
    const ult = out[out.length - 1];
    if (ult && ult.n === n) ult.lineas.push(linea);
    else out.push({ gen: n >= 0, n, lineas: [linea] });
  }
  return out;
}

/**
 * Estado de un gen en el último ciclo: 'disparo' si el motor lo marcó
 * (genes[n] = 1); 'evaluado' si corrió alguna palabra de su condición y el
 * start quedó en flujo 0 (no entró); '' si no. `pasos` son los de pasosDeGen.
 * @param {PasoAlineado[]} pasos
 * @param {boolean} disparo
 * @returns {'disparo' | 'evaluado' | ''}
 */
export function claseDeGen(pasos, disparo) {
  if (disparo) return 'disparo';
  const inicio = pasos.find((p) => p.palabra.toLowerCase() === 'start');
  if (!inicio) return '';
  if (inicio.flujo !== 0) return '';
  const condicion = pasos.some(
    (p) => p.idx < inicio.idx && p.ejec && !CLAVES.has(p.palabra.toLowerCase()),
  );
  return condicion ? 'evaluado' : '';
}

/**
 * Los pasos de una traza (TSV de db_sim_bot_trace) alineados con las palabras
 * del texto. [] si no hay traza o no corresponde a este texto (engine/pila.js
 * alinear).
 * @param {string} texto
 * @param {string} tsv
 * @returns {PasoAlineado[]}
 */
export function alineadosDeTraza(texto, tsv) {
  if (!tsv) return [];
  return alinear(tokensEjecutables(texto), parsearTraza(tsv).pasos);
}

/**
 * Lo que el inspector deja en sessionStorage (CLAVE_PILA_PENDIENTE) para que el
 * editor abra el ADN con la memoria real del bot: el hash del texto (la llave
 * con que el editor lo reconoce) y los valores de las sysvars que el ADN lee y
 * tienen dirección. mem[i] es la dirección i + 1.
 * @param {string} texto  el ADN sin la cola (sinColaDeGuardado)
 * @param {ArrayLike<number>} mem  el volcado de memoria (mem-dump)
 * @returns {{hash: string, valores: [string, number][]}}
 */
export function pendientePila(texto, mem) {
  /** @type {[string, number][]} */
  const valores = [];
  for (const nombre of sysvarsLeidos(tokensEjecutables(texto))) {
    const dir = DIRECCIONES.get(nombre.replace(/^\./, ''));
    if (dir === undefined || dir > mem.length) continue;
    valores.push([nombre, Math.trunc(Number(mem[dir - 1])) || 0]);
  }
  return { hash: hashAdn(texto), valores };
}

/**
 * Los valores que dejó el inspector, si son de este ADN (mismo hash). null si
 * no hay, son de otro texto o el JSON está roto.
 * @param {string} crudo  el contenido de CLAVE_PILA_PENDIENTE
 * @param {string} hash  hashAdn del texto que abre el editor
 * @returns {Map<string, number> | null}
 */
export function valoresDePendiente(crudo, hash) {
  try {
    const p = JSON.parse(crudo);
    if (!p || p.hash !== hash || !Array.isArray(p.valores)) return null;
    /** @type {[string, number][]} */
    const pares = [];
    for (const par of p.valores)
      if (Array.isArray(par) && typeof par[0] === 'string' && Number.isFinite(par[1]))
        pares.push([par[0], Math.trunc(par[1])]);
    return new Map(pares);
  } catch {
    return null;
  }
}

/**
 * Una fila de la línea de tiempo: si el gen n disparó en cada uno de los
 * últimos `largo` ciclos del historial (de viejo a nuevo, a la derecha). Las
 * celdas sin historial quedan apagadas, a la izquierda.
 * @param {(number[] | null)[]} historial  genes (ga) de cada ciclo
 * @param {number} n  gen base 0
 * @param {number} [largo]
 * @returns {boolean[]}
 */
export function cuadriculaGen(historial, n, largo = 200) {
  const ult = historial.slice(-largo);
  const huecos = largo - ult.length;
  return Array.from({ length: largo }, (_, k) => k >= huecos && ult[k - huecos]?.[n] === 1);
}
