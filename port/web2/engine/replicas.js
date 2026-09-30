// @ts-check
// Réplicas (decisión 10 de port/web2/PLAN.md), sin DOM: la parte pura.
//
// Una réplica es la corrida de un escenario con OTRA semilla, sin dibujar y
// a máxima velocidad, hasta un ciclo objetivo, repitiendo los cambios en
// caliente de la corrida de origen en el MISMO ciclo (decisión 13). Por C15
// («escenario + semilla» da la misma corrida en cualquier worker) una
// réplica interrumpida se puede reiniciar desde cero en cualquier worker y
// da lo mismo.
//
// Este módulo arma:
//   - los parámetros de un trabajo de réplicas (lo que guarda la cola de
//     engine/cola.js: autocontenido, con el ADN de cada especie, para
//     reanudarlo tras una recarga sin volver a pedir nada);
//   - las semillas (la primera es la de la corrida de origen: la réplica 1
//     la repite; las demás, sin repetir un mundo del motor, C19);
//   - los mensajes de una réplica (arranque con aplicar() de
//     engine/escenarios y los eventos con mensajesEvento() de
//     engine/corridas.js) y el plan de pasos hasta cada evento;
//   - la historia de una réplica (engine/history.js con SOLO las 56 métricas
//     globales: las de especie no se agregan entre semillas);
//   - la agregación de N historias alineadas por ciclo (media, p10, p90,
//     mínimo y máximo) y la tabla de medias y desvíos del valor final.
//
// La orquestación de los workers vive en la página (src/lib/trabajos/).

import { mensajesEvento } from './corridas.js';
import { aplicar } from './escenarios/index.js';
import { Historia } from './history.js';
import { METRICAS } from './metricas.js';

export const TIPO_REPLICAS = 'replicas';
/** Ciclos entre muestras de una réplica (decisión 8). */
export const CADA_REPLICA = 100;
/** Puntos por serie de una réplica (la historia funde de a dos al pasarse). */
export const MAX_PUNTOS_REPLICA = 500;
export const MIN_REPLICAS = 1;
export const MAX_REPLICAS = 64;
export const MAX_CICLOS = 10_000_000;
/** Rango de semillas que usa la interfaz (como semillaNueva de la corrida). */
export const SEMILLA_MAX = 2147483646;

/**
 * Métricas globales de la tabla final (medias y desvíos): las que resumen
 * cómo terminó cada réplica.
 */
export const METRICAS_CLAVE = Object.freeze([
  'vivos',
  'noVegetales',
  'vegetales',
  'especiesVivas',
  'genMax',
  'mutMedia',
  'adnMedia',
  'nrgTotal',
  'killsTotal',
]);

/**
 * Métricas globales por grupo de la decisión 7 para elegir en Comparar. Los
 * volcados globales no traen un grupo «genética» propio (sus histogramas son
 * fotos, no series): se muestran ahí las métricas del ADN (largo, genes,
 * mutaciones) y en «evolución» las de linaje y edad.
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const GRUPOS_COMPARAR = Object.freeze({
  poblacion: Object.freeze(
    METRICAS.filter((m) => m.grupo === 'poblacion' && m.clave !== 'ciclo').map((m) => m.clave),
  ),
  evolucion: Object.freeze(['genMedia', 'genMax', 'edadMedia', 'edadMax', 'hijosMedia']),
  genetica: Object.freeze(['adnMedia', 'adnMin', 'adnMax', 'genesMedia', 'mutMedia', 'mutMax']),
  comportamiento: Object.freeze(
    METRICAS.filter((m) => m.grupo === 'comportamiento').map((m) => m.clave),
  ),
  energia: Object.freeze(METRICAS.filter((m) => m.grupo === 'energia').map((m) => m.clave)),
  entorno: Object.freeze(METRICAS.filter((m) => m.grupo === 'entorno').map((m) => m.clave)),
});

/** Grupo de Comparar de una métrica global (undefined si no está). @param {string} clave */
export function grupoDe(clave) {
  for (const [g, lista] of Object.entries(GRUPOS_COMPARAR)) if (lista.includes(clave)) return g;
  return undefined;
}

/**
 * @typedef {import('./escenarios/index.js').Escenario} Escenario
 * @typedef {import('./corridas.js').EventoCorrida} EventoCorrida
 * @typedef {{
 *   escenario: Escenario,
 *   adn: string[],
 *   semillas: number[],
 *   eventos: EventoCorrida[],
 *   ciclos: number,
 *   cada: number,
 *   maxPuntos: number,
 *   metrica: string,
 *   origen: {nombre: string, id?: string | null},
 * }} ParamsReplicas
 */

