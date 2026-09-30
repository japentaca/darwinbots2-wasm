// @ts-check
// Exportación de los datos de una corrida (decisiones 5 y 11 de
// port/web2/PLAN.md: CSV/JSON; el PNG lo hace la interfaz), sin DOM. Todo
// puro: devuelve texto (o bytes UTF-8 con aBytes()).
//
//   csvSerie(h, metrica, especie?)  una tabla por serie:
//                                   ciclo,media,min,max,n
//   csvLargo(h, filtro?)            tabla larga de todas las series (o las
//                                   filtradas): ciclo,metrica,especie,media,min,max,n
//                                   (especie vacía = serie global)
//   jsonCorrida({historia, linaje?, eventos?, meta?})
//                                   historia + eventos + linaje en JSON (los
//                                   typed arrays como arreglos)
//   desdeJson(texto)                lo inverso: {historia, linaje, eventos, meta}
//
// CSV: separador coma, fin de línea \n, punto decimal; los campos con coma,
// comillas o saltos van entre comillas (los nombres de bots pueden traerlas).
// Un texto que empieza con = + - @ (o tabulador/retorno) lleva un apóstrofo
// delante, para que una planilla no lo tome como fórmula. NaN y los puntos
// ausentes quedan vacíos. Los valores float32 (CSV y JSON) se escriben con
// la menor cantidad de cifras que vuelve al mismo float32 (sin el ruido de
// 0.30000001192092896 y sin perder nada al leerlos de vuelta).

import { Historia } from './history.js';
import { Linaje } from './lineage.js';

export const FORMATO_JSON = 1;

