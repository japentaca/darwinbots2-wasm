// @ts-check
// Variantes del ADN para la evolución asistida del editor (PLAN-EDITOR E4.2).
// Puro: sin DOM, sin wasm. Las variantes en sí las hace el motor (sim.js,
// caso 'variantes'); aquí están las piezas de texto:
//
//   sinColaDeGuardado(texto)     el ADN sin la cola que escribe SalvarobText
//                                (`'#hash:` y `'#tag:`). Vivía en
//                                src/lib/inspector/adn.js: adn.js la re-exporta.
//   injertar(original, variante) el texto de `original` con los genes que
//                                cambiaron en `variante` (diffGenes). Los genes
//                                iguales quedan tal cual, con sus comentarios.
//   distintas(original, textos)  las variantes que no son iguales al original
//                                ni entre sí (canonico: los comentarios y los
//                                espacios no cuentan).

import { canonico } from './adn.js';
import { genesTexto, insertarGen, PREFIJO_APAGADO, tokensTexto } from './lab.js';
import { diffGenes, genesAdn } from './lineage.js';

/** Palabras que abren un bloque dentro de un gen. */
const CLAVES_GEN = new Set(['cond', 'start', 'else', 'stop']);

/**
 * La línea de cabecera de un gen: el comentario de la línea de arriba, si la
 * hay (el nombre del gen, como nombreArriba de lab.js). Un gen apagado no
 * cuenta. Devuelve el número de línea de la cabecera o `l0` si no hay.
 * @param {string[]} lineas
 * @param {number} l0
 * @returns {number}
 */
function cabeceraDe(lineas, l0) {
  const a = l0 - 1;
  if (a < 0) return l0;
  const s = lineas[a].replace(/\r$/, '').trim();
  if (!s.startsWith("'") || s.startsWith(PREFIJO_APAGADO.trim())) return l0;
  return a;
}

/**
 * El ADN sin la cola que escribe SalvarobText después del ADN: las líneas
 * `'#hash:` y `'#tag:`. En LF, sin NUL y sin espacios al final. Es el texto que
 * se lleva al editor.
 * @param {string} texto
 * @returns {string}
 */
export function sinColaDeGuardado(texto) {
  const s = String(texto ?? '')
    .replaceAll('\0', '')
    .replace(/\r\n?/g, '\n');
  const m = /^'#(?:hash|tag):/m.exec(s);
  return (m ? s.slice(0, m.index) : s).replace(/\s+$/, '');
}

/**
 * Un gen como texto: cada cond/start/else/stop abre una línea y sus palabras
 * van en la línea de abajo con sangría de dos espacios (el estilo de
 * insertarGen de lab.js).
 * @param {string[]} palabras
 * @param {string} eol
 * @returns {string}
 */
function textoDeGen(palabras, eol) {
  /** @type {{clave: string, cont: string[]}[]} */
  const bloques = [];
  for (const w of palabras) {
    if (CLAVES_GEN.has(w.toLowerCase())) bloques.push({ clave: w, cont: [] });
    else if (bloques.length) bloques[bloques.length - 1].cont.push(w);
    else bloques.push({ clave: '', cont: [w] });
  }
  /** @type {string[]} */
  const lineas = [];
  for (const b of bloques) {
    if (b.clave) lineas.push(b.clave);
    if (b.cont.length) lineas.push(`${b.clave ? '  ' : ''}${b.cont.join(' ')}`);
  }
  return lineas.join(eol);
}

/**
 * @typedef {{ini: number, fin: number, texto: string}} Edicion
 */

/**
 * Aplica las ediciones (rangos sobre `texto`) de atrás para adelante. A igual
 * inicio, primero la que termina después: una inserción en P queda delante
 * de un reemplazo que empieza en P.
 * @param {string} texto
 * @param {Edicion[]} ediciones
 */
function aplicar(texto, ediciones) {
  const orden = [...ediciones].sort((a, b) => b.ini - a.ini || b.fin - a.fin);
  let s = texto;
  for (const e of orden) s = s.slice(0, e.ini) + e.texto + s.slice(e.fin);
  return s;
}

/**
 * El texto de `original` con los cambios de `variante`, gen por gen (diffGenes
 * de engine/lineage.js sobre las palabras de cada gen):
 *   - igual: queda tal cual, con sus comentarios;
 *   - cambiado: sus palabras se reemplazan por las del gen de `variante`
 *     (cond/start/else/stop abren líneas, el contenido va con sangría de
 *     dos espacios); los comentarios DENTRO del gen se pierden, los de
 *     afuera quedan;
 *   - agregado: se inserta justo después del gen mapeado que lo precede en
 *     `variante` (o antes del que lo sigue, si es el primero);
 *   - quitado: se quitan sus líneas y su cabecera (o solo sus palabras, si
 *     comparte línea con otro código).
 * Si ningún gen de `original` aparece en `variante`, los agregados van con
 * insertarGen (al final, antes del `end`).
 * Una variante igual en genes devuelve `original` sin tocar.
 *
 * `referencia` (opcional) es el ADN que el motor escribe para `original` sin
 * mutar (db_sim_bot_text del fundador). El motor reescribe el texto al
 * decompilar: cambia alias de sysvars (`.aimdx` → `.aimright`) y sustituye
 * algunas sysvars por su valor. Con la referencia, el diff se hace contra
 * ella (los cambios son los de la mutación, no los del decompilado), y sus
 * genes se emparejan con los de `original` por posición: la misma cantidad y
 * el mismo orden (lo cumplen los 684 bots del Bestiario). Si no coincide la
 * cantidad, se usa `original`.
 * @param {string} original
 * @param {string} variante
 * @param {string | null} [referencia]
 * @returns {string}
 */
