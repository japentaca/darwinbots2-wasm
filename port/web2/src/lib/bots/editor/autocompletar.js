// @ts-check
// Autocompletado de sysvars del editor de ADN (decisión 18), sin DOM. La
// lista sale del core (vocabulario.js, generado de sysvars.hpp) más las
// variables privadas (`def`) del propio ADN.
//
// Teclas (AreaAdn.svelte): ↑/↓ eligen, Tab acepta la elegida y Escape
// cierra. Enter acepta la elegida SALVO que lo escrito ya sea un nombre
// completo (esExacta): entonces cierra la lista y el Enter hace su salto de
// línea, así `.up` + Enter queda `.up` (no `.upx` ni otra). Para aceptar
// otra sugerencia con lo escrito ya completo, ↓ y Tab.

import { defsDe, NOMBRES_SYSVAR } from './resaltado.js';
import { COMANDOS, SYSVARS } from './vocabulario.js';

export const MAX_SUGERENCIAS = 12;

/**
 * La palabra que se está escribiendo si es una sysvar a medias (`.xx` o
 * `*.xx`, con el cursor al final), o null.
 * @param {string} texto @param {number} pos posición del cursor
 * @returns {{ini: number, fin: number, prefijo: string, estrella: boolean} | null}
 */
export function palabraEnCurso(texto, pos) {
  let ini = pos;
  while (ini > 0 && !/\s/.test(texto[ini - 1])) ini--;
  const w = texto.slice(ini, pos);
  const m = /^(\*?)\.(\w*)$/.exec(w);
  if (!m) return null;
  // dentro de un comentario (' en la línea, o la línea empieza con /), no
  const linea = texto.slice(texto.lastIndexOf('\n', ini - 1) + 1, ini);
  if (linea.includes("'") || /^\s*\//.test(linea)) return null;
  return { ini, fin: pos, prefijo: m[2], estrella: m[1] === '*' };
}

/**
 * Sugerencias para un prefijo (sin el punto): primero la que coincide
 * exactamente (sin distinguir mayúsculas: con `.aim` escrito, `aim` va
 * antes que `aimdx`), después las que empiezan igual (las privadas antes)
 * y por último las que lo contienen. Sin repetir; como mucho
 * MAX_SUGERENCIAS.
 * @param {string} prefijo @param {string} texto el ADN (sus `def`)
 * @returns {{nombre: string, dir: number | null, privada: boolean}[]}
 */
export function sugerencias(prefijo, texto) {
  const p = prefijo.toLowerCase();
  /** @type {{nombre: string, dir: number | null, privada: boolean}[]} */
  const todas = [
    ...[...defsDe(texto)].map((nombre) => ({ nombre, dir: null, privada: true })),
    ...SYSVARS.map(([nombre, dir]) => ({ nombre, dir, privada: false })),
  ];
  const vistos = new Set();
  const out = [];
  for (const pasada of [0, 1, 2])
    for (const s of todas) {
      const n = s.nombre.toLowerCase();
      const ok =
        pasada === 0
          ? p.length > 0 && n === p
          : pasada === 1
            ? n.startsWith(p)
            : !n.startsWith(p) && p.length > 0 && n.includes(p);
      if (!ok || vistos.has(n)) continue;
      vistos.add(n);
      out.push(s);
      if (out.length >= MAX_SUGERENCIAS) return out;
    }
  return out;
}

/**
 * ¿Lo escrito ya es un nombre completo (sysvar o privada, sin distinguir
 * mayúsculas)? Entonces Enter no acepta la sugerencia (ver la cabecera).
 * @param {string} prefijo @param {string} texto el ADN (sus `def`)
 */
export function esExacta(prefijo, texto) {
  const p = prefijo.toLowerCase();
  if (!p) return false;
  if (NOMBRES_SYSVAR.has(p)) return true;
  for (const d of defsDe(texto)) if (d.toLowerCase() === p) return true;
  return false;
}

/**
 * Texto con la sugerencia aplicada: {texto, cursor}.
 * @param {string} texto @param {{ini: number, fin: number, estrella: boolean}} w
 * @param {string} nombre
 */
export function completar(texto, w, nombre) {
  const nuevo = `${w.estrella ? '*' : ''}.${nombre}`;
  return {
    texto: texto.slice(0, w.ini) + nuevo + texto.slice(w.fin),
    cursor: w.ini + nuevo.length,
    insertado: nuevo,
  };
}

/**
 * Sugerencias del modo Fichas (PLAN-EDITOR E3.1). Una palabra con punto (`.x`
 * o `*.x`) busca entre las sysvars y las variables privadas `defs`, con las
 * reglas de sugerencias(); una palabra sin punto busca los comandos del core
 * que empiezan con ella (exacto primero). Vacía si no hay prefijo. `palabra`
 * es lo que se inserta en la ficha. Está acá y no en engine/fichas.js porque
 * depende de resaltado.js y del vocabulario de src/.
 * @param {string} prefijo lo escrito hasta el cursor
 * @param {Iterable<string>} defs variables privadas del ADN (sin el punto)
 * @returns {{palabra: string, tipo: 'sysvar' | 'privada' | 'comando', dir: number | null}[]}
 */
export function sugerenciasFicha(prefijo, defs) {
  const dot = /^(\*?)\.(.*)$/.exec(prefijo);
  if (dot) {
    // sugerencias() saca las privadas de un texto: le damos una línea `def` por cada una.
    const texto = [...defs].map((d) => `def ${d} 0`).join('\n');
    return sugerencias(dot[2], texto)
      .slice(0, MAX_SUGERENCIAS)
      .map((s) => ({
        palabra: `${dot[1]}.${s.nombre}`,
        tipo: /** @type {'privada' | 'sysvar'} */ (s.privada ? 'privada' : 'sysvar'),
        dir: s.dir,
      }));
  }
  if (!prefijo) return [];
  const p = prefijo.toLowerCase();
  const comandos = [...new Set(Object.values(COMANDOS).flat())];
  const exactos = comandos.filter((c) => c === p);
  const empiezan = comandos.filter((c) => c !== p && c.startsWith(p));
  return [...exactos, ...empiezan].slice(0, MAX_SUGERENCIAS).map((c) => ({
    palabra: c,
    tipo: 'comando',
    dir: null,
  }));
}
