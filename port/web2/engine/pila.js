// @ts-check
// Pila del ADN para el visor de pila del editor (PLAN-EDITOR E1.4), sin DOM
// y sin evaluar nada. El motor (db_dna_trace, vía {t:'trace-dna'} del worker)
// devuelve la traza de un gen como TSV, una línea por token; acá se parsea,
// se alinea con las palabras del texto del ADN y se arman los datos que la
// UI muestra. Los valores de la pila los calcula el motor: este módulo solo
// los lee y los ordena (la regla es la de PLAN-EDITOR.md, «Formato de traza»).
//
//   tokensEjecutables(texto)        los tokens que el core traza (sin líneas def,
//                                   sin el primer token en ciertos bots con def,
//                                   hasta el primer `end` sin incluirlo)
//   parsearTraza(tsv)               {cabecera, pasos} del TSV del motor
//   alinear(tokens, pasos)          cada paso con su palabra y su posición en el texto
//   pasosDeGen(alineados, texto, i) los pasos del gen i de genesTexto(texto)
//   sysvarsLeidos(tokens)           las sysvars (*.nombre) que lee el ADN, sin el *
//   memoriaDe(valores, direccionDe) la memoria de ejemplo para {t:'trace-dna'}
//   resumenPaso(paso)               a qué clase de token pertenece el paso (para el texto)

import { codigoDeLinea, genesTexto, tokensTexto } from './lab.js';

/**
 * @typedef {import('./lab.js').Token} Token
 * @typedef {{idx: number, tipo: number, valor: number, ejec: boolean, flujo: number, gen: number,
 *   nInts: number, ints: number[], nBools: number, bools: number[], dir: number, val: number}} Paso
 * @typedef {Paso & {palabra: string, linea: number, ini: number, fin: number}} PasoAlineado
 * @typedef {{ciclo: number, n: number, genenum: number}} Cabecera
 */

/**
 * ¿La parte de código de una línea es una línea `def` para el core? Es la
 * misma regla que esLineaDef de src/lib/bots/editor/resaltado.js, copiada
 * acá para que engine/ no importe de src/.
 * @param {string} codigo
 */
const esLineaDef = (codigo) => /^[ \t]*def/.test(codigo);

/** Palabras de flujo del core (FlowTok de loader.hpp, en minúsculas). */
const FLUJO = new Set(['cond', 'start', 'else', 'stop']);

/**
 * Los tokens que el core ejecuta, en el orden de la traza (la línea de traza
 * con idx = k + 1 es el token k de esta lista). Dos reglas del cargador
 * (loader.hpp, LoadDNAText) que la traza refleja:
 *  - las líneas `def` no son tokens;
 *  - si el bot tiene alguna línea `def` y su primer token no es de flujo, el
 *    cargador lo deja fuera del rango ejecutable (la corrección del cero
 *    inicial, [PROBABLE BUG] A2-2 del port);
 *  - la ejecución llega hasta el primer `end`, que no se traza.
 * @param {string} texto
 * @returns {Token[]}
 */
export function tokensEjecutables(texto) {
  const { lineas, tokens } = tokensTexto(texto);
  let hayDef = false;
  /** @type {Token[]} */
  const cuerpo = [];
  for (const t of tokens) {
    if (esLineaDef(codigoDeLinea(lineas[t.linea]))) hayDef = true;
    else cuerpo.push(t);
  }
  const desde = hayDef && cuerpo.length > 0 && !FLUJO.has(cuerpo[0].w.toLowerCase()) ? 1 : 0;
  /** @type {Token[]} */
  const out = [];
  for (const t of cuerpo.slice(desde)) {
    if (t.w.toLowerCase() === 'end') break;
    out.push(t);
  }
  return out;
}

/** @param {string | undefined} s */
const numeros = (s) => (s ? s.split(',').map(Number) : []);

/**
 * Parsea el TSV de db_dna_trace. Una línea que empieza con `#` es la
 * cabecera de E2 (`#\tciclo\tn\tgenenum`) y va aparte en `cabecera`; las
 * líneas vacías se ignoran.
 * @param {string} tsv
 * @returns {{cabecera: Cabecera | null, pasos: Paso[]}}
 */
