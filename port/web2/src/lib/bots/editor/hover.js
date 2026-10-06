// @ts-check
// La palabra del ADN bajo el puntero y su entrada del vocabulario del
// manual, para la tarjeta del editor (S10 de PLAN-SITIO.md). Puro, sin DOM:
// la posición la calcula AreaAdn.svelte con la métrica de la fuente mono.

/**
 * La palabra bajo una posición del texto, o null (espacio, fin del texto, o
 * dentro de un comentario: ' al fin de la línea, o la línea entera si
 * empieza con /; la misma regla del autocompletado).
 * @param {string} texto @param {number} pos
 * @returns {string | null}
 */
export function palabraBajo(texto, pos) {
  if (pos < 0 || pos > texto.length) return null;
  let ini = pos;
  while (ini > 0 && !/\s/.test(texto[ini - 1])) ini--;
  let fin = pos;
  while (fin < texto.length && !/\s/.test(texto[fin])) fin++;
  if (ini === fin) return null;
  const linea = texto.slice(texto.lastIndexOf('\n', ini - 1) + 1, ini);
  if (linea.includes("'") || /^\s*\//.test(linea)) return null;
  return texto.slice(ini, fin);
}

/**
 * La entrada del vocabulario del manual para una palabra del ADN (una
 * sysvar `.x` o `*.x`, o un operador), o null si no tiene página.
 * @param {string} w @param {import('../../manual.js').Vocabulario | null} vocab
 * @returns {import('../../manual.js').EntradaManual | null}
 */
export function entradaDe(w, vocab) {
  if (!vocab) return null;
  const s = /^(\*?)\.(\w+)$/.exec(w);
  if (s) return vocab.sysvars[s[2].toLowerCase()] ?? null;
  if (/^[a-z]+$/i.test(w)) return vocab.operadores[w.toLowerCase()] ?? null;
  return vocab.operadores[w] ?? null;
}

/**
 * El offset del carácter apuntado a partir de la línea y la columna
 * visuales (base 0). El tabulador avanza hasta el próximo múltiplo de 4
 * columnas, como el tab-size del editor.
 * @param {string} texto @param {number} linea @param {number} col
 * @returns {number}
 */
export function offsetVisual(texto, linea, col) {
  if (linea < 0 || col < 0) return 0;
  let i = 0;
  for (let l = 0; l < linea; l++) {
    const nl = texto.indexOf('\n', i);
    if (nl < 0) return texto.length;
    i = nl + 1;
  }
  const nl = texto.indexOf('\n', i);
  const finLinea = nl < 0 ? texto.length : nl;
  let visual = 0;
  let p = i;
  while (p < finLinea && visual < col) {
    visual += texto[p] === '\t' ? 4 - (visual % 4) : 1;
    p++;
  }
  return p;
}