// ---- Semillas (C19) ------------------------------------------------------------

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
/** Mundos distintos: el motor usa 16 bits del estado derivado de la semilla. */
export const MUNDOS_DISTINTOS = 65536;

/** Un paso del LCG de 24 bits del motor (VbRng::operator()). @param {number} s */
const avanzarLcg = (s) => (Math.imul(s, 0x43fd43fd) + 0xc39ec3) & 0xffffff;

/**
 * Estado tras `Rnd -1` (VbRng::rnd_negative(-1.0f)): re-siembra con los bits
 * del Single −1 (0xBF800000) y avanza una vez. Es el mismo para toda semilla.
 */
const ESTADO_RND_MENOS_1 = (() => {
  const b = 0xbf800000 | 0;
  return avanzarLcg((b + (b >> 24)) & 0xffffff);
})();

/**
 * CLng de VB6 (llrint con el redondeo por defecto: al par en los medios).
 * @param {number} v
 */
function redondeoBancario(v) {
  const f = Math.floor(v);
  const d = v - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * Estado del generador del motor justo después de sembrarlo con `semilla`
 * (C19). El arranque de una sim nueva hace `Rnd -1 : Randomize semilla/100`
 * (db_sim_start en port/wasm/dbcore_api.cpp; VbRng en
 * port/core/include/dbcore/rng.hpp): `Rnd -1` deja siempre el mismo estado
 * y `Randomize n` reemplaza sus bits 8-23 (los «bytes del medio» de la
 * palabra de 32 bits; del estado de 24 bits sobrevive solo el byte bajo)
 * con la mezcla (bajos XOR altos) de la palabra alta del double `n`. Dos
 * semillas con la
 * misma mezcla dan el MISMO mundo: hay 65.536 mundos distintos. La semilla
 * pasa antes por CLng (redondeo al par) acotado a int32, como en el motor.
 * @param {number} semilla
 * @returns {{mezcla: number, estado: number}} mezcla (16 bits: la clave del
 *   mundo) y estado completo del generador (24 bits)
 */
export function estadoSemilla(semilla) {
  const v = Number(semilla);
  let s = Number.isFinite(v) ? redondeoBancario(v) : 0;
  s = Math.min(INT32_MAX, Math.max(INT32_MIN, s)) | 0; // | 0 también quita el −0
  const dv = new DataView(new ArrayBuffer(8));
  dv.setFloat64(0, s / 100); // big-endian: los 4 primeros bytes son la palabra alta
  const hi = dv.getInt32(0);
  const mezcla = ((hi & 0xffff) ^ ((hi >> 16) & 0xffff)) & 0xffff;
  return { mezcla, estado: ((ESTADO_RND_MENOS_1 & 0xff0000ff) | (mezcla << 8)) >>> 0 };
}

/**
 * N semillas: la primera es `base` tal cual (la réplica 1 repite la corrida
 * de origen) y las demás salen de un LCG sembrado con ella, en
 * [1, SEMILLA_MAX], descartando las que dan un mundo que ya salió (misma
 * mezcla de estadoSemilla, C19): así no hay dos réplicas iguales que
 * achiquen la banda y el desvío. Determinista.
 * @param {number} base @param {number} n
 * @returns {number[]}
 */
export function semillasReplicas(base, n) {
  const primera = Number.isFinite(base) ? base : 1;
  const out = [primera];
  const mundos = new Set([estadoSemilla(primera).mezcla]);
  const cuantas = Math.min(Math.trunc(n), MUNDOS_DISTINTOS);
  let x = Math.trunc(primera) >>> 0 || 1;
  while (out.length < cuantas) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const s = 1 + (x % SEMILLA_MAX);
    const m = estadoSemilla(s).mezcla;
    if (mundos.has(m)) continue;
    mundos.add(m);
    out.push(s);
  }
  return out;
}

/**
 * Error de parámetros con código estable (el texto sale de
 * t('comparar.error.<codigo>')).
 */
export class ErrorReplicas extends Error {
  /** @param {string} codigo @param {string} [detalle] */
  constructor(codigo, detalle) {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.codigo = codigo;
  }
}

/**
 * Parámetros de un trabajo de réplicas (lo que guarda la cola). `adn[i]` es
 * el ADN de `escenario.especies[i]` (el propio de la especie o el que
 * resolvió la página). Lanza ErrorReplicas: 'sin-escenario', 'n',
 * 'ciclos', 'cada', 'sin-adn', 'metrica'.
 * @param {{escenario: Escenario | null | undefined, adn: (string | undefined)[],
 *   semilla: number, n: number, ciclos: number, eventos?: EventoCorrida[],
 *   cada?: number, maxPuntos?: number, metrica?: string,
 *   origen?: {nombre: string, id?: string | null}}} o
 * @returns {ParamsReplicas}
 */
