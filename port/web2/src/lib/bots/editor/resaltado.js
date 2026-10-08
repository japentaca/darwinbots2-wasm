// @ts-check
// Resaltado del ADN para la capa que va detrás del textarea del editor
// (decisión 18), sin DOM: texto → HTML con un <span class="…"> por palabra.
// La capa y el textarea usan la misma fuente, el mismo interlineado y el
// mismo ajuste, así que el HTML conserva EXACTAMENTE el texto (espacios,
// tabulaciones y saltos): sin las etiquetas y sin escapar, es el texto.
//
// Las reglas de comentario y de `def` son las del core (loader.hpp
// LoadDNAText): comentario de ' al fin de la línea, o la línea entera si
// (recortada) empieza con /; una línea que (recortada) empieza con `def`,
// en minúsculas, define una variable privada (hasta `defensa 50` define
// `nsa`: el nombre va del 5.º carácter al primer espacio). Las privadas
// distinguen mayúsculas; las sysvars no.
//
// Clases (prefijo `r-`):
//   com   comentario                                 off  línea de un gen apagado
//   flu   cond / start / else / stop / end           cmd  comando del core
//   sys   sysvar (.x / *.x) o variable privada (def)  num  número
//   ref   *número (lectura de memoria)                def  línea def
//   err   palabra que el lint marca (vale 0 o se pierde)
//   otra  cualquier otra (el lint dirá si vale 0)

import { codigoDeLinea, PREFIJO_APAGADO } from '../../../../engine/lab.js';
import { claseDe, defsDe, esLineaDef, NOMBRES_SYSVAR } from '../../../../engine/resaltado.js';

// Las clases viven en engine/resaltado.js (PLAN-EDITOR E3.1); se re-exportan
// desde acá para que los imports existentes no cambien.
export { claseDe, defsDe, esLineaDef, NOMBRES_SYSVAR };

/** @param {string} s */
export const escapar = (s) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * HTML de una línea (sin el salto).
 * @param {string} linea @param {Set<string>} defs @param {Set<string>} marcadas
 */
export function resaltarLinea(linea, defs, marcadas) {
  if (linea.startsWith(PREFIJO_APAGADO)) return `<span class="r-off">${escapar(linea)}</span>`;
  const codigo = codigoDeLinea(linea);
  const resto = linea.slice(codigo.length);
  let h = '';
  if (esLineaDef(codigo)) h = `<span class="r-def">${escapar(codigo)}</span>`;
  else
    for (const m of codigo.matchAll(/(\s+)|(\S+)/g)) {
      if (m[1]) h += escapar(m[1]);
      else h += `<span class="r-${claseDe(m[2], defs, marcadas)}">${escapar(m[2])}</span>`;
    }
  if (resto) h += `<span class="r-com">${escapar(resto)}</span>`;
  return h;
}

/**
 * HTML del resaltado.
 * @param {string} texto
 * @param {{marcadas?: Set<string>}} [o]  palabras que marca el lint
 */
export function resaltarHtml(texto, o = {}) {
  const marcadas = o.marcadas ?? new Set();
  const defs = defsDe(texto);
  const out = [];
  for (const linea of texto.split('\n')) out.push(resaltarLinea(linea, defs, marcadas));
  // Un salto final necesita una línea más para que la capa mida lo mismo.
  return `${out.join('\n')}\n`;
}

/**
 * resaltarHtml con caché por línea (el editor: al escribir cambia una línea
 * y las demás salen de la caché). La caché se vacía si cambian las
 * privadas (`def`) o las palabras marcadas, y si crece demasiado.
 * @returns {(texto: string, marcadas?: Set<string>) => string}
 */
export function crearResaltador() {
  /** @type {Map<string, string>} */
  let cache = new Map();
  let claveDefs = '';
  /** @type {Set<string> | null} */
  let ultMarcadas = null;
  return (texto, marcadas = new Set()) => {
    const defs = defsDe(texto);
    const k = [...defs].join('\n');
    if (k !== claveDefs || marcadas !== ultMarcadas || cache.size > 50_000) {
      cache = new Map();
      claveDefs = k;
      ultMarcadas = marcadas;
    }
    const out = [];
    for (const linea of texto.split('\n')) {
      let h = cache.get(linea);
      if (h === undefined) {
        h = resaltarLinea(linea, defs, marcadas);
        cache.set(linea, h);
      }
      out.push(h);
    }
    return `${out.join('\n')}\n`;
  };
}

/** El texto de un HTML de resaltarHtml (sin etiquetas, sin escapar). @param {string} html */
export const textoDeHtml = (html) =>
  html
    .replace(/<[^>]+>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
