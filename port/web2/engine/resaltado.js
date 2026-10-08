// @ts-check
// Clases de las palabras del ADN, sin DOM: las usan el resaltado del editor
// (src/lib/bots/editor/resaltado.js, que las re-exporta sin cambiar sus
// imports) y el modo Fichas (engine/fichas.js, PLAN-EDITOR E3.1). Viven en
// engine/ para que engine/ no importe de src/.
//
//   esLineaDef(codigo)            ¿la parte de código de una línea es `def`?
//   defsDe(texto)                 las variables privadas (`def nombre …`)
//   claseDe(w, defs, marcadas)    la clase de una palabra (flu, cmd, sys, …)
//   NOMBRES_SYSVAR                los nombres de sysvar en minúsculas

import { codigoDeLinea } from './lab.js';
import { COMANDOS, SYSVARS } from './vocabulario.js';

const FLUJO = new Set([...COMANDOS.flujo, ...COMANDOS.fin]);
const CMD = new Set(
  Object.entries(COMANDOS)
    .filter(([k]) => k !== 'flujo' && k !== 'fin')
    .flatMap(([, v]) => v),
);
export const NOMBRES_SYSVAR = new Set(SYSVARS.map(([n]) => n.toLowerCase()));

/** ¿La parte de código de una línea es una línea `def` para el core? @param {string} codigo */
export const esLineaDef = (codigo) => /^[ \t]*def/.test(codigo);

/**
 * Variables privadas (`def nombre valor`) del ADN, como las lee el core
 * (insertvar: recortada la línea, del 5.º carácter al primer espacio).
 * @param {string} texto
 * @returns {Set<string>}
 */
export function defsDe(texto) {
  const out = new Set();
  for (const l of texto.split('\n')) {
    const c = codigoDeLinea(l);
    if (!esLineaDef(c)) continue;
    const a = c.replaceAll('\t', ' ').trim().slice(4);
    const p = a.indexOf(' ');
    if (p > 0) out.add(a.slice(0, p));
  }
  return out;
}

/**
 * Clase de una palabra.
 * @param {string} w @param {Set<string>} defs @param {Set<string>} marcadas
 */
export function claseDe(w, defs, marcadas) {
  if (marcadas.has(w)) return 'err';
  const lc = w.toLowerCase();
  if (FLUJO.has(lc)) return 'flu';
  if (CMD.has(lc)) return 'cmd';
  const op = w.startsWith('*') ? w.slice(1) : w;
  if (op.startsWith('.')) {
    const n = op.slice(1);
    return NOMBRES_SYSVAR.has(n.toLowerCase()) || defs.has(n) ? 'sys' : 'otra';
  }
  if (/^[-+]?\d+$/.test(op)) return w.startsWith('*') ? 'ref' : 'num';
  return 'otra';
}
