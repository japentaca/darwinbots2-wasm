// @ts-check
// Modo TV (paso N3.6, decisión 23: «Observar a pantalla completa con
// rótulos y cortinillas»), lo puro: la secuencia de estados sin
// temporizadores ni motor. Juega la temporada entera del torneo sin
// intervención: edición (lgEdition: la temporada abierta, o una nueva con
// sorteo nuevo) → buscar la pelea (lgTvNext) → cortinilla con cuenta atrás
// → lanzar (lgPlay) → partido → resultado (un respiro para ver el
// marcador) → buscar la siguiente… y, cuando no quedan peleas, el campeón y
// otra edición, en bucle.
//
// paso(e, ev) devuelve {e, accion}: el estado nuevo y lo que el
// controlador (tv.svelte.js) tiene que hacer con el motor antes de mandar
// el evento siguiente:
//   'edicion'   lgEdition(L)        → {t: 'edicion', r}
//   'siguiente' lgTvNext(L)         → {t: 'siguiente', r}
//   'lanzar'    lgPlay(L, e.fx)     → {t: 'lanzado', ok, detalle?}
//   null        nada (esperar un tic, el resultado o el abandono)
// Un evento que no corresponde a la fase se ignora (el mismo estado y
// accion null): así una respuesta vieja del motor no rompe la secuencia.
//
// Fases:
//   apagado     sin TV
//   edicion     esperando lgEdition
//   buscando    esperando lgTvNext
//   cortinilla  la próxima pelea con cuenta atrás (hasta)
//   lanzando    esperando lgPlay
//   partido     la pelea en juego (se espera {t: 'resultado'} o {t: 'abandonado'})
//   resultado   el ganador de la pelea, un respiro (hasta)
//   campeon     la edición terminó: el campeón y la cuenta de la siguiente (hasta)
//   error       el TV se detuvo (error = {clave, params}; las claves del
//               motor tv-* y round-running, más las propias de TV_ERRORES)
//
// Los tiempos son los de la clásica: cortinilla de `pausa` segundos (0–60,
// 5 por defecto), rótulo del campeón de max(12, pausa) s, respiro de 1,5 s
// y el TV se apaga tras más de 5 lanzamientos fallidos o peleas nulas
// seguidas.

export const PAUSA_DEF = 5;
export const PAUSA_MAX = 60;
export const CAMPEON_S = 12;
export const RESPIRO_MS = 1500;
export const FALLOS_MAX = 5;

/** Claves de error propias del TV (las del motor: CLAVES_TV de competir/textos.js). */
export const TV_ERRORES = Object.freeze([
  'tv-fallos-lanzar',
  'tv-fallos-nulos',
  'tv-abandonado',
  'tv-otro-torneo',
  'tv-sin-torneo',
  'tv-excepcion',
]);

/**
 * @typedef {'apagado' | 'edicion' | 'buscando' | 'cortinilla' | 'lanzando' | 'partido'
 *   | 'resultado' | 'campeon' | 'error'} Fase
 * @typedef {{fighters: {name: string, color?: string}[], label: {clave: string, params?: Record<string, any>} | null}} Pelea
 * @typedef {{
 *   fase: Fase,
 *   pausa: number,
 *   pelea: number,
 *   fallos: number,
 *   fx: Pelea | null,
 *   ganador: string,
 *   campeon: {name: string, how: string} | null,
 *   temporada: number,
 *   hasta: number,
 *   error: {clave: string, params: Record<string, any>} | null,
 *   aviso: {clave: string, params: Record<string, any>} | null,
 * }} EstadoTV
 * @typedef {'edicion' | 'siguiente' | 'lanzar' | null} Accion
 * @typedef {{e: EstadoTV, accion: Accion}} Paso
 * @typedef {{t: 'iniciar', pausa?: any, enCurso?: Pelea | null, temporada?: number}
 *   | {t: 'edicion', r: any}
 *   | {t: 'siguiente', r: any, ahora: number}
 *   | {t: 'tic', ahora: number}
 *   | {t: 'lanzado', ok: boolean, detalle?: string}
 *   | {t: 'resultado', rec: {winner?: string}, ahora: number}
 *   | {t: 'abandonado'}
 *   | {t: 'error', clave: string, params?: Record<string, any>}
 *   | {t: 'detener'}} EventoTV
 */

