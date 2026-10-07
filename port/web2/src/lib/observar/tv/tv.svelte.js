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
// El avance no depende de la presentación (PLAN-TORNEO-EN-CURSO.md, TC1):
// la pantalla completa es un botón de Observar que no lo toca.
//
// Entrada: entrarTv(id) desde Competir («▶ Jugar», o «Mirar» con una pelea
// del torneo en juego): enciende el avance y abre Observar, que lo apaga al
// dejarlo. Cuándo para lo dice «Al terminar la pelea» (tv.alTerminar):
// 'parar' juega una pelea, 'temporada' sigue hasta el campeón y
// 'ediciones' sigue con otra edición, en bucle (lo que hacía el modo TV).
// pararTv() para al terminar la pelea en juego, que se registra (como la
// clásica); abandonarPelea() la corta sin registrarla.

import { lgDrawOf, lgSeason } from '../../../../engine/league.js';
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
/** «Al terminar la pelea»: 'parar', 'temporada' o 'ediciones'. */
const KV_AL_TERMINAR = 'darwinbots2.tv-al-terminar';
export const AL_TERMINAR = /** @type {const} */ (['parar', 'temporada', 'ediciones']);
/** @typedef {(typeof AL_TERMINAR)[number]} AlTerminar */
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
  /** @type {AlTerminar} qué hacer al terminar cada pelea */
  alTerminar = $state(alTerminarValido(leer(KV_AL_TERMINAR)));
  /** «Parar al terminar esta pelea» pedido (vale solo para esta vuelta) */
  pararTras = $state(false);
}

/** @param {any} x @returns {AlTerminar} */
function alTerminarValido(x) {
  return AL_TERMINAR.includes(x) ? x : 'temporada';
}

export const tv = new EstadoTv();

/** Torneo pedido por entrarTv (se abre al iniciar si no es el abierto). */
let pedido = '';
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

/** Cambia «Al terminar la pelea» y lo recuerda. @param {any} x */
export function ponerAlTerminar(x) {
  tv.alTerminar = alTerminarValido(x);
  try {
    localStorage.setItem(KV_AL_TERMINAR, tv.alTerminar);
  } catch {
    // sin almacenamiento: no se recuerda
  }
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
  if (debeParar(tv.e, r.e)) {
    detenerTv();
    return;
  }
  tv.e = r.e;
  if (r.accion) void ejecutar(r.accion, gen);
}

/**
 * ¿«Al terminar la pelea» pide parar en este paso? Se para en la cortinilla
 * de la próxima pelea (con 'parar', si ya hubo una en esta vuelta: la
 * primera cortinilla es la de la pelea pedida) y al terminar el rótulo del
 * campeón (salvo con 'ediciones').
 * @param {import('./maquina.js').EstadoTV} antes @param {import('./maquina.js').EstadoTV} despues
 */
function debeParar(antes, despues) {
  if (despues.fase === 'cortinilla')
    return tv.pararTras || (tv.alTerminar === 'parar' && despues.pelea > 1);
  if (antes.fase === 'campeon' && despues.fase === 'edicion')
    return tv.pararTras || tv.alTerminar !== 'ediciones';
  return false;
}

/** Fases con una pelea lanzada o en juego («Parar» espera a que termine). */
const CON_PELEA = new Set(['lanzando', 'partido', 'resultado']);

/** ¿Hay una pelea lanzada o en juego? */
export const hayPelea = () => CON_PELEA.has(tv.e.fase);

/** «Parar»: con una pelea en juego, al terminarla (se registra); si no, ya. */
export function pararTv() {
  if (hayPelea()) tv.pararTras = true;
  else detenerTv();
}

/** Cancela el «Parar al terminar esta pelea» pedido. */
export function seguirTv() {
  tv.pararTras = false;
}

/** Corta la pelea en juego sin registrarla y apaga el avance. */
export function abandonarPelea() {
  detenerTv();
  abandonar();
}

/** ¿El avance está encendido (o mostrando el error que lo paró)? */
export const avanceEncendido = () => tv.e.fase !== 'apagado';

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
      // sin volver a sortear la temporada abierta (la que eligió quien juega)
      const r = await x.lgEdition(L, { sortear: false });
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
 * Desde Competir, en el clic: enciende el avance con el torneo `id` y abre
 * Observar. Con una pelea de ese torneo en juego, la toma (iniciarTv).
 * @param {string} id
 */
export function entrarTv(id) {
  pedido = id;
  void iniciarTv();
  window.location.hash = hashDe('observar');
}

/** Enciende el TV con el torneo abierto (o el pedido por entrarTv). */
export async function iniciarTv() {
  if (activo(tv.e)) return;
  const g = ++gen;
  tv.pararTras = false;
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
  tv.pararTras = false;
  if (reloj !== null) clearInterval(reloj);
  reloj = null;
  tv.e = paso(tv.e, { t: 'detener' }).e;
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