export function crearParametros(o) {
  if (!o.escenario) throw new ErrorReplicas('sin-escenario');
  const n = Math.trunc(o.n);
  if (!(n >= MIN_REPLICAS && n <= MAX_REPLICAS)) throw new ErrorReplicas('n', String(o.n));
  const ciclos = Math.trunc(o.ciclos);
  if (!(ciclos >= 1 && ciclos <= MAX_CICLOS)) throw new ErrorReplicas('ciclos', String(o.ciclos));
  const cada = Math.trunc(o.cada ?? CADA_REPLICA);
  if (!(cada >= 1 && cada <= ciclos)) throw new ErrorReplicas('cada', String(o.cada));
  const metrica = o.metrica ?? 'vivos';
  if (!grupoDe(metrica)) throw new ErrorReplicas('metrica', metrica);
  const esp = o.escenario.especies;
  /** @type {string[]} */
  const adn = esp.map((s, i) => {
    const d = s.adn ?? o.adn[i];
    if (typeof d !== 'string' || !d.trim()) throw new ErrorReplicas('sin-adn', s.bot);
    return d;
  });
  if (typeof o.semilla !== 'number' || !Number.isFinite(o.semilla))
    throw new ErrorReplicas('semilla', String(o.semilla));
  return {
    escenario: structuredClone(o.escenario),
    adn,
    semillas: semillasReplicas(o.semilla, n),
    eventos: structuredClone(o.eventos ?? []),
    ciclos,
    cada,
    maxPuntos: Math.max(8, Math.trunc(o.maxPuntos ?? MAX_PUNTOS_REPLICA)),
    metrica,
    origen: { nombre: o.origen?.nombre ?? '', id: o.origen?.id ?? null },
  };
}

/**
 * Lo que hace falta para LISTAR un trabajo de réplicas (la lista de la cola
 * se refresca seguido y viaja entre pestañas): sin el ADN, el escenario ni
 * los eventos.
 * @param {ParamsReplicas} p
 */
export function vistaParams(p) {
  return {
    semillas: [...(p?.semillas ?? [])],
    ciclos: p?.ciclos,
    cada: p?.cada,
    metrica: p?.metrica,
    origen: p?.origen ? { ...p.origen } : { nombre: '' },
  };
}

/**
 * @typedef {{ciclo: number, mensajes: any[]}} EventoReplica
 * @typedef {{inicio: any[], eventos: EventoReplica[], muestreo: any}} MensajesReplica
 */

/**
 * Los mensajes de la réplica i: el arranque (aplicar() con su semilla: pausa,
 * reset limpio y objetos), la configuración del muestreo (sin `req`: la pone
 * quien corre) y los eventos de la corrida con sus mensajes.
 * @param {ParamsReplicas} p @param {number} i
 * @returns {MensajesReplica}
 */
export function mensajesReplica(p, i) {
  const semilla = p.semillas[i];
  if (semilla === undefined) throw new ErrorReplicas('indice', String(i));
  const esc = p.escenario;
  const inicio = aplicar(esc, semilla, (s) => p.adn[esc.especies.indexOf(s)]);
  return {
    inicio,
    // Solo hacen falta las 56 métricas globales (van en toda muestra): el
    // grupo 'poblacion' no enciende el acumulador de comportamiento (que
    // cuesta un observe por tick) ni los histogramas.
    muestreo: { t: 'muestreo', cada: p.cada, grupos: ['poblacion'] },
    eventos: p.eventos.map((ev) => ({ ciclo: ev.ciclo, mensajes: mensajesEvento(ev) })),
  };
}

/**
 * Plan de una réplica: a qué ciclo avanzar y qué mandar al llegar, en orden,
 * terminando en el objetivo. Un evento se aplica cuando la sim está en su
 * ciclo (con la sim en pausa, como lo registró la corrida). La sim nueva
 * arranca en `c0` (−1: antes del primer tick). Convención de la corrida: el
 * ciclo de un evento es el de la sim cuando se aplicó, así que −1 = antes
 * del primer tick (va en el arranque, igual que cualquier ciclo < 0) y 0 =
 * después del primer tick. Corridas viejas: registraban 0 también lo hecho
 * antes del primer tick (el ciclo se acotaba a 0); no hay forma de
 * distinguirlo, así que su 0 se toma al pie de la letra (después del tick
 * 0): a lo sumo, un tick más tarde que en la corrida. Un evento posterior
 * al objetivo no se aplica. Eventos del mismo ciclo, en su orden.
 * @param {EventoReplica[]} eventos @param {number} c0 @param {number} objetivo
 * @returns {EventoReplica[]}
 */
