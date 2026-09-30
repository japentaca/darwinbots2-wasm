// @ts-check
// «Probar» un ADN (decisión 18; paso N3.3): N copias del bot, solas o con
// algas, X ciclos sin dibujar y a máxima velocidad (la maquinaria de las
// réplicas, decisión 10), con varias semillas. Las reglas son una base de
// engine/opciones.js (BASES): 'f1' (Liga F1, con costos; por defecto) o
// 'clasica' (la de arranque de la clásica: sin costos); la base queda en
// los params (y así en el historial). La semilla se elige: es la primera y
// las demás salen de ella (engine/replicas.js semillasReplicas, C19).
// Mide, por semilla: cuántas de las copias fundadoras siguen vivas, los
// hijos DIRECTOS de las fundadoras (nacidos cuyo padre es una fundadora;
// «hijos por copia» = eso / copias) y el total de nacidos de la especie
// (nietos incluidos), la población y la energía al final y el ciclo de
// extinción. Si hay versión anterior, se corre con LAS MISMAS semillas.
//
// Un trabajo de la cola (engine/cola.js) de tipo 'prueba': una unidad por
// semilla y versión (primero las de la versión probada, después las de la
// anterior). Los params son autocontenidos (el ADN de las dos versiones y el
// del alga) para reanudar tras una recarga, y llevan {clave, hash, lg, adn}
// para que el historial del bot los encuentre (engine/biblioteca.js
// historialBot).
//
// Puro JS, sin DOM: el worker llega como «canal» (replica.js), así corre
// igual en node con el arnés de los tests. Cómo avanza: steps en tandas con
// una barrera {t:'ciclo'}, como replica.js; el muestreo va con `linaje` para
// contar los nacidos entre muestras, y al final un {t:'linaje'} da los vivos.

import { hashAdn, lgHash } from '../../../engine/adn.js';
import { aplicar, normalizar } from '../../../engine/escenarios/index.js';
import { BASES } from '../../../engine/opciones.js';
import { SEMILLA_MAX, semillasReplicas } from '../../../engine/replicas.js';
import { ErrorReplica } from './replica.js';

export const TIPO_PRUEBA = 'prueba';
/** El vegetal de la base clásica (el de la sopa primordial). */
export const ALGA = 'Alga minimalis 3.0';
export const MODOS = Object.freeze(['algas', 'solo']);
/** Bases de la prueba (engine/opciones.js BASES): Liga F1 o sin costos. */
export const BASES_PRUEBA = Object.freeze(['f1', 'clasica']);
/** Especie de la prueba en la sim (el mismo nombre en las dos versiones). */
export const NOMBRE_ESPECIE = 'prueba';
export const LIMITES = Object.freeze({
  copias: Object.freeze([1, 50]),
  ciclos: Object.freeze([10, 200_000]),
  semillas: Object.freeze([1, 16]),
  semilla: Object.freeze([1, SEMILLA_MAX]),
});
export const POR_DEFECTO = Object.freeze({
  copias: 10,
  ciclos: 5000,
  semillas: 3,
  modo: 'algas',
  base: 'f1',
  semilla: 1,
});
const N_LINAJE = 12;

/**
 * @typedef {{adn: string, hash: string, lg: string, version: number | null}} VersionPrueba
 * @typedef {{
 *   clave: string, nombre: string, vegetal: boolean,
 *   adn: string, hash: string, lg: string, version: number | null,
 *   anterior: VersionPrueba | null,
 *   modo: 'algas' | 'solo', base: 'f1' | 'clasica', copias: number, ciclos: number,
 *   cada: number, semillas: number[], alga: string | null,
 * }} ParamsPrueba
 * @typedef {{
 *   version: 'actual' | 'anterior', semilla: number, ciclo: number,
 *   fundadores: number, fundadoresVivos: number, nacidos: number, hijosDirectos: number,
 *   vivos: number, nrg: number, extincion: number | null, serie: [number, number, number][],
 * }} ResultadoPrueba
 */