export function injertar(original, variante, referencia = null) {
  const n = genesAdn(original).genes.length;
  const base =
    referencia !== null && genesAdn(referencia).genes.length === n ? referencia : original;
  const d = diffGenes(base, variante);
  if (d.cambios.every((c) => c.tipo === 'igual')) return original;

  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const tt = tokensTexto(original);
  const genes = genesTexto(tt);
  /** @type {number[]} inicio de cada línea (tt.lineas[l] empieza en starts[l]) */
  const starts = [0];
  for (let i = 0; i < original.length; i++) if (original[i] === '\n') starts.push(i + 1);
  /** @param {number} a */
  const ini = (a) => tt.tokens[genes[a].t0].ini;
  /** @param {number} a */
  const fin = (a) => tt.tokens[genes[a].t1].fin;

  /** @type {Map<number, number>} gen de variante (b) → gen de original (a), los que siguen */
  const aDeB = new Map();
  for (const c of d.cambios)
    if ((c.tipo === 'igual' || c.tipo === 'cambiado') && c.a !== null && c.b !== null)
      aDeB.set(c.b, c.a);

  /** @type {Edicion[]} */
  const ediciones = [];
  /** @type {Map<number, string>} inserciones por posición, en orden */
  const enPos = new Map();
  /** @type {string[][]} agregados sin ningún gen de `original` al que anclarse */
  const sueltos = [];
  const agregar = (/** @type {number} */ pos, /** @type {string} */ texto) =>
    enPos.set(pos, (enPos.get(pos) ?? '') + texto);

  for (const c of d.cambios) {
    if (c.tipo === 'cambiado' && c.a !== null && c.b !== null) {
      ediciones.push({
        ini: ini(c.a),
        fin: fin(c.a),
        texto: textoDeGen(d.genesB[c.b].split(' '), eol),
      });
    } else if (c.tipo === 'quitado' && c.a !== null) {
      const g = genes[c.a];
      const antes = original.slice(starts[g.l0], ini(c.a));
      const hasta = starts[g.l1 + 1] ?? original.length;
      const despues = original.slice(fin(c.a), hasta).replace(/\r?\n$/, '');
      if (/^[ \t]*$/.test(antes) && /^[ \t\r]*$/.test(despues)) {
        // el gen ocupa sus líneas enteras: se quitan con el salto final, y con
        // su cabecera (el nombre que está justo arriba)
        const desde = starts[cabeceraDe(tt.lineas, g.l0)];
        ediciones.push({ ini: desde, fin: hasta, texto: '' });
      } else {
        ediciones.push({ ini: ini(c.a), fin: fin(c.a), texto: '' });
      }
    } else if (c.tipo === 'agregado' && c.b !== null) {
      const palabras = d.genesB[c.b].split(' ');
      const texto = textoDeGen(palabras, eol);
      const previo = [...aDeB.keys()].filter((b) => b < c.b).sort((x, y) => y - x)[0];
      const siguiente = [...aDeB.keys()].filter((b) => b > c.b).sort((x, y) => x - y)[0];
      if (previo !== undefined) {
        const g = genes[aDeB.get(previo) ?? -1];
        const sig = starts[g.l1 + 1];
        if (sig !== undefined) agregar(sig, `${texto}${eol}`);
        else agregar(original.length, `${eol}${texto}`);
      } else if (siguiente !== undefined) {
        // antes del gen que sigue, y antes de su cabecera si la tiene
        const l0 = genes[aDeB.get(siguiente) ?? -1].l0;
        agregar(starts[cabeceraDe(tt.lineas, l0)], `${texto}${eol}`);
      } else {
        sueltos.push(palabras);
      }
    }
  }
  for (const [pos, texto] of enPos) ediciones.push({ ini: pos, fin: pos, texto });

  let s = aplicar(original, ediciones);
  for (const palabras of sueltos) s = insertarGen(s, textoDeGen(palabras, '\n'));
  return s;
}

/**
 * Las variantes que no son iguales al original ni entre sí (canonico, de
 * engine/adn.js: los comentarios y los espacios no cuentan). Conserva el orden
 * y la primera de cada grupo.
 * @param {string} original
 * @param {string[]} textos
 * @returns {string[]}
 */
export function distintas(original, textos) {
  const vistos = new Set([canonico(original)]);
  /** @type {string[]} */
  const out = [];
  for (const t of textos) {
    const c = canonico(t);
    if (vistos.has(c)) continue;
    vistos.add(c);
    out.push(t);
  }
  return out;
}