export function planReplica(eventos, c0, objetivo) {
  /** @type {EventoReplica[]} */
  const out = [];
  for (const ev of eventos) {
    const c = ev.ciclo < 0 ? c0 : Math.max(ev.ciclo, c0);
    if (c > objetivo) continue;
    const ult = out[out.length - 1];
    if (ult && ult.ciclo === c) ult.mensajes.push(...ev.mensajes);
    else if (ult && ult.ciclo > c) throw new ErrorReplicas('orden-eventos');
    else out.push({ ciclo: c, mensajes: [...ev.mensajes] });
  }
  const ult = out[out.length - 1];
  if (!ult || ult.ciclo < objetivo) out.push({ ciclo: objetivo, mensajes: [] });
  return out;
}

/** Historia vacía de una réplica. @param {{cada: number, maxPuntos: number}} p */
export const historiaReplica = (p) =>
  new Historia({ intervalo: p.cada, maxPuntos: p.maxPuntos, maxHistogramas: 4 });

/**
 * Agrega a la historia de una réplica una muestra del worker (solo las
 * métricas globales).
 * @param {Historia} h @param {{ciclo: number, metrics: ArrayLike<number>}} m
 */
export const agregarMuestra = (h, m) => h.agregar({ ciclo: m.ciclo, metrics: m.metrics });

// ---- Agregación ----------------------------------------------------------------

/**
 * Percentil p ∈ [0, 1] de una lista ORDENADA (interpolación lineal entre
 * rangos, la «tipo 7» de R y NumPy). NaN si está vacía.
 * @param {number[]} ordenados @param {number} p
 */