/** Error de parámetros con código estable (texto: t('editor.probar.error.<codigo>')). */
export class ErrorPrueba extends Error {
  /** @param {string} codigo @param {string} [detalle] */
  constructor(codigo, detalle) {
    super(detalle ? `${codigo}: ${detalle}` : codigo);
    this.codigo = codigo;
  }
}

/** @param {unknown} v @param {readonly number[]} r @param {string} codigo */
function entero(v, r, codigo) {
  const n = Math.trunc(Number(v));
  if (!(n >= r[0] && n <= r[1])) throw new ErrorPrueba(codigo, String(v));
  return n;
}

/**
 * Parámetros de una prueba. Lanza ErrorPrueba: 'adn', 'modo', 'base',
 * 'copias', 'ciclos', 'semillas', 'semilla', 'alga'.
 * @param {{clave: string, nombre: string, vegetal?: boolean, adn: string, version?: number | null,
 *   anterior?: {adn: string, version?: number | null} | null, modo?: string, base?: string,
 *   copias?: number,
 *   ciclos?: number, semillas?: number, semilla?: number, adnAlga?: string | null}} o
 * @returns {ParamsPrueba}
 */
export function crearParamsPrueba(o) {
  if (typeof o.adn !== 'string' || !o.adn.trim()) throw new ErrorPrueba('adn');
  const modo = o.modo ?? POR_DEFECTO.modo;
  if (!MODOS.includes(modo)) throw new ErrorPrueba('modo', modo);
  const base = o.base ?? POR_DEFECTO.base;
  if (!BASES_PRUEBA.includes(base) || !(base in BASES)) throw new ErrorPrueba('base', base);
  const semilla = entero(o.semilla ?? POR_DEFECTO.semilla, LIMITES.semilla, 'semilla');
  const copias = entero(o.copias ?? POR_DEFECTO.copias, LIMITES.copias, 'copias');
  const ciclos = entero(o.ciclos ?? POR_DEFECTO.ciclos, LIMITES.ciclos, 'ciclos');
  const n = entero(o.semillas ?? POR_DEFECTO.semillas, LIMITES.semillas, 'semillas');
  if (modo === 'algas' && (typeof o.adnAlga !== 'string' || !o.adnAlga.trim()))
    throw new ErrorPrueba('alga');
  const ant =
    o.anterior && typeof o.anterior.adn === 'string' && o.anterior.adn.trim() ? o.anterior : null;
  return {
    clave: String(o.clave ?? ''),
    nombre: String(o.nombre ?? ''),
    vegetal: !!o.vegetal,
    adn: o.adn,
    hash: hashAdn(o.adn),
    lg: lgHash(o.adn),
    version: o.version ?? null,
    anterior: ant
      ? { adn: ant.adn, hash: hashAdn(ant.adn), lg: lgHash(ant.adn), version: ant.version ?? null }
      : null,
    modo: /** @type {'algas' | 'solo'} */ (modo),
    base: /** @type {'f1' | 'clasica'} */ (base),
    copias,
    ciclos,
    // unos 100 puntos de población por semilla
    cada: Math.max(1, Math.ceil(ciclos / 100)),
    semillas: semillasReplicas(semilla, n),
    alga: modo === 'algas' ? /** @type {string} */ (o.adnAlga) : null,
  };
}

/** Unidades del trabajo: una por semilla y versión. @param {ParamsPrueba} p */
export const unidadesPrueba = (p) => p.semillas.length * (p.anterior ? 2 : 1);

/**
 * Qué corre la unidad i: la versión y la semilla.
 * @param {ParamsPrueba} p @param {number} i
 * @returns {{version: 'actual' | 'anterior', adn: string, semilla: number}}
 */
export function unidadPrueba(p, i) {
  const k = p.semillas.length;
  if (!(i >= 0 && i < unidadesPrueba(p))) throw new ErrorPrueba('indice', String(i));
  const anterior = i >= k;
  return {
    version: anterior ? 'anterior' : 'actual',
    adn: anterior ? /** @type {VersionPrueba} */ (p.anterior).adn : p.adn,
    semilla: p.semillas[i % k],
  };
}

