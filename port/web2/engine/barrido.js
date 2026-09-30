// @ts-check
// Barrido de parámetros (decisión 10 de port/web2/PLAN.md, Nivel 4), sin DOM:
// la parte pura.
//
// Un barrido corre el escenario de una corrida con UN parámetro del
// catálogo (engine/opciones.js: opt, cost o base) en k valores, cada uno con
// N semillas (semillasReplicas: la primera es la de la corrida y ninguna
// repite un mundo del motor, C19), hasta un ciclo objetivo. Cada unidad de
// la cola (engine/cola.js) es un valor × una semilla y se corre IGUAL que
// una réplica (src/lib/trabajos/replica.js) con el escenario modificado:
// paramsUnidad(p, i) arma los parámetros de réplica de esa unidad. Por C15
// una unidad interrumpida se reinicia desde cero en cualquier worker y da
// lo mismo.
//
// Los valores (grilla): de `desde` a `hasta` en `pasos` valores (lineal) o
// una lista. Cada uno pasa por normalizarValor (C23: el límite duro es el
// tipo con que el core lo guarda; los opt que el core satura se llevan al
// tope y se avisa; fuera del rango sugerido, solo un aviso). En la grilla
// lineal los pasos de un entero se redondean al entero más cercano; en la
// lista no se redondea nada: un valor no entero de un parámetro entero es
// error. Los valores que quedan iguales (tras redondear o saturar) se
// juntan (aviso 'repetido') y quedan en orden creciente. En la grilla
// lineal, un bool da apagado y encendido, y un enum todos sus valores entre
// `desde` y `hasta` (los pasos no cuentan).
//
// Cambios en caliente de la corrida de origen: se repiten en su ciclo
// (como en las réplicas). Los que escriben el parámetro barrido (o uno
// acoplado con él, efectosDe: barrer 97 escribe también 101; opt:1 escribe
// 2 y 3) se REESCRIBEN para cada valor con fusionarCambios: conservan sus
// efectos sobre los demás parámetros y el barrido pisa solo lo suyo
// (eventosCon). Los parámetros del trabajo guardan los eventos originales;
// la reescritura se hace por unidad (paramsUnidad).
//
// Orden de las unidades: semilla por semilla (la unidad i es el valor
// i mod k de la semilla ⌊i / k⌋), así la primera pasada ya da la curva
// entera con una semilla y el resultado parcial sirve antes.
//
// Resultado (agregarBarrido): por valor, media, desvío, p10–p90, mínimo y
// máximo del valor FINAL de cada métrica (la última muestra cruda de cada
// unidad, como la tabla de réplicas) y, aparte (seriesBarrido), la serie
// media por ciclo de cada valor. CSV del resumen y por unidad.
//
// Unidades con la ronda reiniciada (resultado.reinicio: modo de reinicio o
// ronda nueva de F1; su última muestra es de antes del reinicio, en otro
// ciclo que las demás): NO entran en la agregación ni en las series; cada
// fila cuenta aparte cuántas tuvo (`reiniciadas`) y reiniciosBarrido las
// lista. El CSV por unidad las incluye con el ciclo del reinicio.
//
// LectorBarrido: caché de resultados por índice para la pantalla (lee del
// almacén solo las unidades nuevas y extrae cada serie una sola vez).

import { resolverOpciones } from './escenarios/index.js';
import { campoCsv, limpio } from './export.js';
import { METRICAS } from './metricas.js';
import {
  efectosDe,
  fueraDeLoUsual,
  fusionarCambios,
  normalizarValor,
  parametro,
  valorEfectivo,
} from './opciones.js';
import {
  agregarSeries,
  finalDe,
  grupoDe,
  historiaDe,
  MAX_CICLOS,
  MAX_REPLICAS,
  METRICAS_CLAVE,
  mediaDesvio,
  percentil,
  semillasReplicas,
  serieDe,
} from './replicas.js';

export const TIPO_BARRIDO = 'barrido';
export const MIN_VALORES = 2;
export const MAX_VALORES = 32;
export const MAX_SEMILLAS = MAX_REPLICAS;
/** Tope de unidades (valores × semillas) de un barrido. */
export const MAX_UNIDADES = 512;
/** Ciclos entre muestras por defecto (como las réplicas). */
export const CADA_BARRIDO = 100;
/** Puntos por serie de una unidad: menos que una réplica (hay muchas más). */
export const MAX_PUNTOS_BARRIDO = 200;