export function parsearTraza(tsv) {
  /** @type {Cabecera | null} */
  let cabecera = null;
  /** @type {Paso[]} */
  const pasos = [];
  for (const crudo of String(tsv ?? '').split('\n')) {
    const linea = crudo.replace(/\r$/, '');
    if (linea === '') continue;
    const c = linea.split('\t');
    if (linea.startsWith('#')) {
      cabecera = { ciclo: Number(c[1]), n: Number(c[2]), genenum: Number(c[3]) };
      continue;
    }
    pasos.push({
      idx: Number(c[0]),
      tipo: Number(c[1]),
      valor: Number(c[2]),
      ejec: c[3] === '1',
      flujo: Number(c[4]),
      gen: Number(c[5]),
      nInts: Number(c[6]),
      ints: numeros(c[7]),
      nBools: Number(c[8]),
      bools: numeros(c[9]),
      dir: Number(c[10]),
      val: Number(c[11]),
    });
  }
  return { cabecera, pasos };
}

/**
 * Empareja cada paso con su token por posición. Si las cuentas no coinciden,
 * o un paso no tiene el idx que le toca (k + 1), devuelve [] y la UI muestra
 * «sin datos» en vez de una traza corrida.
 * @param {Token[]} tokens  tokensEjecutables(texto)
 * @param {Paso[]} pasos    parsearTraza(tsv).pasos
 * @returns {PasoAlineado[]}
 */
export function alinear(tokens, pasos) {
  if (tokens.length !== pasos.length) return [];
  /** @type {PasoAlineado[]} */
  const out = [];
  for (const [k, paso] of pasos.entries()) {
    if (paso.idx !== k + 1) return [];
    const t = tokens[k];
    out.push({ ...paso, palabra: t.w, linea: t.linea, ini: t.ini, fin: t.fin });
  }
  return out;
}

/**
 * Los pasos del gen `i` de genesTexto(texto): los que caen dentro del rango
 * de posiciones de sus palabras. Recibe el texto y no el resultado de
 * genesTexto porque hace falta la posición de cada palabra para pasar de los
 * índices de tokensTexto (que incluyen las líneas def) a los pasos.
 * @param {PasoAlineado[]} alineados
 * @param {string} texto
 * @param {number} i
 * @returns {PasoAlineado[]}
 */
export function pasosDeGen(alineados, texto, i) {
  const tt = tokensTexto(texto);
  const gen = genesTexto(tt)[i];
  if (!gen) return [];
  const ini = tt.tokens[gen.t0].ini;
  const fin = tt.tokens[gen.t1].fin;
  return alineados.filter((p) => p.ini >= ini && p.fin <= fin);
}

/**
 * Las sysvars que lee el ADN (tokens `*.nombre`), sin el `*`, en orden de
 * aparición y sin repetir. Los nombres son sensibles a mayúsculas (el core lo
 * dice en sus pistas), así que la comparación es exacta.
 * @param {Token[]} tokens
 * @returns {string[]}
 */
export function sysvarsLeidos(tokens) {
  /** @type {Set<string>} */
  const vistos = new Set();
  for (const t of tokens) if (t.w.startsWith('*.')) vistos.add(t.w.slice(1));
  return [...vistos];
}

/**
 * Memoria de ejemplo para {t:'trace-dna'}: 1001 enteros en cero con
 * `mem[direccionDe(nombre)] = valor` por cada entrada. Los nombres sin
 * dirección (o fuera de 0..1000) se ignoran. Devuelve un Array plano: el
 * worker lo chequea con Array.isArray.
 * @param {Map<string, number>} valores
 * @param {(nombre: string) => number | undefined} direccionDe
 * @returns {number[]}
 */
export function memoriaDe(valores, direccionDe) {
  const mem = new Array(1001).fill(0);
  for (const [nombre, valor] of valores) {
    const d = direccionDe(nombre);
    if (d !== undefined && Number.isInteger(d) && d >= 0 && d <= 1000) mem[d] = valor | 0;
  }
  return mem;
}

/**
 * Clase de token de un paso, según `tipo` (tok::NUMBER… de dna.hpp). Solo
 * sirve para elegir el texto i18n; no calcula valores.
 * @type {Record<number, 'lee' | 'apila' | 'opera' | 'compara' | 'flujo' | 'escribe' | 'nada'>}
 */
const CLASE = {
  0: 'apila', // NUMBER
  1: 'lee', // DEREF
  2: 'opera', // BASIC
  3: 'opera', // ADVANCED
  4: 'opera', // BITWISE
  5: 'compara', // CONDITION
  6: 'opera', // LOGIC
  7: 'escribe', // STORE
  8: 'nada', // RESERVED
  9: 'flujo', // FLOW
  10: 'flujo', // MASTER (end)
};

/**
 * @param {Paso} paso
 * @returns {{tipo: 'lee' | 'apila' | 'opera' | 'compara' | 'flujo' | 'escribe' | 'nada'}}
 */
export function resumenPaso(paso) {
  return { tipo: CLASE[paso.tipo] ?? 'nada' };
}