/** Campo CSV. @param {unknown} v */
export function campoCsv(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  let s = String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** @param {unknown[]} fila */
const linea = (fila) => fila.map(campoCsv).join(',');

/**
 * Número de float32 sin ruido: la escritura decimal más corta que, pasada
 * a float32, da el mismo valor (hasta 9 cifras significativas). Un valor
 * que no es float32 (la media de un punto fundido, calculada en memoria)
 * sale con 7 cifras significativas, la precisión de las muestras.
 * @param {number} x
 */
export function limpio(x) {
  if (!Number.isFinite(x)) return Number.NaN;
  const f = Math.fround(x);
  if (f !== x) return Number(x.toPrecision(7));
  for (let p = 1; p < 9; p++) {
    const y = Number(x.toPrecision(p));
    if (Math.fround(y) === f) return y;
  }
  return Number(x.toPrecision(9));
}

/**
 * Una serie como tabla CSV (ciclo,media,min,max,n). Vacía (solo la
 * cabecera) si la serie no existe.
 * @param {Historia} h @param {string} metrica @param {string} [especie]
 */
export function csvSerie(h, metrica, especie) {
  const s = h.serie(metrica, especie);
  const out = [linea(['ciclo', 'media', 'min', 'max', 'n'])];
  if (s)
    for (let i = 0; i < s.t.length; i++)
      out.push(linea([s.t[i], limpio(s.media[i]), limpio(s.min[i]), limpio(s.max[i]), s.n[i]]));
  return `${out.join('\n')}\n`;
}

/**
 * Tabla larga de las series de la historia: primero las globales (en el
 * orden de engine/metricas.js) y después las de cada especie (campos de
 * especie y de comportamiento). `filtro` limita métricas y especies (sin
 * él, todas; `globales: false` las omite).
 * @param {Historia} h
 * @param {{metricas?: string[], especies?: string[], globales?: boolean}} [filtro]
 */
export function csvLargo(h, filtro = {}) {
  const cols = Historia.columnas;
  const quiere = (/** @type {string} */ m) => !filtro.metricas || filtro.metricas.includes(m);
  const out = [linea(['ciclo', 'metrica', 'especie', 'media', 'min', 'max', 'n'])];
  /** @param {string} m @param {string} [e] */
  const volcar = (m, e) => {
    const s = h.serie(m, e);
    if (!s) return;
    for (let i = 0; i < s.t.length; i++)
      out.push(
        linea([s.t[i], m, e ?? '', limpio(s.media[i]), limpio(s.min[i]), limpio(s.max[i]), s.n[i]]),
      );
  };
  if (filtro.globales !== false) for (const m of cols.global) if (quiere(m)) volcar(m);
  const especies = h
    .nombresEspecies()
    .filter((e) => !filtro.especies || filtro.especies.includes(e));
  for (const e of especies)
    for (const m of [...cols.especie, ...cols.comportamiento]) if (quiere(m)) volcar(m, e);
  return `${out.join('\n')}\n`;
}

/**
 * Typed arrays → arreglos (JSON; los Float32Array sin ruido, con limpio());
 * NaN → null.
 * @param {string} _k @param {unknown} v
 */
function reemplazo(_k, v) {
  if (v instanceof Float32Array)
    return Array.from(v, (x) => (Number.isFinite(x) ? limpio(x) : null));
  if (ArrayBuffer.isView(v) && !(v instanceof DataView))
    return Array.from(/** @type {ArrayLike<number>} */ (/** @type {unknown} */ (v)), (x) =>
      Number.isFinite(x) ? x : null,
    );
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return v;
}

/**
 * La corrida en JSON: historia (Historia.serializar, que ya trae el feed de
 * eventos), `eventos` (los de la corrida: cambios en caliente) y linaje
 * (Linaje.serializar), con metadatos libres (escenario, semilla, cambios…).
 * @param {{historia: Historia, linaje?: Linaje | null, eventos?: any[], meta?: Record<string, unknown>}} o
 * @param {{espacios?: number}} [op]
 */
export function jsonCorrida(o, op = {}) {
  return JSON.stringify(
    {
      formato: FORMATO_JSON,
      tipo: 'corrida',
      meta: o.meta ?? {},
      historia: o.historia.serializar(),
      eventos: o.eventos ?? [],
      linaje: o.linaje ? o.linaje.serializar() : null,
    },
    reemplazo,
    op.espacios,
  );
}

/**
 * Lee lo que escribió jsonCorrida (los arreglos vuelven a typed arrays donde
 * la historia y el linaje los esperan; null vuelve a NaN).
 * @param {string} texto
 * @returns {{historia: Historia, linaje: Linaje | null, eventos: any[], meta: Record<string, unknown>}}
 */
export function desdeJson(texto) {
  const o = JSON.parse(texto);
  if (o?.tipo !== 'corrida' || o.formato !== FORMATO_JSON)
    throw new Error('export: no es un JSON de corrida');
  /** @param {unknown} a */
  const f32 = (a) => Float32Array.from(/** @type {any[]} */ (a ?? []), (x) => x ?? Number.NaN);
  /** @param {any} p */
  const pista = (p) => ({
    ...p,
    n: Uint32Array.from(p.n ?? []),
    media: f32(p.media),
    min: f32(p.min),
    max: f32(p.max),
  });
  const hs = o.historia ?? {};
  const historia = Historia.deserializar({
    ...hs,
    t: Float64Array.from(hs.t ?? []),
    global: pista(hs.global ?? {}),
    especies: (hs.especies ?? []).map(pista),
    comportamiento: (hs.comportamiento ?? []).map(pista),
    histogramas: hs.histogramas
      ? {
          bins: hs.histogramas.bins,
          ciclos: Float64Array.from(hs.histogramas.ciclos ?? []),
          n: f32(hs.histogramas.n),
          datos: f32(hs.histogramas.datos),
        }
      : undefined,
  });
  const l = o.linaje;
  const linaje = l
    ? Linaje.deserializar({
        ...l,
        individuos: Int32Array.from(l.individuos ?? []),
        vivos: Int32Array.from(l.vivos ?? []),
      })
    : null;
  return { historia, linaje, eventos: o.eventos ?? [], meta: o.meta ?? {} };
}

/** Texto → bytes UTF-8 (para un Blob o un archivo). @param {string} s */
export const aBytes = (s) => new TextEncoder().encode(s);