/** Segundos de cortinilla válidos (0–60; 5 si no es un número). @param {any} x */
export function pausaValida(x) {
  const n = Number.parseInt(String(x), 10);
  return Number.isNaN(n) ? PAUSA_DEF : Math.min(PAUSA_MAX, Math.max(0, n));
}

/** @returns {EstadoTV} */
export function estadoInicial() {
  return {
    fase: 'apagado',
    pausa: PAUSA_DEF,
    pelea: 0,
    fallos: 0,
    fx: null,
    ganador: '',
    campeon: null,
    temporada: 0,
    hasta: 0,
    error: null,
    aviso: null,
  };
}

/** ¿El TV está andando (no apagado ni detenido por un error)? @param {EstadoTV} e */
export const activo = (e) => e.fase !== 'apagado' && e.fase !== 'error';

/** Segundos que faltan de la cortinilla o del rótulo del campeón. @param {EstadoTV} e @param {number} ahora */
export const cuenta = (e, ahora) => Math.max(0, Math.ceil((e.hasta - ahora) / 1000));

/** @param {EstadoTV} e @param {Partial<EstadoTV>} cambios @param {Accion} [accion] @returns {Paso} */
const ir = (e, cambios, accion = null) => ({ e: { ...e, ...cambios }, accion });

/** @param {EstadoTV} e @param {string} clave @param {Record<string, any>} [params] @returns {Paso} */
const fallar = (e, clave, params = {}) => ir(e, { fase: 'error', error: { clave, params } });

/**
 * Un paso de la secuencia.
 * @param {EstadoTV} e @param {EventoTV} ev @returns {Paso}
 */
export function paso(e, ev) {
  const igual = { e, accion: /** @type {Accion} */ (null) };
  switch (ev.t) {
    case 'iniciar': {
      const base = { ...estadoInicial(), pausa: pausaValida(ev.pausa ?? PAUSA_DEF) };
      // entrar con una pelea del mismo torneo ya en juego: se la mira
      if (ev.enCurso)
        return ir(base, {
          fase: 'partido',
          fx: ev.enCurso,
          pelea: 1,
          temporada: ev.temporada ?? 0,
        });
      return ir(base, { fase: 'edicion' }, 'edicion');
    }
    case 'detener':
      return e.fase === 'apagado' ? igual : ir(e, { fase: 'apagado', hasta: 0 });
    case 'error':
      return activo(e) ? fallar(e, ev.clave, ev.params) : igual;
    case 'edicion': {
      if (e.fase !== 'edicion') return igual;
      const r = ev.r ?? {};
      if (!r.ok) return fallar(e, String(r.clave ?? 'tv-excepcion'), r.params ?? {});
      return ir(
        e,
        { fase: 'buscando', temporada: Number(r.season) || e.temporada, campeon: null },
        'siguiente',
      );
    }
    case 'siguiente': {
      if (e.fase !== 'buscando') return igual;
      const r = ev.r ?? {};
      if (r.t === 'pelea')
        return ir(e, {
          fase: 'cortinilla',
          fx: r.fx,
          pelea: e.pelea + 1,
          ganador: '',
          hasta: ev.ahora + e.pausa * 1000,
        });
      if (r.t === 'fin')
        return ir(e, {
          fase: 'campeon',
          campeon: r.champ ?? null,
          hasta: ev.ahora + Math.max(CAMPEON_S, e.pausa) * 1000,
        });
      return fallar(e, String(r.clave ?? 'tv-pool-fight'));
    }
    case 'tic':
      if (ev.ahora < e.hasta) return igual;
      if (e.fase === 'cortinilla') return ir(e, { fase: 'lanzando', aviso: null }, 'lanzar');
      if (e.fase === 'resultado') return ir(e, { fase: 'buscando' }, 'siguiente');
      if (e.fase === 'campeon') return ir(e, { fase: 'edicion' }, 'edicion');
      return igual;
    case 'lanzado': {
      if (e.fase !== 'lanzando') return igual;
      if (ev.ok) return ir(e, { fase: 'partido' });
      const fallos = e.fallos + 1;
      if (fallos > FALLOS_MAX) return fallar({ ...e, fallos }, 'tv-fallos-lanzar');
      return ir(
        e,
        {
          fase: 'buscando',
          fallos,
          aviso: { clave: 'no-arranco', params: { n: e.pelea, detalle: ev.detalle ?? '' } },
        },
        'siguiente',
      );
    }
    case 'resultado': {
      if (e.fase !== 'partido') return igual;
      const ganador = String(ev.rec?.winner ?? '');
      const fallos = ganador ? 0 : e.fallos + 1;
      if (fallos > FALLOS_MAX) return fallar({ ...e, fallos, ganador }, 'tv-fallos-nulos');
      return ir(e, { fase: 'resultado', ganador, fallos, hasta: ev.ahora + RESPIRO_MS });
    }
    case 'abandonado':
      return e.fase === 'partido' || e.fase === 'lanzando' ? fallar(e, 'tv-abandonado') : igual;
    default:
      return igual;
  }
}

