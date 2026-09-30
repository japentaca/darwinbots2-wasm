// @ts-check
// Asistente «Nuevo torneo» (decisión 22, paso N3.5), puro: el estado de los
// 3 pasos (formato, participantes, reglas), las validaciones de cada paso,
// el esquema visual de cada formato, las reglas del mundo (decisión 21: un
// escenario sin especies) y el sorteo de N bots de un pool de la
// Biblioteca. La pantalla (Asistente.svelte) solo muestra esto y, al
// crear, llama a crearTorneo (torneos.svelte.js).
//
// Errores y avisos son {clave, params} de competir.json.

import { escenarioFabrica } from '../../../engine/escenarios/fabrica.js';
import {
  LG_CUP_SIZES,
  LG_DRAW_MAX,
  LG_FMT_DEFAULT,
  LG_FMT_FIELDS,
  LG_MAX_FIGHTERS,
  LG_RR_WARN,
  lgPool,
  lgShuffle,
  lgSwissRounds,
} from '../../../engine/league.js';
import { costosNinguno } from '../../../engine/opciones.js';
import { reglasDeEscenario } from '../../../engine/rondas.js';

/**
 * @typedef {'fixed' | 'random' | 'fight'} ModoEntrantes
 * @typedef {{tipo: 'f1' | 'sincostos' | 'escenario', escenario?: any}} SeleccionReglas
 * @typedef {{
 *   paso: 1 | 2 | 3,
 *   nombre: string,
 *   fmt: Record<string, any>,
 *   modo: ModoEntrantes,
 *   claves: string[],
 *   pool: string,
 *   n: number,
 *   reglas: SeleccionReglas,
 * }} Asistente
 * @typedef {{clave: string, params?: Record<string, string | number>}} Mensaje
 */

/** Campos del formato que se editan en el paso 1 (según el formato). */
export const CAMPOS_FORMATO = Object.freeze({
  single: [],
  koth: ['k', 'kothEnd', 'retire', 'noRepeat'],
  rr: ['legs'],
  ladder: [],
  cup: ['groupLegs', 'pots', 'third'],
  swiss: ['swissRounds'],
});

/** Valores del partido (paso 3). */
export const CAMPOS_PARTIDO = Object.freeze([
  'qty',
  'nrg',
  'rounds',
  'wins',
  'cap',
  'capMode',
  'popCap',
]);

/** Id del escenario de las reglas «sin costos» (el Partido F1 con todos los costos en 0). */
export const ID_SIN_COSTOS = 'partido-sin-costos';
/** Id del escenario de fábrica de las reglas F1. */
export const ID_F1 = 'partido-f1';

/**
 * Asistente nuevo. Por defecto: el suizo (el del boceto), sin participantes,
 * con las reglas F1.
 * @param {string} [formato]
 * @returns {Asistente}
 */
export function nuevoAsistente(formato = 'swiss') {
  return {
    paso: 1,
    nombre: '',
    fmt: { ...LG_FMT_DEFAULT, format: formato },
    modo: 'fixed',
    claves: [],
    pool: 'all',
    n: 8,
    reglas: { tipo: 'f1' },
  };
}

/**
 * Cambia el formato (y deja los valores del resto como estaban).
 * @param {Asistente} a @param {string} formato @returns {Asistente}
 */
export const conFormato = (a, formato) => ({ ...a, fmt: { ...a.fmt, format: formato } });

/**
 * Rango de un campo numérico del formato (LG_FMT_FIELDS; máx 0 = sin tope).
 * @param {string} k @param {Record<string, any>} f
 * @returns {[number, number] | null}
 */
export function rangoCampo(k, f) {
  const kind = /** @type {any} */ (LG_FMT_FIELDS)[k];
  if (!kind || typeof kind === 'string') return null;
  const r = typeof kind === 'function' ? kind(f) : kind;
  return [r[0] || 0, r[1] || 1e7];
}

/**
 * Pone un valor del formato como lo acota lgFmtSet (enteros en su rango,
 * selects como texto, checks como booleanos) y limpia la colina.
 * @param {Record<string, any>} f @param {string} k @param {any} v
 */