/**
 * Escenario de la prueba (engine/escenarios): la base de los params (los
 * trabajos de antes de que se pudiera elegir no la traen: 'clasica'), las
 * copias del bot y, en el modo 'algas', 15 algas (como la sopa primordial).
 * @param {ParamsPrueba} p @param {string} adn
 */
export function escenarioPrueba(p, adn) {
  const especies = [];
  if (p.modo === 'algas')
    especies.push({
      bot: ALGA,
      cantidad: 15,
      color: '#30d030',
      vegetal: true,
      adn: /** @type {string} */ (p.alga),
    });
  especies.push({
    bot: NOMBRE_ESPECIE,
    origen: 'propio',
    cantidad: p.copias,
    color: '#ff4040',
    vegetal: p.vegetal,
    adn,
  });
  return normalizar({
    formato: 1,
    id: 'prueba',
    nombre: NOMBRE_ESPECIE,
    opciones: { base: p.base ?? 'clasica' },
    especies,
  });
}

/**
 * Lo que hace falta para LISTAR el trabajo (sin los ADN).
 * @param {ParamsPrueba} p
 */
export function vistaPrueba(p) {
  return {
    clave: p?.clave,
    nombre: p?.nombre,
    hash: p?.hash,
    lg: p?.lg,
    version: p?.version ?? null,
    anterior: p?.anterior
      ? { hash: p.anterior.hash, lg: p.anterior.lg, version: p.anterior.version }
      : null,
    modo: p?.modo,
    base: p?.base ?? 'clasica',
    copias: p?.copias,
    ciclos: p?.ciclos,
    semillas: [...(p?.semillas ?? [])],
  };
}

let secuencia = 0;

/**
 * Corre la unidad i de una prueba en un worker.
 * @param {{canal: import('./replica.js').Canal, params: ParamsPrueba, i: number,
 *   progreso?: (fr: number) => void, senal?: AbortSignal, tanda?: number, enVuelo?: number,
 *   plazoMs?: number}} o
 * @returns {Promise<ResultadoPrueba>}
 */