/** Error de parámetros con código estable (texto: t('comparar.error.<codigo>')). */
export class ErrorBarrido extends Error {
  /** @param {string} codigo @param {string} [detalle] */
  constructor(codigo, detalle) {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.codigo = codigo;
  }
}

/**
 * @typedef {import('./opciones.js').Parametro} Parametro
 * @typedef {import('./escenarios/index.js').Escenario} Escenario
 * @typedef {import('./corridas.js').EventoCorrida} EventoCorrida
 * @typedef {{modo: 'lineal', desde: number, hasta: number, pasos: number}
 *   | {modo: 'lista', valores: number[]}} EspecGrilla
 * @typedef {{valor: number, codigo: 'valor-saturado' | 'fuera-de-lo-usual' | 'repetido', pedido?: number}} AvisoGrilla
 * @typedef {{
 *   escenario: Escenario,
 *   adn: string[],
 *   clave: string,
 *   valores: number[],
 *   semillas: number[],
 *   eventos: EventoCorrida[],
 *   ciclos: number,
 *   cada: number,
 *   maxPuntos: number,
 *   metricas: string[],
 *   origen: {nombre: string, id?: string | null},
 * }} ParamsBarrido
 */

/** Parámetro barrible (lanza ErrorBarrido). @param {string} clave @returns {Parametro} */
export function parametroBarrible(clave) {
  const p = parametro(clave);
  if (!p) throw new ErrorBarrido('barrido-parametro', String(clave));
  if (p.derivado) throw new ErrorBarrido('barrido-derivado', clave);
  return p;
}

/** Sin ruido de coma flotante (0.30000000000000004 → 0.3). @param {number} v */
const sinRuido = (v) => (v === 0 ? 0 : Number(v.toPrecision(12)));

/**
 * Valores pedidos (todavía sin validar) de una especificación.
 * @param {Parametro} p @param {EspecGrilla} e
 * @returns {number[]}
 */
function pedidos(p, e) {
  if (e?.modo === 'lista') {
    if (!Array.isArray(e.valores) || !e.valores.length)
      throw new ErrorBarrido('barrido-valores', '0');
    return e.valores.map(Number);
  }
  if (e?.modo !== 'lineal')
    throw new ErrorBarrido('barrido-modo', String(/** @type {any} */ (e)?.modo));
  const a = Number(e.desde);
  const b = Number(e.hasta);
  if (!Number.isFinite(a) || !Number.isFinite(b))
    throw new ErrorBarrido('barrido-valor', `${e.desde} … ${e.hasta}`);
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (p.valor === 'bool') return [0, p.on ?? 1];
  if (p.valor === 'enum')
    return (p.valores ?? []).map((x) => x.v).filter((v) => v >= lo && v <= hi);
  const k = Math.trunc(Number(e.pasos));
  if (!(k >= MIN_VALORES && k <= MAX_VALORES))
    throw new ErrorBarrido('barrido-pasos', String(e.pasos));
  const out = [];
  for (let j = 0; j < k; j++) out.push(sinRuido(a + ((b - a) * j) / (k - 1)));
  return p.valor === 'int' ? out.map((v) => Math.round(v)) : out;
}

/**
 * Los valores de un barrido del parámetro `clave`: validados con
 * normalizarValor (C23), sin repetir y en orden creciente, con sus avisos.
 * Lanza ErrorBarrido: 'barrido-parametro', 'barrido-derivado',
 * 'barrido-modo', 'barrido-pasos', 'barrido-valor' (detalle: el valor y el
 * código de normalizarValor), 'barrido-valores' (menos de 2 o más de
 * MAX_VALORES distintos).
 * @param {string} clave @param {EspecGrilla} espec
 * @returns {{valores: number[], avisos: AvisoGrilla[]}}
 */