export function fmtCon(f, k, v) {
  const kind = /** @type {any} */ (LG_FMT_FIELDS)[k];
  const out = { ...f };
  if (!kind) return out;
  if (kind === 'check') out[k] = !!v;
  else if (kind === 'select') out[k] = String(v);
  else {
    const [lo, hi] = /** @type {[number, number]} */ (rangoCampo(k, out));
    const n = parseInt(v, 10);
    out[k] = Math.min(
      hi,
      Math.max(lo, Number.isNaN(n) ? /** @type {any} */ (LG_FMT_DEFAULT)[k] : n),
    );
  }
  if (out.kothEnd !== 'never') out.kothEnd = 'retire';
  if (out.kothEnd !== 'never' && !(out.retire >= 1)) out.retire = 1;
  return out;
}

/**
 * Esquema visual de un formato (símbolos, sin idioma): una o dos líneas.
 * n = participantes (las rondas del suizo, los grupos de la copa);
 * tercero = rótulo del partido por el tercer puesto (ya traducido).
 * @param {Record<string, any>} f @param {number} [n] @param {string} [tercero]
 */
export function esquemaFormato(f, n = 0, tercero = '🥉') {
  switch (f.format) {
    case 'single':
      return ['●●●●● → 🏆'];
    case 'koth':
      return [
        `♔ ← ${Array.from({ length: Math.max(1, Math.min(4, (f.k || 2) - 1)) }, (_, i) => 'ABCD'[i]).join(' + ')}`,
        f.kothEnd === 'never'
          ? f.retire > 0
            ? `∞ · ${f.retire}✓ → 👑`
            : '∞'
          : `${f.retire}✓ → 🏆${f.noRepeat ? ' · ⊘' : ''}`,
      ];
    case 'rr':
      return [`A–B A–C B–C …${f.legs === 2 ? ' ×2' : ''}`];
    case 'ladder':
      return ['▁▂▃▅▇ ← A'];
    case 'cup': {
      const g = n >= 8 && LG_CUP_SIZES.includes(n) ? n / 4 : 4;
      const grupos = Array.from(
        { length: Math.min(g, 8) },
        (_, i) => `[${String.fromCharCode(65 + i)}]`,
      ).join('');
      return [
        `${grupos}${f.groupLegs === 2 ? '×2' : ''}`,
        `⊢⊣ → 🏆${f.third ? ` · ${tercero}` : ''}`,
      ];
    }
    case 'swiss': {
      const r = lgSwissRounds(f, Math.max(2, n || 16));
      return [
        Array.from({ length: Math.min(r, 8) }, (_, i) => `R${i + 1}`).join(' ') +
          (r > 8 ? ' …' : ''),
      ];
    }
    default:
      return [];
  }
}

// ---- Participantes -----------------------------------------------------------------

/**
 * Inventario mínimo para lgPool sobre el índice de la Biblioteca (sin ADN:
 * solo para contar y sortear claves).
 * @param {{indice: any[], sel?: Iterable<string>, selecciones?: {nombre: string, claves: string[]}[]}} o
 */
export function inventarioClaves(o) {
  const porClave = new Map(o.indice.map((e) => [e.clave, e]));
  return {
    items: o.indice.map((e) => ({
      key: e.clave,
      b: { name: e.nombre, file: e.archivo || '', veg: !!e.vegetal },
    })),
    sel: new Set(o.sel ?? []),
    sets: new Map((o.selecciones ?? []).map((s) => [s.nombre, { keys: s.claves }])),
    /** @param {string} key */
    userRec: (key) => {
      const m = porClave.get(key)?.marcas;
      return { fav: !!m?.fav, tags: m?.tags ?? [] };
    },
  };
}

/**
 * Claves del pool (sin vegetales, un nombre por especie: lgPool).
 * @param {ReturnType<typeof inventarioClaves>} inv @param {string} pool
 * @returns {string[]}
 */
export const clavesDelPool = (inv, pool) =>
  lgPool(inv, pool).map((/** @type {any} */ it) => it.key);