export async function correrPrueba(o) {
  const { canal, params: p } = o;
  const u = unidadPrueba(p, o.i);
  const tanda = Math.max(1, o.tanda ?? 100);
  const enVuelo = Math.max(1, o.enVuelo ?? 4);
  const plazoMs = o.plazoMs ?? 120_000;
  const req = `prueba${++secuencia}-${o.i}`;
  const especie = `${NOMBRE_ESPECIE}.txt`;
  /** @type {Map<string, {res: (m: any) => void, rej: (e: Error) => void}>} */
  const pedidos = new Map();
  /** @type {Error | null} */
  let fallo = null;
  let nPedido = 0;
  /** @type {Set<number>} AbsNum de las copias fundadoras */
  const fundadores = new Set();
  let nacidos = 0;
  /** @type {Map<number, number>} padre (AbsNum) → nacidos de ese padre */
  const porPadre = new Map();
  /** @type {[number, number, number][]} ciclo, vivos, energía */
  const serie = [];
  let vivos = 0;
  let nrg = 0;
  let ultimoCiclo = -1;
  /** @type {number | null} */
  let extincion = null;

  /** @param {Error} e */
  const fallar = (e) => {
    fallo ??= e;
    for (const pd of pedidos.values()) pd.rej(e);
    pedidos.clear();
  };

  /** @param {any} m */
  const alMuestra = (m) => {
    if (m.ciclo <= ultimoCiclo) return;
    ultimoCiclo = m.ciclo;
    const e = (m.especies ?? []).find((/** @type {any} */ x) => x.nombre === especie);
    vivos = e ? e.stats[1] : 0;
    nrg = e ? e.stats[3] : 0;
    serie.push([m.ciclo, vivos, nrg]);
    if (vivos === 0 && extincion === null) extincion = m.ciclo;
    const l = m.linaje;
    if (!l) return;
    const idx = (l.nombres ?? []).indexOf(especie);
    const f = l.nacidos;
    for (let k = 0; k + N_LINAJE <= f.length; k += N_LINAJE) {
      if (f[k + 2] !== idx) continue;
      if (f[k + 1] === 0) fundadores.add(f[k]);
      else {
        nacidos++;
        porPadre.set(f[k + 1], (porPadre.get(f[k + 1]) ?? 0) + 1);
      }
    }
  };

  const bajas = [
    canal.on((m) => {
      if (!m || typeof m !== 'object') return;
      if (m.t === 'muestra' && m.req === req) alMuestra(m);
      else if (
        (m.t === 'ciclo' || m.t === 'linaje') &&
        typeof m.req === 'string' &&
        pedidos.has(m.req)
      ) {
        const pd = pedidos.get(m.req);
        pedidos.delete(m.req);
        pd?.res(m);
      } else if (m.t === 'error') fallar(new ErrorReplica('carga', String(m.msg ?? m.clave)));
    }),
  ];
  if (canal.alError)
    bajas.push(canal.alError((e) => fallar(new ErrorReplica('worker', String(e?.message ?? e)))));
  const alAbortar = () => fallar(new ErrorReplica('abortada'));
  o.senal?.addEventListener('abort', alAbortar);

  /** @param {'ciclo' | 'linaje'} t @returns {Promise<any>} */
  const pedir = (t) => {
    if (fallo) return Promise.reject(fallo);
    const r = `${req}:${t}${++nPedido}`;
    /** @type {Promise<any>} */
    const pr = new Promise((res, rej) => {
      const plazo = setTimeout(() => {
        pedidos.delete(r);
        rej(new ErrorReplica('tiempo'));
      }, plazoMs);
      pedidos.set(r, {
        res: (m) => {
          clearTimeout(plazo);
          res(m);
        },
        rej: (e) => {
          clearTimeout(plazo);
          rej(e);
        },
      });
      canal.enviar({ t, req: r });
    });
    pr.catch(() => {});
    return pr;
  };

  try {
    if (o.senal?.aborted) throw new ErrorReplica('abortada');
    const esc = escenarioPrueba(p, u.adn);
    for (const m of aplicar(esc, u.semilla)) canal.enviar(m);
    const muestreo = { t: 'muestreo', cada: p.cada, grupos: ['poblacion'], linaje: true, req };
    canal.enviar(muestreo);
    const c0 = (await pedir('ciclo')).cycle;
    const total = Math.max(1, p.ciclos - c0);
    let actual = c0;
    /** @type {{hasta: number, p: Promise<any>}[]} */
    const vuelo = [];
    const confirmar = async () => {
      const v = /** @type {{hasta: number, p: Promise<any>}} */ (vuelo.shift());
      const c = (await v.p).cycle;
      if (c !== v.hasta) throw new ErrorReplica('desfase', `${c} ≠ ${v.hasta}`);
      o.progreso?.((c - c0) / total);
    };
    while (actual < p.ciclos) {
      if (fallo) throw fallo;
      const n = Math.min(tanda, p.ciclos - actual);
      for (let k = 0; k < n; k++) canal.enviar({ t: 'step' });
      actual += n;
      vuelo.push({ hasta: actual, p: pedir('ciclo') });
      if (vuelo.length >= enVuelo) await confirmar();
    }
    while (vuelo.length) await confirmar();
    // la última muestra en el objetivo (el muestreo publica una en el acto)
    if (ultimoCiclo !== p.ciclos) canal.enviar(muestreo);
    const lin = await pedir('linaje');
    if (fallo) throw fallo;
    canal.enviar({ t: 'muestreo', cada: 0 });
    const idx = (lin.nombres ?? []).indexOf(especie);
    let fundadoresVivos = 0;
    const f = lin.filas ?? [];
    for (let k = 0; k + N_LINAJE <= f.length; k += N_LINAJE)
      if (f[k + 2] === idx && (f[k + 7] & 2) === 0 && fundadores.has(f[k])) fundadoresVivos++;
    let hijosDirectos = 0;
    for (const a of fundadores) hijosDirectos += porPadre.get(a) ?? 0;
    o.progreso?.(1);
    return {
      version: u.version,
      semilla: u.semilla,
      ciclo: ultimoCiclo,
      fundadores: fundadores.size,
      fundadoresVivos,
      nacidos,
      hijosDirectos,
      vivos,
      nrg,
      extincion,
      serie,
    };
  } finally {
    o.senal?.removeEventListener('abort', alAbortar);
    for (const b of bajas) b();
    for (const pd of pedidos.values()) pd.rej(new ErrorReplica('abortada'));
    pedidos.clear();
  }
}