export function grilla(clave, espec) {
  const p = parametroBarrible(clave);
  /** @type {AvisoGrilla[]} */
  const avisos = [];
  const vistos = new Set();
  const saturados = new Set();
  for (const pedido of pedidos(p, espec)) {
    const r = normalizarValor(p, pedido);
    if (!r.ok) throw new ErrorBarrido('barrido-valor', `${pedido} (${r.codigo})`);
    const v = r.v === 0 ? 0 : r.v; // sin -0 (Math.round(-0.4))
    if (r.aviso === 'valor-saturado' && !saturados.has(v)) {
      saturados.add(v);
      avisos.push({ valor: v, codigo: 'valor-saturado', pedido });
    }
    if (vistos.has(v)) {
      avisos.push({ valor: v, codigo: 'repetido', pedido });
      continue;
    }
    vistos.add(v);
    if (fueraDeLoUsual(p, v)) avisos.push({ valor: v, codigo: 'fuera-de-lo-usual' });
  }
  const valores = [...vistos].sort((x, y) => x - y);
  if (valores.length < MIN_VALORES || valores.length > MAX_VALORES)
    throw new ErrorBarrido('barrido-valores', String(valores.length));
  return { valores, avisos };
}

/**
 * Lista de valores tecleada («1; 2,5; 10» o «1 2.5 10»): separadores `;`,
 * espacios o comas seguidas de espacio; la coma sin espacio es decimal. null
 * si algún elemento no es un número.
 * @param {string} texto
 * @returns {number[] | null}
 */