/**
 * Sortea n claves del pool que no estén ya elegidas (lgShuffle).
 * @param {string[]} pool @param {string[]} ya @param {number} n @param {() => number} [rnd]
 */
export function sortearClaves(pool, ya, n, rnd = Math.random) {
  const tengo = new Set(ya);
  return lgShuffle(
    pool.filter((k) => !tengo.has(k)),
    rnd,
  ).slice(0, Math.max(0, n));
}

/** Partidos del calendario de todos contra todos. @param {number} n @param {number} legs */
export const partidosRr = (n, legs) => ((n * (n - 1)) / 2) * (legs === 2 ? 2 : 1);

/**
 * Validación del paso 2. tamPool = bots que tiene el pool elegido.
 * @param {Asistente} a @param {{tamPool: number}} ctx
 * @returns {{errores: Mensaje[], avisos: Mensaje[]}}
 */
export function validarParticipantes(a, ctx) {
  /** @type {Mensaje[]} */
  const errores = [];
  /** @type {Mensaje[]} */
  const avisos = [];
  const f = a.fmt.format;
  if (a.modo === 'fixed') {
    const n = a.claves.length;
    if (n < 2) errores.push({ clave: 'competir.val.pocos', params: { n } });
    if (f === 'cup' && n >= 2 && !LG_CUP_SIZES.includes(n))
      errores.push({ clave: 'competir.val.copa', params: { n } });
    if (f === 'single' && n > LG_MAX_FIGHTERS)
      avisos.push({ clave: 'competir.val.single', params: { max: LG_MAX_FIGHTERS, n } });
    if (f === 'rr' && partidosRr(n, a.fmt.legs) > LG_RR_WARN)
      avisos.push({ clave: 'competir.val.rrLargo', params: { n: partidosRr(n, a.fmt.legs) } });
  } else {
    const n = Math.trunc(Number(a.n));
    if (ctx.tamPool < 2)
      errores.push({ clave: 'competir.val.poolCorto', params: { n: ctx.tamPool } });
    if (!(n >= 2) || n > LG_DRAW_MAX) errores.push({ clave: 'competir.val.nMin' });
    else {
      if (n > ctx.tamPool && ctx.tamPool >= 2)
        avisos.push({ clave: 'competir.val.nMayorPool', params: { n, pool: ctx.tamPool } });
      if (f === 'cup' && !LG_CUP_SIZES.includes(Math.min(n, ctx.tamPool)))
        errores.push({ clave: 'competir.val.copa', params: { n: Math.min(n, ctx.tamPool) } });
      if (f === 'cup' && a.modo === 'fight') avisos.push({ clave: 'competir.val.copaPelea' });
      if (f === 'single' && n > LG_MAX_FIGHTERS)
        avisos.push({ clave: 'competir.val.single', params: { max: LG_MAX_FIGHTERS, n } });
      const nn = Math.min(n, ctx.tamPool);
      if (f === 'rr' && partidosRr(nn, a.fmt.legs) > LG_RR_WARN)
        avisos.push({ clave: 'competir.val.rrLargo', params: { n: partidosRr(nn, a.fmt.legs) } });
    }
  }
  return { errores, avisos };
}

/**
 * Validación de los valores del partido (paso 3): cada número en su rango.
 * @param {Record<string, any>} fmt
 * @returns {Mensaje[]}
 */
export function validarValores(fmt) {
  /** @type {Mensaje[]} */
  const out = [];
  for (const k of [...CAMPOS_PARTIDO, ...Object.values(CAMPOS_FORMATO).flat()]) {
    const r = rangoCampo(k, fmt);
    if (!r) continue;
    const v = Number(fmt[k]);
    if (!Number.isInteger(v) || v < r[0] || v > r[1])
      out.push({ clave: 'competir.val.rango', params: { campo: k, min: r[0], max: r[1] } });
  }
  return out;
}

// ---- Reglas del mundo (decisión 21) -------------------------------------------------

