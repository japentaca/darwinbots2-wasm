// @ts-check
// Piezas comunes de las plantillas Comparación y Réplicas (decisión 11 de
// port/web2/PLAN.md): fecha del informe, nombre del escenario, nombres de
// las métricas globales, figuras numeradas, leyendas y el resumen de la
// configuración de un escenario. Puro y sin DOM.

import { METRICAS } from '../metricas.js';
import { esc } from './svg.js';
import { TEXTOS } from './textos.js';

/** @typedef {ReturnType<typeof import('./textos.js').traductor>} Traductor */

/**
 * Fecha del informe (Date) y su texto corto en el idioma ('' si no vale).
 * @param {string | number | Date | undefined} f @param {'es' | 'en'} idioma
 */
export function fechaInforme(f, idioma) {
  const fecha = new Date(f ?? Date.now());
  const texto = Number.isNaN(fecha.getTime())
    ? ''
    : new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es-AR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(fecha);
  return { fecha, texto, iso: Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString() };
}

/**
 * Nombre de un escenario en el idioma ('' si no tiene).
 * @param {any} escenario @param {'es' | 'en'} idioma
 */
export function nombreEscenario(escenario, idioma) {
  const n = escenario?.nombre;
  if (typeof n === 'string') return n;
  if (n && typeof n === 'object') return String(n[idioma] || n.es || '');
  return '';
}

/** Métricas globales con nombre en los textos del informe (todas menos «ciclo»). */
export const METRICAS_GLOBALES = Object.freeze(
  METRICAS.map((m) => m.clave).filter((c) => c !== 'ciclo'),
);

/**
 * Nombre de una métrica global (`metrica.<clave>`); si no tiene texto, la
 * clave tal cual (es el nombre de la variable).
 * @param {Traductor} tr @param {string} clave
 */
export function nombreMetrica(tr, clave) {
  return `metrica.${clave}` in TEXTOS[tr.idioma] ? tr.tx(`metrica.${clave}`) : clave;
}

/**
 * Numerador de figuras: `figura(id, contenido, texto, extra)` devuelve el
 * <figure> con su número; `numeros` guarda el número de cada id.
 * @param {Traductor} tr
 */
export function figuras(tr) {
  /** @type {Map<string, number>} */
  const numeros = new Map();
  /** @param {string} id @param {string} contenido @param {string} texto @param {string} [extra] */
  const figura = (id, contenido, texto, extra = '') => {
    const n = numeros.size + 1;
    numeros.set(id, n);
    return `<figure id="${esc(id)}">${contenido}${extra}<figcaption class="cap"><strong>${esc(tr.tx('fig.titulo', { n }))}</strong> ${esc(texto)}</figcaption></figure>`;
  };
  return { numeros, figura };
}

/**
 * Leyenda de colores (nada con menos de dos elementos).
 * @param {{nombre: string, color: string, discontinua?: boolean}[]} items
 */
export function leyenda(items) {
  return items.length < 2
    ? ''
    : `<div class="leyenda">${items
        .map(
          (s) =>
            `<span><span class="sw" style="background:${esc(s.color)}${s.discontinua ? ';opacity:.6' : ''}"></span>${esc(s.nombre)}</span>`,
        )
        .join('')}</div>`;
}

/**
 * Formateadores de ejes para un rango de ciclos.
 * @param {Traductor} tr @param {number} cicloFin
 */
export function formatosEje(tr, cicloFin) {
  /** @param {number} x */
  const fmtX = (x) => (cicloFin >= 10000 ? `${tr.num(x / 1000, 1)}k` : tr.num(x, 0));
  /** @param {number} y */
  const fmtY = (y) => tr.num(y, Math.abs(y) < 10 ? 2 : 0);
  return { fmtX, fmtY };
}

/** Último valor finito de una lista (NaN si no hay). @param {ArrayLike<number>} a */
export function ultimoFinito(a) {
  for (let i = a.length - 1; i >= 0; i--) if (Number.isFinite(a[i])) return Number(a[i]);
  return Number.NaN;
}

/** @param {number} v */
export const redondo = (v) => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);

/**
 * Tabla HTML simple (cabecera + filas de celdas ya escapadas). `izq`: índices
 * de las columnas alineadas a la izquierda (la primera siempre lo está).
 * @param {string[]} cab @param {string[][]} filas @param {number[]} [izq]
 */
export function tabla(cab, filas, izq = []) {
  const cls = (/** @type {number} */ i) => (i > 0 && izq.includes(i) ? ' class="izq"' : '');
  return `<table class="tbl"><thead><tr>${cab
    .map((c, i) => `<th scope="col"${cls(i)}>${esc(c)}</th>`)
    .join('')}</tr></thead><tbody>${filas
    .map((f) => `<tr>${f.map((c, i) => `<td${cls(i)}>${c}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`;
}
