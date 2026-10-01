// @ts-check
// Modo TV (paso N3.6, decisión 23): el controlador de la página. Maneja la
// secuencia pura de maquina.js con el estado de torneos de la página
// (src/lib/competir/torneos.svelte.js → engine/torneos.js: lgEdition,
// lgTvNext, lgPlay) y un tic de 250 ms que mueve la cuenta atrás y mira si
// el partido en juego terminó (vigilarPartido: la pelea lanzada ya no está
// en juego y aparece su registro en los partidos de la liga, o se abandonó).
// No se mira «el último resultado» ni «la última nota»: una ronda en
// segundo plano de otro torneo o una nota posterior los pisan entre tic y
// tic.
//
// El avance automático no depende de la presentación: #/observar/tv lo
// muestra a pantalla completa, sin paneles; #/observar/torneo, en Observar
// con el panel lateral y la barra. Pasar de una a otra no lo corta.
//
// Entrada: entrarTv(id, {completa}) desde Competir (en el clic: con
// `completa` pide la pantalla completa, que exige un gesto del usuario, y
// abre #/observar/tv; sin ella, #/observar/torneo); seguirTorneo() desde
// Observar con un partido de torneo en juego. Observar llama a iniciarTv()
// al entrar en cualquiera de las dos rutas y a detenerTv() al dejarlas.
// Apagar el TV no abandona el partido en curso: se registra al terminar
// (como la clásica).

import { LG_SCRATCH_ID, lgDrawOf, lgSeason } from '../../../../engine/league.js';
import { hashDe } from '../../../router.js';
import { asegurarBiblioteca } from '../../bots/biblioteca.svelte.js';
import { nombreTorneo, textoError } from '../../competir/textos.js';
import {
  abandonar,
  abrir,
  asegurarTorneos,
  est,
  torneos,
  tr,
} from '../../competir/torneos.svelte.js';
import { sesion } from '../../sim/sesion.svelte.js';
import {
  activo,
  estadoInicial,
  PAUSA_DEF,
  paso,
  pausaValida,
  registrosPrevios,
  vigilarPartido,
} from './maquina.js';

/** Segundos de la cortinilla (la clave de la clásica se lee como valor inicial). */
const KV_PAUSA = 'darwinbots2.tv-pausa';
const KV_PAUSA_CLASICA = 'db-tv-pause';
/** A pantalla completa, la tarjeta de la pelea oculta ('1') o a la vista. */
const KV_OCULTA = 'darwinbots2.tv-tarjeta-oculta';
const TIC_MS = 250;

/**
 * @typedef {{f1: any, ciclo: number, colores: Map<string, string>, rounds: number, wins: number}} MarcadorTv
 */

class EstadoTv {
  /** @type {import('./maquina.js').EstadoTV} */
  e = $state.raw(estadoInicial());
  /** performance.now() del último tic (la cuenta atrás del rótulo) */
  ahora = $state(0);
  /** id del torneo del TV ('' = ninguno) */
  liga = $state('');
  /** @type {MarcadorTv | null} el último marcador de la pelea (se ve en el respiro) */
  final = $state.raw(null);
  /** a pantalla completa, la tarjeta de la pelea plegada a un chip */
  oculta = $state(leer(KV_OCULTA) === '1');
}

export const tv = new EstadoTv();

/** Torneo pedido por entrarTv (se abre al iniciar si no es el abierto). */
let pedido = '';
/** entrarTv ya pidió la pantalla completa (Observar no la pide otra vez) */
let pantallaPedida = false;
/** sube con cada iniciar/detener: descarta respuestas del motor de otra vuelta */
let gen = 0;
/** @type {ReturnType<typeof setInterval> | null} */
let reloj = null;

/**
 * La pelea que se vigila: el partido del motor (lg.live) que se lanzó, los
 * registros de la liga que había antes, la nota de entonces y desde cuándo
 * no está en juego.
 */
let vigilada = {
  vivo: /** @type {any} */ (null),
  temporada: 0,
  luchadores: /** @type {string[]} */ ([]),
  previos: /** @type {Set<string>} */ (new Set()),
  notaAntes: 0,
  sinJuegoDesde: 0,
};