/** El escenario de las reglas F1 (el Partido F1 de fábrica, sin especies). */
export function escenarioF1() {
  const e = escenarioFabrica(ID_F1);
  if (!e) throw new Error(`sin escenario ${ID_F1}`);
  return structuredClone(e);
}

/** El Partido F1 con todos los costos en 0 (CostX y los dinámicos por defecto). */
export function escenarioSinCostos() {
  const e = escenarioF1();
  return {
    ...e,
    id: ID_SIN_COSTOS,
    nombre: { es: 'Partido sin costos', en: 'No-cost match' },
    opciones: { base: e.opciones.base, cambios: { ...e.opciones.cambios, ...costosNinguno() } },
  };
}

/**
 * Las reglas (lo que se guarda en S.rules) de una selección del paso 3.
 * Lanza ErrorEscenario si el escenario elegido no valida.
 * @param {SeleccionReglas} sel
 */
export function reglasDeSeleccion(sel) {
  if (sel.tipo === 'sincostos') return reglasDeEscenario(escenarioSinCostos());
  if (sel.tipo === 'escenario' && sel.escenario) return reglasDeEscenario(sel.escenario);
  return reglasDeEscenario(escenarioF1());
}

/**
 * Qué selección representan unas reglas guardadas (para marcar la opción).
 * @param {any} rules @returns {SeleccionReglas['tipo'] | 'clasica'}
 */
export function tipoDeReglas(rules) {
  const e = rules?.escenario;
  if (!e) return 'clasica';
  if (e.id === ID_F1 && !Object.keys(e.opciones?.cambios ?? {}).length) return 'f1';
  if (e.id === ID_SIN_COSTOS) return 'sincostos';
  return 'escenario';
}

/**
 * ¿Se puede pasar del paso actual? (los errores de ese paso).
 * @param {Asistente} a @param {{tamPool: number}} ctx
 * @returns {Mensaje[]}
 */
export function erroresDelPaso(a, ctx) {
  if (a.paso === 1) return [];
  if (a.paso === 2) return validarParticipantes(a, ctx).errores;
  /** @type {Mensaje[]} */
  const out = validarValores(a.fmt);
  try {
    reglasDeSeleccion(a.reglas);
  } catch {
    out.push({ clave: 'competir.val.reglas' });
  }
  return out;
}

/**
 * Paso siguiente (si el actual no tiene errores) o el anterior.
 * @param {Asistente} a @param {1 | -1} dir @param {{tamPool: number}} ctx
 * @returns {Asistente}
 */
export function mover(a, dir, ctx) {
  if (dir < 0) return a.paso > 1 ? { ...a, paso: /** @type {1 | 2 | 3} */ (a.paso - 1) } : a;
  if (a.paso >= 3 || erroresDelPaso(a, ctx).length) return a;
  return { ...a, paso: /** @type {1 | 2 | 3} */ (a.paso + 1) };
}

/**
 * El plan de creación del asistente (lo que hace crearTorneo): formato y
 * valores (lgSetFmt, en orden: primero el formato), el sorteo (lgSetDraw) y
 * cómo se llenan los participantes de la temporada 1.
 * @param {Asistente} a
 */
export function planCreacion(a) {
  // en este orden: el formato primero y, en la colina, el fin antes que el
  // retiro (retiro 0 solo sin fin: lgKothClean)
  const campos = [
    'format',
    ...(CAMPOS_FORMATO[/** @type {keyof typeof CAMPOS_FORMATO} */ (a.fmt.format)] ?? []),
    ...CAMPOS_PARTIDO,
  ];
  const fmt = campos.map((k) => /** @type {[string, any]} */ ([k, a.fmt[k]]));
  const draw = { mode: a.modo, pool: a.pool, n: Math.trunc(Number(a.n)) || 8 };
  // la copa no sortea en cada pelea: se sortea la temporada 1 como 'random'
  const llenar =
    a.modo === 'fixed'
      ? 'lista'
      : a.modo === 'fight' && a.fmt.format !== 'cup'
        ? 'pelea'
        : 'sorteo';
  return { fmt, draw, llenar, reglas: reglasDeSeleccion(a.reglas) };
}
