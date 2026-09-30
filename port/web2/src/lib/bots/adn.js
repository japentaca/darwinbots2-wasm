// @ts-check
// Lo que la ficha muestra del ADN de un bot (paso N3.2, puro; decisión 20):
// la descripción (los comentarios del principio del archivo), qué sysvars
// lee y cuáles escribe, y los tipos de disparo que usa.
//
// Lectura del texto, sin compilarlo:
//   - comentarios: desde ' o // hasta el fin de la línea;
//   - lee: cada `*.nombre`;
//   - escribe: `.nombre` seguido de store, inc o dec (el patrón
//     `valor .sysvar store`); un `.nombre` suelto es un número y no cuenta;
//   - disparos: el número literal antes de `.shoot store`.

/** Sin comentarios. @param {string} linea */
const sinComentario = (linea) => {
  const i = linea.search(/'|\/\//);
  return i < 0 ? linea : linea.slice(0, i);
};

/**
 * Descripción: las líneas de comentario del principio del ADN (antes de la
 * primera instrucción), sin la marca de comentario. Vacía si no hay.
 * @param {string} adn @param {number} [maxLineas]
 */
export function descripcionAdn(adn, maxLineas = 12) {
  const out = [];
  for (const cruda of String(adn ?? '').split(/\r?\n/)) {
    const l = cruda.trim();
    if (!l) {
      if (out.length && out[out.length - 1] !== '') out.push('');
      continue;
    }
    const m = /^(?:'+|\/\/+)\s?(.*)$/.exec(l);
    if (!m) break;
    const texto = m[1].replace(/^[-=*#'\s]+$/, '').trimEnd();
    if (texto || (out.length && out[out.length - 1] !== '')) out.push(texto);
    if (out.filter(Boolean).length >= maxLineas) break;
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  while (out.length && out[0] === '') out.shift();
  return out.join('\n');
}

const RE_LEE = /^\*\.([a-z_][\w]*)$/i;
const RE_DIR = /^\.([a-z_][\w]*)$/i;
const ESCRIBEN = new Set(['store', 'inc', 'dec']);

/**
 * Sysvars que lee y escribe, en orden de aparición y sin repetir, y los
 * disparos literales (-1 energía, -2 dona, -3 veneno, -4 residuos, -6
 * cuerpo, -8 esperma…).
 * @param {string} adn
 * @returns {{lee: string[], escribe: string[], disparos: number[]}}
 */
export function leeYEscribe(adn) {
  const tokens = String(adn ?? '')
    .split(/\r?\n/)
    .flatMap((l) => sinComentario(l).trim().split(/\s+/))
    .filter(Boolean);
  /** @type {Set<string>} */
  const lee = new Set();
  /** @type {Set<string>} */
  const escribe = new Set();
  /** @type {Set<number>} */
  const disparos = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const sig = (tokens[i + 1] ?? '').toLowerCase();
    let m = RE_LEE.exec(tk);
    if (m) {
      lee.add(m[1].toLowerCase());
      continue;
    }
    m = RE_DIR.exec(tk);
    if (m && ESCRIBEN.has(sig)) {
      escribe.add(m[1].toLowerCase());
      continue;
    }
    if (
      /^-?\d+$/.test(tk) &&
      tokens[i + 1]?.toLowerCase() === '.shoot' &&
      tokens[i + 2]?.toLowerCase() === 'store'
    )
      disparos.add(Number(tk));
  }
  return { lee: [...lee], escribe: [...escribe], disparos: [...disparos].sort((a, b) => a - b) };
}

/** Disparos con nombre propio (bots.disparo.<n>); el resto se muestra como número. */
export const DISPAROS_CONOCIDOS = Object.freeze([-1, -2, -3, -4, -6, -8]);

/** ADN de un bot nuevo: un gen vacío (se completa en la pestaña ADN). */
export const ADN_NUEVO = 'cond\nstart\nstop\nend\n';