/** @param {string} k */
function leer(k) {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** Segundos de cortinilla guardados (5 si no hay). */
export function pausaGuardada() {
  return pausaValida(leer(KV_PAUSA) ?? leer(KV_PAUSA_CLASICA) ?? PAUSA_DEF);
}

/** Cambia los segundos de cortinilla (valen desde la próxima pelea). @param {any} x */
export function ponerPausa(x) {
  const p = pausaValida(x);
  try {
    localStorage.setItem(KV_PAUSA, String(p));
  } catch {
    // sin almacenamiento: no se recuerda
  }
  tv.e = { ...tv.e, pausa: p };
}

/** Pliega o despliega la tarjeta de la pelea (pantalla completa) y lo recuerda. */
export function alternarTarjeta() {
  tv.oculta = !tv.oculta;
  try {
    localStorage.setItem(KV_OCULTA, tv.oculta ? '1' : '0');
  } catch {
    // sin almacenamiento: no se recuerda
  }
}

/** @param {import('./maquina.js').EventoTV} ev */
function despachar(ev) {
  if (ev.t === 'resultado') cerrarMarcador(ev.rec);
  const r = paso(tv.e, ev);
  tv.e = r.e;
  if (r.accion) void ejecutar(r.accion, gen);
}

/** El torneo del TV, si sigue siendo el abierto. */
function ligaDelTv() {
  const x = torneos();
  const L = x?.lg.cur;
  return x && L && L.id === tv.liga ? { x, L } : null;
}

/**
 * Empieza a vigilar una pelea (antes de lanzarla o al entrar con ella en juego).
 * @param {any} x estado de torneos @param {number} temporada @param {{name: string}[]} fighters
 */
function vigilar(x, temporada, fighters) {
  vigilada = {
    vivo: null,
    temporada,
    luchadores: fighters.map((f) => f.name),
    previos: registrosPrevios(x.lg.matches, tv.liga),
    notaAntes: est.nota?.n ?? 0,
    sinJuegoDesde: 0,
  };
  tv.final = null;
}

/**
 * Hace con el motor lo que pide la máquina y le manda la respuesta.
 * @param {'edicion' | 'siguiente' | 'lanzar'} accion @param {number} g
 */
async function ejecutar(accion, g) {
  const c = ligaDelTv();
  if (!c) {
    despachar({ t: 'error', clave: torneos()?.lg.cur ? 'tv-otro-torneo' : 'tv-sin-torneo' });
    return;
  }
  const { x, L } = c;
  try {
    if (accion === 'edicion') {
      await asegurarBiblioteca();
      const r = await x.lgEdition(L);
      if (g === gen) despachar({ t: 'edicion', r });
    } else if (accion === 'siguiente') {
      const r = await x.lgTvNext(L);
      if (g === gen) despachar({ t: 'siguiente', r, ahora: performance.now() });
    } else {
      const fx = tv.e.fx;
      try {
        if (!fx) throw new Error('fx');
        vigilar(x, lgSeason(L).no, fx.fighters);
        await x.lgPlay(L, fx);
        // lgPlay abre lg.live antes de lanzar: esa es la pelea del TV
        vigilada.vivo = x.lg.live;
        if (g === gen) despachar({ t: 'lanzado', ok: true });
      } catch (e) {
        if (g === gen) despachar({ t: 'lanzado', ok: false, detalle: textoError(e, tr) });
      }
    }
  } catch (e) {
    if (g === gen)
      despachar({ t: 'error', clave: 'tv-excepcion', params: { detalle: textoError(e, tr) } });
  } finally {
    est.version++;
  }
}

/**
 * Guarda el marcador de la pelea en juego (para el respiro: al registrarse,
 * torneos.svelte.js borra el suyo).
 * @param {any} x @param {any} live
 */
function guardarMarcador(x, live) {
  const m = est.marcador;
  if (!m?.f1) return;
  const L = x.lgFind(live.league);
  const fmt = L ? lgSeason(L).fmt : null;
  tv.final = {
    f1: m.f1,
    ciclo: m.cycle,
    colores: new Map(live.fighters.map((/** @type {any} */ f) => [f.name, f.color])),
    rounds: fmt?.rounds ?? 5,
    wins: fmt?.wins ?? 0,
  };
}

/** El marcador guardado, con las victorias finales del registro. @param {any} rec */
function cerrarMarcador(rec) {
  const f = tv.final;
  if (!f?.f1?.sp) return;
  const nombres = /** @type {string[]} */ (rec?.fighters ?? []);
  const wins = /** @type {number[]} */ (rec?.wins ?? []);
  tv.final = {
    ...f,
    ciclo: Number(rec?.cycles) || f.ciclo,
    f1: {
      ...f.f1,
      over: true,
      sp: f.f1.sp.map((/** @type {any} */ s) => {
        const i = nombres.indexOf(s.name);
        return i >= 0 && Number.isFinite(wins[i]) ? { ...s, wins: wins[i] } : s;
      }),
    },
  };
}

function tic() {
  const ahora = performance.now();
  tv.ahora = ahora;
  if (!activo(tv.e)) return;
  // otro torneo abierto mientras tanto: el TV se apaga (la clásica, al elegir otro)
  const c = ligaDelTv();
  if (!c) {
    despachar({ t: 'error', clave: 'tv-otro-torneo' });
    return;
  }
  if (tv.e.fase === 'partido') {
    const { x } = c;
    const live = x.lg.live;
    const enJuego = !!live && live === vigilada.vivo;
    if (enJuego) guardarMarcador(x, live);
    else if (!vigilada.sinJuegoDesde) vigilada.sinJuegoDesde = ahora;
    const ev = vigilarPartido({
      enJuego,
      matches: x.lg.matches,
      liga: tv.liga,
      temporada: vigilada.temporada,
      luchadores: vigilada.luchadores,
      previos: vigilada.previos,
      nota: est.nota,
      notaAntes: vigilada.notaAntes,
      sinJuegoDesde: vigilada.sinJuegoDesde || ahora,
      ahora,
    });
    if (ev) despachar(ev);
    return;
  }
  despachar({ t: 'tic', ahora });
}

/**
 * Desde Competir, en el clic: Observar avanzando solo con el torneo `id`,
 * a pantalla completa (si el navegador la da) o con los paneles.
 * @param {string} id @param {{completa?: boolean}} [o]
 */
export function entrarTv(id, { completa = true } = {}) {
  pedido = id;
  if (completa) pantallaCompleta();
  else window.location.hash = hashDe('observar', 'torneo');
}

/**
 * Del avance con paneles a pantalla completa (en el clic), sin cortarlo.
 * La pantalla completa la pide el clic: Observar no la pide otra vez.
 */
export function pantallaCompleta() {
  const d = typeof document !== 'undefined' ? document.documentElement : null;
  if (d?.requestFullscreen && !document.fullscreenElement) {
    pantallaPedida = true;
    d.requestFullscreen().catch(() => {
      // sin pantalla completa: Observar usa el layout sin paneles
    });
  }
  window.location.hash = hashDe('observar', 'tv');
}

/** De pantalla completa a Observar con paneles, sin cortar el avance. */
export function conPaneles() {
  if (typeof document !== 'undefined' && document.fullscreenElement)
    document.exitFullscreen().catch(() => {});
  window.location.hash = hashDe('observar', 'torneo');
}

/**
 * Desde Observar con un partido del torneo abierto en juego («Jugar y
 * mirar»): que siga solo con los siguientes. iniciarTv toma la pelea en
 * juego y la registra antes de buscar la próxima.
 */
export function seguirTorneo() {
  window.location.hash = hashDe('observar', 'torneo');
}

/**
 * ¿Hay en juego un partido del torneo abierto (no una repetición)? Lo que
 * Observar necesita para ofrecer seguirTorneo().
 */
export function hayPartidoDeTorneo() {
  est.version;
  est.marcador;
  const x = torneos();
  const live = x?.lg.live;
  return !!live && !live.replay && live.league === x?.lg.cur?.id;
}

/**
 * Observar al entrar en modo TV: pide la pantalla completa solo si entrarTv
 * no la pidió (se llegó por recarga o por un enlace; sin gesto del usuario
 * el navegador puede negarla).
 */
export function pantallaSiFalta() {
  const ya = pantallaPedida;
  pantallaPedida = false;
  if (ya || typeof document === 'undefined' || document.fullscreenElement) return;
  const d = document.documentElement;
  if (d.requestFullscreen) d.requestFullscreen().catch(() => {});
}

/** Enciende el TV con el torneo abierto (o el pedido por entrarTv). */
export async function iniciarTv() {
  if (activo(tv.e)) return;
  const g = ++gen;
  tv.e = { ...estadoInicial(), fase: 'edicion' }; // «sorteando» mientras carga
  tv.final = null;
  const x = await asegurarTorneos();
  if (g !== gen) return;
  if (pedido && x.lg.cur?.id !== pedido) await abrir(pedido);
  pedido = '';
  if (g !== gen) return;
  const L = x.lg.cur;
  tv.liga = L?.id ?? '';
  /** @type {import('./maquina.js').Pelea | null} */
  let enCurso = null;
  const live = x.lg.live;
  if (L && live && live.league === L.id && !live.replay) {
    enCurso = { fighters: live.fighters, label: live.label };
    vigilar(x, live.season, live.fighters);
    vigilada.vivo = live;
    // la sim pudo quedar en pausa (se pausó en Observar): la pelea sigue
    const s = sesion();
    if (!s.corriendo) s.correr(true);
  } else if (live) abandonar(); // un partido a la vez (como la clásica)
  tv.e = estadoInicial();
  if (!L) {
    tv.e = { ...estadoInicial(), fase: 'error', error: { clave: 'tv-sin-torneo', params: {} } };
    return;
  }
  despachar({
    t: 'iniciar',
    pausa: pausaGuardada(),
    enCurso,
    temporada: enCurso ? live.season : lgSeason(L).no,
  });
  if (reloj === null) reloj = setInterval(tic, TIC_MS);
  tv.ahora = performance.now();
}

/** Apaga el TV (el partido en curso sigue y se registra al terminar). */
export function detenerTv() {
  gen++;
  if (reloj !== null) clearInterval(reloj);
  reloj = null;
  tv.e = paso(tv.e, { t: 'detener' }).e;
}

/** Ruta de vuelta al salir del TV: la vista del torneo que se miraba. */
export function rutaSalida() {
  if (!tv.liga) return hashDe('competir');
  return tv.liga === LG_SCRATCH_ID ? hashDe('competir', 'rapido') : hashDe('competir', tv.liga);
}

/** Nombre visible, formato y modo de sorteo del torneo del TV (para el rótulo). */
export function contextoTv() {
  const L = torneos()?.lgFind(tv.liga);
  return {
    torneo: L ? nombreTorneo(L, tr) : '',
    formato: L ? lgSeason(L).fmt.format : '',
    sorteo: L ? lgDrawOf(L).mode : '',
  };
}