export function listaDeTexto(texto) {
  const partes = String(texto ?? '')
    .split(/;|\s+|,\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (const s of partes) {
    const n = Number(s.replace(',', '.'));
    if (!Number.isFinite(n)) return null;
    out.push(n);
  }
  return out;
}

/**
 * El escenario con el parámetro en `v` (fusionarCambios: respeta las
 * acopladas). No modifica el original.
 * @param {Escenario} e @param {string} clave @param {number} v
 * @returns {Escenario}
 */
export function escenarioCon(e, clave, v) {
  const x = structuredClone(e);
  x.opciones.cambios = fusionarCambios(x.opciones.cambios ?? {}, { [clave]: v });
  return x;
}

/**
 * Parámetros que escribe barrer `clave` (él y sus acoplados: 97 → 97 y
 * 101). @param {string} clave @returns {string[]}
 */
export const escritasPor = (clave) => Object.keys(efectosDe(clave, 1));

/**
 * ¿El evento escribe el parámetro barrido (o uno que el barrido escribe)?
 * @param {EventoCorrida} ev @param {string} clave
 */
export function eventoToca(ev, clave) {
  if (ev?.tipo !== 'opciones') return false;
  const tocadas = new Set(escritasPor(clave));
  return Object.entries(ev.cambios ?? {}).some(([k, v]) =>
    Object.keys(efectosDe(k, v)).some((x) => tocadas.has(x)),
  );
}

/**
 * Los eventos de la corrida para el valor `v` del barrido: los de opciones
 * que escriben el parámetro barrido (eventoToca) se reescriben con
 * fusionarCambios(cambios, {clave: v}), así conservan sus efectos sobre los
 * demás parámetros (un opt:1 se reparte antes en 2 y 3) y el barrido pisa
 * solo lo suyo. Los demás (y siembras y objetos) quedan igual. No modifica
 * los originales.
 * @param {EventoCorrida[]} eventos @param {string} clave @param {number} v
 * @returns {EventoCorrida[]}
 */
export function eventosCon(eventos, clave, v) {
  return (eventos ?? []).map((ev) => {
    const x = structuredClone(ev);
    if (x.tipo === 'opciones' && eventoToca(x, clave))
      x.cambios = fusionarCambios(fusionarCambios({}, x.cambios), { [clave]: v });
    return x;
  });
}

/**
 * Cuántos cambios en caliente (eventos de opciones) reescribe el barrido de
 * `clave`. @param {EventoCorrida[]} eventos @param {string} clave
 */
export const reescritosBarrido = (eventos, clave) =>
  (eventos ?? []).filter((ev) => eventoToca(ev, clave)).length;

/**
 * Valor efectivo de `clave` en la corrida de origen al arrancar (su
 * escenario) y al final (tras sus cambios en caliente). NaN si no se puede.
 * @param {Escenario | null | undefined} e @param {EventoCorrida[]} eventos @param {string} clave
 * @returns {{inicio: number, fin: number}}
 */
export function valoresOrigen(e, eventos, clave) {
  if (!e?.opciones) return { inicio: Number.NaN, fin: Number.NaN };
  try {
    const inicio = valorEfectivo(resolverOpciones(e), clave);
    let cambios = e.opciones.cambios ?? {};
    for (const ev of eventos ?? [])
      if (ev.tipo === 'opciones') cambios = fusionarCambios(cambios, ev.cambios ?? {});
    const fin = valorEfectivo(
      resolverOpciones({ ...e, opciones: { ...e.opciones, cambios } }),
      clave,
    );
    return { inicio, fin };
  } catch {
    return { inicio: Number.NaN, fin: Number.NaN };
  }
}

/**
 * Parámetros de un trabajo de barrido (lo que guarda la cola:
 * autocontenido, con el ADN). `adn[i]` es el de `escenario.especies[i]`.
 * Lanza ErrorBarrido: los de grilla() y 'sin-escenario', 'n', 'ciclos',
 * 'cada', 'sin-adn', 'metrica', 'semilla', 'barrido-unidades'.
 * @param {{escenario: Escenario | null | undefined, adn: (string | undefined)[],
 *   semilla: number, n: number, ciclos: number, clave: string, grilla: EspecGrilla,
 *   eventos?: EventoCorrida[], cada?: number, maxPuntos?: number, metricas?: string[],
 *   origen?: {nombre: string, id?: string | null}}} o
 * @returns {ParamsBarrido}
 */
export function crearParametrosBarrido(o) {
  if (!o.escenario) throw new ErrorBarrido('sin-escenario');
  const { valores } = grilla(o.clave, o.grilla);
  const n = Math.trunc(o.n);
  if (!(n >= 1 && n <= MAX_SEMILLAS)) throw new ErrorBarrido('n', String(o.n));
  if (valores.length * n > MAX_UNIDADES)
    throw new ErrorBarrido('barrido-unidades', String(valores.length * n));
  const ciclos = Math.trunc(o.ciclos);
  if (!(ciclos >= 1 && ciclos <= MAX_CICLOS)) throw new ErrorBarrido('ciclos', String(o.ciclos));
  const cada = Math.trunc(o.cada ?? Math.min(CADA_BARRIDO, ciclos));
  if (!(cada >= 1 && cada <= ciclos)) throw new ErrorBarrido('cada', String(o.cada));
  const metricas = [...new Set(o.metricas?.length ? o.metricas : METRICAS_CLAVE)];
  for (const m of metricas) if (!grupoDe(m)) throw new ErrorBarrido('metrica', m);
  if (typeof o.semilla !== 'number' || !Number.isFinite(o.semilla))
    throw new ErrorBarrido('semilla', String(o.semilla));
  const adn = o.escenario.especies.map((s, i) => {
    const d = s.adn ?? o.adn[i];
    if (typeof d !== 'string' || !d.trim()) throw new ErrorBarrido('sin-adn', s.bot);
    return d;
  });
  return {
    escenario: structuredClone(o.escenario),
    adn,
    clave: o.clave,
    valores,
    semillas: semillasReplicas(o.semilla, n),
    // los originales: paramsUnidad los reescribe para cada valor (eventosCon)
    eventos: structuredClone(o.eventos ?? []),
    ciclos,
    cada,
    maxPuntos: Math.max(8, Math.trunc(o.maxPuntos ?? MAX_PUNTOS_BARRIDO)),
    metricas,
    origen: { nombre: o.origen?.nombre ?? '', id: o.origen?.id ?? null },
  };
}

/** Unidades del trabajo (valores × semillas). @param {Pick<ParamsBarrido, 'valores' | 'semillas'>} p */
export const unidadesBarrido = (p) => p.valores.length * p.semillas.length;

/**
 * Qué valor y qué semilla corre la unidad i (semilla por semilla).
 * @param {Pick<ParamsBarrido, 'valores' | 'semillas'>} p @param {number} i
 * @returns {{v: number, s: number}} índices en `valores` y `semillas`
 */
export function indiceUnidad(p, i) {
  const k = p.valores.length;
  const s = Math.floor(i / k);
  if (!(i >= 0 && Number.isInteger(i) && s < p.semillas.length))
    throw new ErrorBarrido('indice', String(i));
  return { v: i % k, s };
}

/** Unidad de un par (valor, semilla). @param {Pick<ParamsBarrido, 'valores'>} p @param {number} v @param {number} s */
export const unidadDe = (p, v, s) => s * p.valores.length + v;

/**
 * Parámetros de réplica (engine/replicas.js) de la unidad i: el escenario
 * con el valor del barrido y una sola semilla (la réplica 0 de esos
 * parámetros). Los corre correrReplica igual que una réplica.
 * @param {ParamsBarrido} p @param {number} i
 * @returns {import('./replicas.js').ParamsReplicas}
 */
export function paramsUnidad(p, i) {
  const { v, s } = indiceUnidad(p, i);
  return {
    escenario: escenarioCon(p.escenario, p.clave, p.valores[v]),
    adn: p.adn,
    semillas: [p.semillas[s]],
    eventos: eventosCon(p.eventos, p.clave, p.valores[v]),
    ciclos: p.ciclos,
    cada: p.cada,
    maxPuntos: p.maxPuntos,
    metrica: p.metricas[0],
    origen: p.origen,
  };
}

/**
 * Lo que hace falta para LISTAR un trabajo de barrido (sin ADN, escenario
 * ni eventos).
 * @param {ParamsBarrido} p
 */
export function vistaBarrido(p) {
  return {
    clave: p?.clave,
    valores: [...(p?.valores ?? [])],
    semillas: [...(p?.semillas ?? [])],
    ciclos: p?.ciclos,
    cada: p?.cada,
    metricas: [...(p?.metricas ?? [])],
    metrica: p?.metricas?.[0],
    origen: p?.origen ? { ...p.origen } : { nombre: '' },
  };
}

// ---- Agregación ------------------------------------------------------------

const INDICE_METRICA = new Map(METRICAS.map((m, i) => [m.clave, i]));

/**
 * Valor final de una métrica en el resultado de una unidad: la última
 * muestra cruda o, si no la trae, el último punto de la historia.
 * @param {any} r @param {string} clave
 * @returns {number}
 */
export function valorFinal(r, clave) {
  if (r == null) return Number.NaN;
  const f = finalDe(r);
  if (f) {
    const i = INDICE_METRICA.get(clave);
    return i === undefined ? Number.NaN : Number(f.metrics[i]);
  }
  const s = historiaDe(r).serie(clave);
  return s?.t.length ? s.media[s.media.length - 1] : Number.NaN;
}

/**
 * @typedef {{media: number, desvio: number, p10: number, p90: number, min: number,
 *   max: number, n: number}} Estadistica
 * @typedef {{valor: number, n: number, reiniciadas: number,
 *   metricas: Record<string, Estadistica>}} FilaBarrido
 */

/** @param {number[]} l */
function estadistica(l) {
  const o = [...l].sort((a, b) => a - b);
  const { media, desvio } = mediaDesvio(o);
  return {
    media,
    desvio,
    p10: percentil(o, 0.1),
    p90: percentil(o, 0.9),
    min: o.length ? o[0] : Number.NaN,
    max: o.length ? o[o.length - 1] : Number.NaN,
    n: o.length,
  };
}

/** ¿La unidad reinició la ronda? @param {any} r */
export const reiniciada = (r) => r != null && typeof r === 'object' && !!r.reinicio;

/**
 * Índices de las unidades terminadas SIN reinicio del valor v y cuántas se
 * reiniciaron. @param {Pick<ParamsBarrido, 'valores' | 'semillas'>} p
 * @param {any[]} resultados @param {number} v
 */
function unidadesValor(p, resultados, v) {
  /** @type {number[]} */
  const ok = [];
  let reiniciadas = 0;
  for (let s = 0; s < p.semillas.length; s++) {
    const i = unidadDe(p, v, s);
    const r = resultados?.[i];
    if (r == null) continue;
    if (reiniciada(r)) reiniciadas++;
    else ok.push(i);
  }
  return { ok, reiniciadas };
}

/**
 * Por valor del parámetro: media, desvío, p10, p90, mínimo y máximo del
 * valor final de cada métrica sobre las semillas que terminaron sin
 * reiniciar la ronda (`resultados[i]` = el de la unidad i; null = sin
 * terminar). `n` de la fila = unidades que cuentan; `reiniciadas` = las
 * terminadas con la ronda reiniciada, que no cuentan.
 * @param {Pick<ParamsBarrido, 'valores' | 'semillas' | 'metricas'>} p @param {any[]} resultados
 * @param {readonly string[]} [claves]
 * @returns {FilaBarrido[]}
 */
export function agregarBarrido(p, resultados, claves = p.metricas) {
  return p.valores.map((valor, v) => {
    const { ok, reiniciadas } = unidadesValor(p, resultados, v);
    /** @type {Record<string, Estadistica>} */
    const metricas = {};
    for (const c of claves)
      metricas[c] = estadistica(
        ok.map((i) => valorFinal(resultados[i], c)).filter(Number.isFinite),
      );
    return { valor, n: ok.length, reiniciadas, metricas };
  });
}

/**
 * Las unidades terminadas con la ronda reiniciada: índices del valor y de
 * la semilla, la unidad y el ciclo del reinicio.
 * @param {Pick<ParamsBarrido, 'valores' | 'semillas'>} p @param {any[]} resultados
 * @returns {{v: number, s: number, i: number, ciclo: number}[]}
 */
export function reiniciosBarrido(p, resultados) {
  const out = [];
  for (let s = 0; s < p.semillas.length; s++)
    for (let v = 0; v < p.valores.length; v++) {
      const i = unidadDe(p, v, s);
      const r = resultados?.[i];
      if (reiniciada(r)) out.push({ v, s, i, ciclo: Number(r.reinicio.ciclo) });
    }
  return out;
}

/**
 * La serie de una métrica por valor: media, p10 y p90 por ciclo sobre las
 * semillas terminadas sin reinicio de cada valor (agregarSeries de
 * engine/replicas.js). `serie(i)` extrae la serie de la unidad i (por
 * defecto serieDe del resultado; LectorBarrido la da de su caché).
 * @param {Pick<ParamsBarrido, 'valores' | 'semillas'>} p @param {any[]} resultados
 * @param {string} clave
 * @param {(i: number) => {t: number[], v: number[]}} [serie]
 * @returns {{valor: number, agregado: import('./replicas.js').Agregado}[]}
 */
export function seriesBarrido(p, resultados, clave, serie) {
  const de = serie ?? ((/** @type {number} */ i) => serieDe(resultados[i], clave));
  return p.valores.map((valor, v) => ({
    valor,
    agregado: agregarSeries(unidadesValor(p, resultados, v).ok.map(de)),
  }));
}

/**
 * CSV del resumen: una fila por valor × métrica
 * (parametro,valor,metrica,n,media,desvio,p10,p90,min,max,reiniciadas).
 * @param {ParamsBarrido} p @param {any[]} resultados @param {readonly string[]} [claves]
 */
export function csvBarrido(p, resultados, claves = p.metricas) {
  const out = [
    [
      'parametro',
      'valor',
      'metrica',
      'n',
      'media',
      'desvio',
      'p10',
      'p90',
      'min',
      'max',
      'reiniciadas',
    ],
  ];
  for (const f of agregarBarrido(p, resultados, claves))
    for (const c of claves) {
      const e = f.metricas[c];
      out.push([
        p.clave,
        f.valor,
        c,
        e.n,
        ...[e.media, e.desvio, e.p10, e.p90, e.min, e.max].map((x) => limpio(x)),
        f.reiniciadas,
      ]);
    }
  return `${out.map((l) => l.map(campoCsv).join(',')).join('\n')}\n`;
}

/**
 * CSV por unidad: una fila por valor × semilla terminada, con el ciclo final
 * y el valor final de cada métrica; `reinicio` = ciclo en que la ronda se
 * reinició (vacío si no), esas no entran en el resumen
 * (parametro,valor,semilla,ciclo,<métricas>,reinicio).
 * @param {ParamsBarrido} p @param {any[]} resultados @param {readonly string[]} [claves]
 */
export function csvBarridoUnidades(p, resultados, claves = p.metricas) {
  const out = [['parametro', 'valor', 'semilla', 'ciclo', ...claves, 'reinicio']];
  for (let s = 0; s < p.semillas.length; s++)
    for (let v = 0; v < p.valores.length; v++) {
      const r = resultados?.[unidadDe(p, v, s)];
      if (r == null) continue;
      const ciclo = finalDe(r)?.ciclo ?? historiaDe(r).ultimoCiclo;
      out.push([
        p.clave,
        p.valores[v],
        p.semillas[s],
        ciclo,
        ...claves.map((c) => limpio(valorFinal(r, c))),
        reiniciada(r) ? r.reinicio.ciclo : '',
      ]);
    }
  return `${out.map((l) => l.map(campoCsv).join(',')).join('\n')}\n`;
}

// ---- Caché de la pantalla ----------------------------------------------------

/**
 * Resultados de un trabajo de barrido leídos de a una unidad: `actualizar`
 * lee del almacén solo las unidades que pasaron a 'hecha' desde la última
 * vez (los resultados escritos no cambian) y suelta las que dejaron de
 * estarlo (reintento). `serie(i, clave)` extrae la serie de una métrica de
 * la unidad i una sola vez (deserializar la historia es lo caro).
 */
export class LectorBarrido {
  /** @type {(i: number) => Promise<any>} */
  #leer;
  /** @type {any[]} */
  #datos = [];
  /** @type {Map<string, {t: number[], v: number[]}>} */
  #series = new Map();
  /** Unidades con una lectura en curso. */
  #leyendo = new Set();
  /** Lecturas pedidas (para medir). */
  leidas = 0;

  /** @param {(i: number) => Promise<any>} leer resultado de la unidad i (null si no hay) */
  constructor(leer) {
    this.#leer = leer;
  }

  /** Los resultados por unidad (null = sin leer o sin terminar). Copia. */
  get resultados() {
    return [...this.#datos];
  }

  /**
   * Pone al día la caché con el estado de las unidades. Devuelve true si
   * cambió algo.
   * @param {{estado: string}[]} unidades
   * @returns {Promise<boolean>}
   */
  async actualizar(unidades) {
    let cambio = false;
    if (this.#datos.length !== unidades.length) {
      this.#datos = Array.from({ length: unidades.length }, (_, i) => this.#datos[i] ?? null);
      cambio = true;
    }
    /** @type {number[]} */
    const nuevas = [];
    unidades.forEach((u, i) => {
      if (u.estado === 'hecha') {
        if (this.#datos[i] == null && !this.#leyendo.has(i)) nuevas.push(i);
      } else if (this.#datos[i] != null) {
        this.#datos[i] = null;
        this.#soltar(i);
        cambio = true;
      }
    });
    for (const i of nuevas) this.#leyendo.add(i);
    this.leidas += nuevas.length;
    const leidos = await Promise.all(nuevas.map((i) => this.#leer(i).catch(() => null)));
    nuevas.forEach((i, k) => {
      this.#leyendo.delete(i);
      if (leidos[k] != null && i < this.#datos.length) {
        this.#datos[i] = leidos[k];
        this.#soltar(i);
        cambio = true;
      }
    });
    return cambio;
  }

  /** @param {number} i */
  #soltar(i) {
    for (const k of [...this.#series.keys()]) if (k.startsWith(`${i}|`)) this.#series.delete(k);
  }

  /**
   * Serie (ciclo, media) de una métrica de la unidad i, extraída una vez.
   * @param {number} i @param {string} clave
   */
  serie(i, clave) {
    const k = `${i}|${clave}`;
    let s = this.#series.get(k);
    if (!s) {
      if (this.#datos[i] == null) return { t: [], v: [] };
      s = serieDe(this.#datos[i], clave);
      this.#series.set(k, s);
    }
    return s;
  }
}

// ---- Colores -----------------------------------------------------------------

/** Extremos de la rampa secuencial (valores ordenados: claro = bajo, oscuro = alto). */
const RAMPA = /** @type {const} */ ([
  [0x8f, 0xc9, 0xbf],
  [0x08, 0x33, 0x2f],
]);

/**
 * Color del valor i de n en la rampa secuencial (el del medio de la
 * rampa si hay uno solo).
 * @param {number} i @param {number} n
 */
export function colorValor(i, n) {
  const f = n > 1 ? Math.min(1, Math.max(0, i / (n - 1))) : 0.5;
  const c = RAMPA[0].map((a, k) => Math.round(a + (RAMPA[1][k] - a) * f));
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