export function percentil(ordenados, p) {
  const n = ordenados.length;
  if (!n) return Number.NaN;
  if (n === 1) return ordenados[0];
  const h = (n - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(h);
  const hi = Math.min(n - 1, lo + 1);
  return ordenados[lo] + (h - lo) * (ordenados[hi] - ordenados[lo]);
}

/**
 * Media y desvío estándar muestral (n − 1; 0 con un solo valor).
 * @param {number[]} v
 */
export function mediaDesvio(v) {
  const n = v.length;
  if (!n) return { media: Number.NaN, desvio: Number.NaN };
  const media = v.reduce((a, x) => a + x, 0) / n;
  if (n === 1) return { media, desvio: 0 };
  const s2 = v.reduce((a, x) => a + (x - media) ** 2, 0) / (n - 1);
  return { media, desvio: Math.sqrt(s2) };
}

/**
 * @typedef {{t: number[], media: number[], p10: number[], p90: number[],
 *   min: number[], max: number[], n: number[]}} Agregado
 */

/**
 * Agrega N series alineándolas por ciclo exacto: en cada ciclo que tenga
 * alguna, la media, p10, p90, mínimo y máximo de las que lo tienen (n dice
 * cuántas). Los valores no finitos no cuentan.
 * @param {{t: ArrayLike<number>, v: ArrayLike<number>}[]} series
 * @returns {Agregado}
 */
export function agregarSeries(series) {
  /** @type {Map<number, number[]>} */
  const porCiclo = new Map();
  for (const s of series)
    for (let j = 0; j < s.t.length; j++) {
      const v = Number(s.v[j]);
      if (!Number.isFinite(v)) continue;
      let l = porCiclo.get(s.t[j]);
      if (!l) {
        l = [];
        porCiclo.set(s.t[j], l);
      }
      l.push(v);
    }
  /** @type {Agregado} */
  const a = { t: [], media: [], p10: [], p90: [], min: [], max: [], n: [] };
  for (const c of [...porCiclo.keys()].sort((x, y) => x - y)) {
    const l = /** @type {number[]} */ (porCiclo.get(c)).sort((x, y) => x - y);
    a.t.push(c);
    a.media.push(l.reduce((s, x) => s + x, 0) / l.length);
    a.p10.push(percentil(l, 0.1));
    a.p90.push(percentil(l, 0.9));
    a.min.push(l[0]);
    a.max.push(l[l.length - 1]);
    a.n.push(l.length);
  }
  return a;
}

/**
 * @typedef {{ciclo: number, metrics: number[]}} MuestraFinal
 * @typedef {{historia: any, final: MuestraFinal | null,
 *   reinicio?: {ciclo: number, esperado: number}}} ResultadoReplica
 */

/**
 * Resultado de una réplica: su historia serializada, la ÚLTIMA muestra cruda
 * (la historia funde puntos al llenarse y su último punto puede ser la media
 * de varias muestras) y, si la ronda se reinició, dónde.
 * @param {Historia} h @param {MuestraFinal | null} final
 * @param {{ciclo: number, esperado: number} | null} [reinicio]
 * @returns {ResultadoReplica}
 */
export function resultadoReplica(h, final, reinicio) {
  /** @type {ResultadoReplica} */
  const r = { historia: h.serializar(), final };
  if (reinicio) r.reinicio = reinicio;
  return r;
}

/** Copia cruda de una muestra del worker. @param {{ciclo: number, metrics: ArrayLike<number>}} m */
export const muestraFinal = (m) => ({ ciclo: m.ciclo, metrics: Array.from(m.metrics) });

/**
 * Historia de un resultado de réplica: el de resultadoReplica(), una
 * historia serializada sola (trabajos de antes) o una Historia.
 * @param {any} r
 */
export function historiaDe(r) {
  if (r instanceof Historia) return r;
  if (r && typeof r === 'object' && 'historia' in r) return Historia.deserializar(r.historia);
  return Historia.deserializar(r);
}

/**
 * La última muestra cruda de un resultado (null si no la trae: trabajos de
 * antes o una Historia suelta).
 * @param {any} r @returns {MuestraFinal | null}
 */
export const finalDe = (r) =>
  r && typeof r === 'object' && !(r instanceof Historia) && r.final ? r.final : null;

/** Índice de cada métrica global en `metrics`. */
const INDICE_METRICA = new Map(METRICAS.map((m, i) => [m.clave, i]));

/**
 * Serie (ciclo, media) de una métrica global de un resultado.
 * @param {any} r @param {string} clave
 * @returns {{t: number[], v: number[]}}
 */
export function serieDe(r, clave) {
  const s = historiaDe(r).serie(clave);
  return s ? { t: s.t, v: s.media } : { t: [], v: [] };
}

/**
 * Media y banda p10–p90 por ciclo de una métrica global sobre los
 * resultados que haya (null = réplica sin terminar: no cuenta).
 * @param {any[]} resultados @param {string} clave
 * @returns {Agregado}
 */
export function agregarReplicas(resultados, clave) {
  return agregarSeries(resultados.filter((r) => r != null).map((r) => serieDe(r, clave)));
}

/**
 * @typedef {{clave: string, media: number, desvio: number, min: number, max: number,
 *   n: number, ciclo: number}} FilaTabla
 */

/**
 * Valor final de una métrica en un resultado: la última muestra cruda si la
 * trae; si no (trabajos de antes), el último punto de la historia.
 * @param {any} r @param {string} clave
 * @returns {{v: number, ciclo: number} | null}
 */
function valorFinal(r, clave) {
  const f = finalDe(r);
  if (f) {
    const i = INDICE_METRICA.get(clave);
    return i === undefined ? null : { v: Number(f.metrics[i]), ciclo: f.ciclo };
  }
  const s = historiaDe(r).serie(clave);
  if (!s?.t.length) return null;
  return { v: s.media[s.media.length - 1], ciclo: s.t[s.t.length - 1] };
}

/**
 * Tabla de medias y desvíos del valor FINAL de cada métrica clave: la
 * última muestra CRUDA de cada réplica (no el último punto de la historia,
 * que puede ser la media de varias muestras fundidas). `ciclo` es el menor
 * de los ciclos finales (todas llegan al mismo objetivo; distinto solo si
 * alguna no terminó o su ronda se reinició).
 * @param {any[]} resultados @param {readonly string[]} [claves]
 * @returns {FilaTabla[]}
 */
export function tablaReplicas(resultados, claves = METRICAS_CLAVE) {
  const rs = resultados.filter((r) => r != null);
  return claves.map((clave) => {
    /** @type {number[]} */
    const finales = [];
    let ciclo = Number.POSITIVE_INFINITY;
    for (const r of rs) {
      const f = valorFinal(r, clave);
      if (!f || !Number.isFinite(f.v)) continue;
      finales.push(f.v);
      ciclo = Math.min(ciclo, f.ciclo);
    }
    const { media, desvio } = mediaDesvio(finales);
    return {
      clave,
      media,
      desvio,
      min: finales.length ? Math.min(...finales) : Number.NaN,
      max: finales.length ? Math.max(...finales) : Number.NaN,
      n: finales.length,
      ciclo: Number.isFinite(ciclo) ? ciclo : Number.NaN,
    };
  });
}