/** Espera máxima del registro tras terminar la pelea (luego se da por abandonada). */
export const ESPERA_REGISTRO_MS = 5000;

/** Clave de un partido registrado dentro de su liga. @param {{season: number, no: number}} m */
export const claveRegistro = (m) => `${m.season}:${m.no}`;

/**
 * Los partidos ya registrados de la liga (se toman antes de lanzar: el
 * registro de la pelea del TV es uno que no está acá).
 * @param {readonly any[]} matches @param {string} liga @returns {Set<string>}
 */
export function registrosPrevios(matches, liga) {
  return new Set(matches.filter((m) => m.league === liga).map(claveRegistro));
}

/** @param {readonly string[]} a @param {readonly string[]} b */
const mismos = (a, b) =>
  a.length === b.length && [...a].sort().join('\u0001') === [...b].sort().join('\u0001');

/**
 * El partido del TV terminó o se abandonó (lo que el controlador ve del
 * motor en cada tic). No depende del último resultado ni de la última nota
 * (otra liga, una ronda en segundo plano o una nota posterior los pisan):
 * mientras la pelea lanzada sigue en juego → null; si no, se busca en los
 * partidos de la liga abierta un registro nuevo de la liga del TV, de su
 * temporada y con sus luchadores (uno que no estaba al lanzar) →
 * {t: 'resultado', rec}; una nota 'abandoned' posterior al lanzamiento, o
 * ESPERA_REGISTRO_MS sin pelea y sin registro → {t: 'abandonado'}; si no,
 * null (se está registrando).
 * @param {{
 *   enJuego: boolean, matches: readonly any[], liga: string, temporada: number,
 *   luchadores: readonly string[], previos: Set<string>,
 *   nota: {clave: string, n: number} | null, notaAntes: number,
 *   sinJuegoDesde: number, ahora: number,
 * }} x
 * @returns {EventoTV | null}
 */
export function vigilarPartido(x) {
  if (x.enJuego) return null;
  const rec = x.matches.find(
    (m) =>
      m.league === x.liga &&
      m.season === x.temporada &&
      !x.previos.has(claveRegistro(m)) &&
      mismos(m.fighters ?? [], x.luchadores),
  );
  if (rec) return { t: 'resultado', rec, ahora: x.ahora };
  if (x.nota && x.nota.n > x.notaAntes && x.nota.clave === 'abandoned') return { t: 'abandonado' };
  if (x.ahora - x.sinJuegoDesde >= ESPERA_REGISTRO_MS) return { t: 'abandonado' };
  return null;
}