/**
 * @typedef {{n: number, copias: number, sobreviven: number, hijosPorCopia: number,
 *   nacidosPorCopia: number, vivos: number, energiaMedia: number, extinciones: number}} ResumenVersion
 */

/**
 * Medias de las semillas de una versión: fundadores vivos, hijos directos
 * por copia (los resultados viejos sin ese dato usan todos los nacidos),
 * nacidos por copia (nietos incluidos), población final, energía media por
 * bot vivo (de las semillas con vivos) y extinciones.
 * @param {ResultadoPrueba[]} rs @param {number} copias
 * @returns {ResumenVersion | null}
 */
export function resumirVersion(rs, copias) {
  if (!rs.length) return null;
  const media = (/** @type {number[]} */ v) =>
    v.length ? v.reduce((a, x) => a + x, 0) / v.length : 0;
  const conVivos = rs.filter((r) => r.vivos > 0);
  return {
    n: rs.length,
    copias,
    sobreviven: media(rs.map((r) => r.fundadoresVivos)),
    hijosPorCopia: media(
      rs.map((r) => (r.hijosDirectos ?? r.nacidos) / Math.max(1, r.fundadores || copias)),
    ),
    nacidosPorCopia: media(rs.map((r) => r.nacidos / Math.max(1, r.fundadores || copias))),
    vivos: media(rs.map((r) => r.vivos)),
    energiaMedia: media(conVivos.map((r) => r.nrg / r.vivos)),
    extinciones: rs.filter((r) => r.vivos === 0).length,
  };
}

/**
 * Resumen del trabajo (al terminar): cada versión y, por semilla, los
 * valores de las dos.
 * @param {ParamsPrueba} p @param {(ResultadoPrueba | null)[]} datos
 */
export function resumenPrueba(p, datos) {
  const ok = /** @type {ResultadoPrueba[]} */ (datos.filter(Boolean));
  const de = (/** @type {'actual' | 'anterior'} */ v) => ok.filter((r) => r.version === v);
  return {
    actual: resumirVersion(de('actual'), p.copias),
    anterior: p.anterior ? resumirVersion(de('anterior'), p.copias) : null,
    version: p.version,
    versionAnterior: p.anterior?.version ?? null,
  };
}

/**
 * Ejecutor de la cola para las pruebas (engine/cola.js), sobre el pool de
 * workers de las réplicas.
 * @param {{pool: import('./pool.js').PoolWorkers, tanda?: number}} d
 * @returns {import('../../../engine/cola.js').Ejecutor}
 */
export function ejecutorPrueba(d) {
  return {
    async unidad(t, i, ctx) {
      const w = await d.pool.tomar(ctx.senal);
      let sano = false;
      try {
        const r = await correrPrueba({
          canal: w.canal,
          params: t.params,
          i,
          progreso: ctx.progreso,
          senal: ctx.senal,
          tanda: d.tanda,
        });
        sano = true;
        return r;
      } finally {
        if (sano) d.pool.soltar(w);
        else d.pool.descartar(w);
      }
    },
    final(t, datos) {
      return resumenPrueba(t.params, datos);
    },
    vista: vistaPrueba,
  };
}
