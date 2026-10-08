// @ts-check
// Modo «Fichas» del editor de ADN (PLAN-EDITOR E3.1), sin DOM: el texto como
// una ficha por palabra dentro de su línea, y las ediciones como reemplazos de
// rango en el texto. El texto es la fuente: nada se regenera desde una
// estructura, cada acción devuelve el texto nuevo y el cursor.
//
//   modeloFichas(texto)                 LineaFichas[], una por línea
//   reemplazarFicha(texto, f, palabra)  cambia la palabra de una ficha
//   insertarEn(texto, pos, palabra)     inserta una palabra con sus espacios
//   borrarFicha(texto, f)               quita la ficha y un espacio adyacente
//   moverFicha(texto, f, pos)           borrarFicha y luego insertarEn
//   nuevaLineaTras(texto, n)            línea nueva tras la n, con su sangría
//   huecos(linea)                       posiciones donde se puede insertar

import { codigoDeLinea, tokensTexto } from './lab.js';
import { claseDe, defsDe, esLineaDef } from './resaltado.js';

/**
 * @typedef {'cond' | 'cuerpo' | 'else' | 'fuera'} Zona
 * @typedef {{w: string, ini: number, fin: number, clase: string}} Ficha
 * @typedef {{n: number, tipo: 'codigo' | 'comentario' | 'def' | 'vacia' | 'meta',
 *   texto: string, ini: number, gen: number, zona: Zona, fichas: Ficha[]}} LineaFichas
 */

/**
 * Cualquier blanco, incluido el salto de línea, o el fin del texto. Una
 * palabra nueva que va detrás de un blanco no necesita espacio.
 */
const ES_BLANCO = (/** @type {string | undefined} */ c) => c === undefined || /\s/.test(c);
/**
 * ¿Puede empezar una palabra de código en este carácter? No es blanco ni el
 * inicio de un comentario: el core corta el código en la primera ' y `x'c`
 * vale lo mismo que `x 'c`, así que no hace falta espacio antes de la '.
 */
const EMPIEZA_PALABRA = (/** @type {string | undefined} */ c) =>
  c !== undefined && !/\s/.test(c) && c !== "'";

/**
 * Tipo de una línea. `meta` es una línea que empieza con `'#` (el prefijo de
 * un gen apagado, PREFIJO_APAGADO, y cualquier otra marca del editor).
 * @param {string} linea
 * @returns {LineaFichas['tipo']}
 */
function tipoDeLinea(linea) {
  if (linea.trim() === '') return 'vacia';
  if (linea.startsWith("'#")) return 'meta';
  const codigo = codigoDeLinea(linea);
  if (codigo.trim() === '') return 'comentario';
  return esLineaDef(codigo) ? 'def' : 'codigo';
}

/**
 * Gen y zona de cada token, con la misma regla de genesTexto (lab.js): `cond`
 * abre un gen en zona `cond`; `start` abre el cuerpo; `else` abre su zona
 * (si sigue a un `cond` sin `start` comparte gen, si no abre uno propio);
 * `stop` cierra el gen; `end` corta. Los tokens fuera de un gen valen -1 y
 * `fuera`.
 * @param {import('./lab.js').Token[]} tokens
 * @returns {{gen: number, zona: Zona}[]}
 */
function estadoDeTokens(tokens) {
  /** @type {{gen: number, zona: Zona}[]} */
  const out = [];
  let nGenes = 0;
  let gen = -1;
  let abierto = false;
  let condgene = false;
  /** @type {Zona} */
  let zona = 'fuera';
  let fin = false;
  /** @param {Zona} z */
  const abrir = (z) => {
    gen = nGenes++;
    abierto = true;
    condgene = z === 'cond';
    zona = z;
  };
  for (const t of tokens) {
    const x = t.w.toLowerCase();
    if (x === 'end') fin = true;
    if (fin) {
      out.push({ gen: -1, zona: 'fuera' });
      continue;
    }
    if (x === 'cond') abrir('cond');
    else if (x === 'start' || x === 'else') {
      if (abierto && condgene) {
        condgene = false;
        zona = x === 'start' ? 'cuerpo' : 'else';
      } else abrir(x === 'start' ? 'cuerpo' : 'else');
    } else if (x === 'stop' && abierto) {
      out.push({ gen, zona });
      abierto = false;
      condgene = false;
      zona = 'fuera';
      gen = -1;
      continue;
    }
    out.push(abierto ? { gen, zona } : { gen: -1, zona: 'fuera' });
  }
  return out;
}

/**
 * El modelo de fichas del ADN: una entrada por línea, con sus fichas (una por
 * palabra de código, con su posición en el texto completo y su clase). Las
 * líneas `def` llevan clase `def` en todas sus palabras. `gen` y `zona` de
 * una línea son los de su primera palabra dentro de un gen; si no tiene
 * ninguna, los que quedaron de la línea anterior.
 * @param {string} texto
 * @returns {LineaFichas[]}
 */
