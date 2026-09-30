// @ts-check
// Resaltado simple del ADN (pestaña ADN del inspector): parte el texto en
// líneas de tokens con una clase cada uno. Puro; el componente pinta cada
// token en un <span>. Los sysvars y opcodes no se traducen.
//
// Clases: 'com' comentario (desde ' hasta el fin de la línea, incluidas las
// cabeceras '#generation…), 'clave' estructura del gen (cond, start, stop,
// else, end), 'sysvar' (.nombre o *.nombre), 'num' número (con * opcional:
// *310), 'op' opcode que escribe memoria (store, inc, dec), '' el resto.

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