export function modeloFichas(texto) {
  const s = String(texto ?? '');
  const { lineas, tokens } = tokensTexto(s);
  const defs = defsDe(s);
  const estados = estadoDeTokens(tokens);
  const defLinea = lineas.map((l) => esLineaDef(codigoDeLinea(l)));
  /** @type {Ficha[][]} */
  const fichasDe = lineas.map(() => []);
  /** @type {number[]} índice (en tokens) de la primera palabra de cada línea */
  const primero = lineas.map(() => -1);
  for (const [i, t] of tokens.entries()) {
    if (primero[t.linea] < 0) primero[t.linea] = i;
    fichasDe[t.linea].push({
      w: t.w,
      ini: t.ini,
      fin: t.fin,
      clase: defLinea[t.linea] ? 'def' : claseDe(t.w, defs, new Set()),
    });
  }
  /** @type {LineaFichas[]} */
  const out = [];
  /** @type {{gen: number, zona: Zona}} */
  let previo = { gen: -1, zona: 'fuera' };
  let ini = 0;
  for (const [n, linea] of lineas.entries()) {
    const fichas = fichasDe[n];
    /** @type {{gen: number, zona: Zona}} */
    let estado = previo;
    for (const k of fichas.keys()) {
      const e = estados[primero[n] + k];
      if (e.gen >= 0) {
        estado = e;
        break;
      }
    }
    if (fichas.length) {
      // Tras un `stop` el gen está cerrado, aunque el token diga otra cosa.
      const ult = tokens[primero[n] + fichas.length - 1];
      previo =
        ult.w.toLowerCase() === 'stop'
          ? { gen: -1, zona: 'fuera' }
          : estados[primero[n] + fichas.length - 1];
    }
    out.push({
      n,
      tipo: tipoDeLinea(linea),
      texto: linea,
      ini,
      gen: estado.gen,
      zona: estado.zona,
      fichas,
    });
    ini += linea.length + 1;
  }
  return out;
}

/**
 * Cambia la palabra de una ficha. El cursor queda al final de la palabra nueva.
 * @param {string} texto @param {Ficha} ficha @param {string} palabra
 * @returns {{texto: string, cursor: number}}
 */
export function reemplazarFicha(texto, ficha, palabra) {
  return {
    texto: texto.slice(0, ficha.ini) + palabra + texto.slice(ficha.fin),
    cursor: ficha.ini + palabra.length,
  };
}

/**
 * Inserta una palabra en `pos`, con un espacio antes si el carácter anterior
 * no es blanco ni hay inicio, y uno después si lo que sigue puede empezar una
 * palabra (no es blanco, ni fin, ni el inicio de un comentario). El cursor
 * queda al final de la palabra.
 * @param {string} texto @param {number} pos @param {string} palabra
 * @returns {{texto: string, cursor: number}}
 */
export function insertarEn(texto, pos, palabra) {
  const pre = pos > 0 && !ES_BLANCO(texto[pos - 1]) ? ' ' : '';
  const post = EMPIEZA_PALABRA(texto[pos]) ? ' ' : '';
  return {
    texto: texto.slice(0, pos) + pre + palabra + post + texto.slice(pos),
    cursor: pos + pre.length + palabra.length,
  };
}

/**
 * Quita la ficha y un espacio adyacente, el de después si existe y queda otra
 * palabra detrás, si no el de antes si hay otra palabra delante. Así quitar y
 * volver a insertar en el mismo sitio devuelve el texto original (insertarEn
 * repone el espacio que hace falta). Solo se quita un espacio de verdad (' '):
 * un tabulador o un salto se dejan, porque insertarEn pondría un espacio. Si
 * la ficha no tiene espacio entre dos palabras, quita solo ella. El cursor
 * queda donde empezó el corte.
 * @param {string} texto @param {Ficha} ficha
 * @returns {{texto: string, cursor: number}}
 */
export function borrarFicha(texto, ficha) {
  const { ini, fin } = ficha;
  let desde = ini;
  let hasta = fin;
  if (texto[fin] === ' ' && EMPIEZA_PALABRA(texto[fin + 1])) hasta = fin + 1;
  else if (texto[ini - 1] === ' ' && ini >= 2 && !ES_BLANCO(texto[ini - 2])) desde = ini - 1;
  return { texto: texto.slice(0, desde) + texto.slice(hasta), cursor: desde };
}

/**
 * Quita la ficha (borrarFicha) y la inserta en `pos`, una posición del texto
 * original: si cae dentro de lo que se quitó, se usa el inicio del corte.
 * @param {string} texto @param {Ficha} ficha @param {number} pos
 * @returns {{texto: string, cursor: number}}
 */
export function moverFicha(texto, ficha, pos) {
  const quitado = borrarFicha(texto, ficha);
  const cortado = texto.length - quitado.texto.length;
  const desde = quitado.cursor;
  let p = pos;
  if (p >= desde + cortado) p -= cortado;
  else if (p > desde) p = desde;
  return insertarEn(quitado.texto, p, ficha.w);
}

/**
 * Inserta un salto de línea al final de la línea `n` (base 0) con la sangría
 * de esa línea. El cursor queda al principio de la línea nueva, tras la
 * sangría. Una `n` fuera de rango cae en la última línea.
 * @param {string} texto @param {number} n
 * @returns {{texto: string, cursor: number}}
 */
export function nuevaLineaTras(texto, n) {
  const lineas = texto.split('\n');
  const k = Math.min(Math.max(n, 0), lineas.length - 1);
  let fin = 0;
  for (let i = 0; i < k; i++) fin += lineas[i].length + 1;
  const linea = lineas[k];
  const sinCr = linea.replace(/\r$/, '');
  fin += sinCr.length;
  const sangria = /^[ \t]*/.exec(linea)?.[0] ?? '';
  const ins = `\n${sangria}`;
  return {
    texto: texto.slice(0, fin) + ins + texto.slice(fin),
    cursor: fin + ins.length,
  };
}

/**
 * Posiciones donde se puede insertar una ficha en una línea. En una línea de
 * código: antes de la primera ficha y después de cada una (así cae también
 * entre dos fichas). En una línea vacía: su inicio. En las demás, ninguna.
 * @param {LineaFichas} linea
 * @returns {number[]}
 */
export function huecos(linea) {
  if (linea.tipo === 'vacia') return [linea.ini];
  if (linea.tipo !== 'codigo') return [];
  if (linea.fichas.length === 0) return [linea.ini];
  return [linea.fichas[0].ini, ...linea.fichas.map((f) => f.fin)];
}
