// @ts-check
// Torneo en curso (PLAN-TORNEO-EN-CURSO.md, TC2: T1 y T9): el controlador
// del avance, sin runes ni DOM. Maneja la secuencia pura de maquina.js con
// el estado de torneos de la página (engine/torneos.js: lgEdition,
// lgTvNext, lgPlay) y un tic de 250 ms que mueve la cuenta atrás y mira si
// el partido en juego terminó (vigilarPartido: la pelea lanzada ya no está
// en juego y aparece su registro en los partidos de la liga, o se abandonó).
// No se mira «el último resultado» ni «la última nota»: una ronda en
// segundo plano de otro torneo o una nota posterior los pisan entre tic y
// tic.
//
// Lo arrancan y lo paran solo sus acciones (iniciar, parar, abandonar,
// detener): ninguna pantalla lo enciende ni lo apaga, y el worker de la
// sim corre aunque Observar no esté montado (conexion.js devuelve el frame
// sin dibujarlo). tv.svelte.js le pasa el estado reactivo y las
// dependencias de la página; los tests, dobles (test/torneo_en_curso.test.js).
//
// Cuándo para lo dice «Al terminar la pelea» (estado.alTerminar): 'parar'
// juega una pelea, 'temporada' sigue hasta el campeón y 'ediciones' sigue
// con otra edición, en bucle. parar() para al terminar la pelea en juego,
// que se registra (como la clásica); abandonarPelea() la corta sin
// registrarla.
//
// Recarga (T9): mientras el avance está encendido, el id del torneo queda
// en enCurso (sessionStorage en la página); detener() lo borra. Tras una
// recarga la franja ofrece «Reanudar», pero no arranca sola.

import { lgSeason } from '../../../../engine/league.js';
import { activo, estadoInicial, paso, registrosPrevios, vigilarPartido } from './maquina.js';

export const TIC_MS = 250;

/** Fases con una pelea lanzada o en juego («Parar» espera a que termine). */
const CON_PELEA = new Set(['lanzando', 'partido', 'resultado']);

/**
 * @typedef {{f1: any, ciclo: number, colores: Map<string, string>, rounds: number, wins: number}} MarcadorTv
 * @typedef {'parar' | 'temporada' | 'ediciones'} AlTerminar
 * @typedef {{
 *   e: import('./maquina.js').EstadoTV,
 *   ahora: number,
 *   liga: string,
 *   final: MarcadorTv | null,
 *   alTerminar: AlTerminar,
 *   pararTras: boolean,
 * }} EstadoAvance
 * @typedef {{
 *   estado: EstadoAvance,
 *   torneos: () => any,
 *   asegurarTorneos: () => Promise<any>,
 *   abrir: (id: string) => Promise<any>,
 *   abandonar: () => void,
 *   asegurarBiblioteca: () => Promise<any>,
 *   est: () => {nota: any, marcador: any, version: number},
 *   reanudarSim: () => void,
 *   ahora: () => number,
 *   reloj: {poner: (fn: () => void, ms: number) => any, quitar: (h: any) => void},
 *   enCurso: {guardar: (id: string) => void, borrar: () => void},
 *   textoError: (e: unknown) => string,
 * }} DepsAvance
 */

/**
 * ¿«Al terminar la pelea» pide parar en este paso? Se para en la cortinilla
 * de la próxima pelea (con 'parar', si ya hubo una en esta vuelta: la
 * primera cortinilla es la de la pelea pedida) y al terminar el rótulo del
 * campeón (salvo con 'ediciones').
 * @param {import('./maquina.js').EstadoTV} antes @param {import('./maquina.js').EstadoTV} despues
 * @param {{alTerminar: AlTerminar, pararTras: boolean}} pedido
 */
export function debeParar(antes, despues, pedido) {
  if (despues.fase === 'cortinilla')
    return pedido.pararTras || (pedido.alTerminar === 'parar' && despues.pelea > 1);
  if (antes.fase === 'campeon' && despues.fase === 'edicion')
    return pedido.pararTras || pedido.alTerminar !== 'ediciones';
  return false;
}

/** @param {DepsAvance} d */
export function crearAvance(d) {
  const tv = d.estado;
  /** sube con cada iniciar/detener: descarta respuestas del motor de otra vuelta */
  let gen = 0;
  /** @type {any} */
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

  /** @param {import('./maquina.js').EventoTV} ev */
  function despachar(ev) {
    if (ev.t === 'resultado') cerrarMarcador(ev.rec);
    const r = paso(tv.e, ev);
    if (debeParar(tv.e, r.e, tv)) {
      detener();
      return;
    }
    tv.e = r.e;
    if (r.accion) void ejecutar(r.accion, gen);
  }

  /** El torneo del avance, si sigue siendo el abierto. */
  function ligaDelTv() {
    const x = d.torneos();
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
      notaAntes: d.est().nota?.n ?? 0,
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
      despachar({ t: 'error', clave: d.torneos()?.lg.cur ? 'tv-otro-torneo' : 'tv-sin-torneo' });
      return;
    }
    const { x, L } = c;
    try {
      if (accion === 'edicion') {
        await d.asegurarBiblioteca();
        // sin volver a sortear la temporada abierta (la que eligió quien juega)
        const r = await x.lgEdition(L, { sortear: false });
        if (g === gen) despachar({ t: 'edicion', r });
      } else if (accion === 'siguiente') {
        const r = await x.lgTvNext(L);
        if (g === gen) despachar({ t: 'siguiente', r, ahora: d.ahora() });
      } else {
        const fx = tv.e.fx;
        try {
          if (!fx) throw new Error('fx');
          vigilar(x, lgSeason(L).no, fx.fighters);
          await x.lgPlay(L, fx);
          // lgPlay abre lg.live antes de lanzar: esa es la pelea del avance
          vigilada.vivo = x.lg.live;
          if (g === gen) despachar({ t: 'lanzado', ok: true });
        } catch (e) {
          if (g === gen) despachar({ t: 'lanzado', ok: false, detalle: d.textoError(e) });
        }
      }
    } catch (e) {
      if (g === gen)
        despachar({ t: 'error', clave: 'tv-excepcion', params: { detalle: d.textoError(e) } });
    } finally {
      d.est().version++;
    }
  }

  /**
   * Guarda el marcador de la pelea en juego (para el respiro: al registrarse,
   * torneos.svelte.js borra el suyo).
   * @param {any} x @param {any} live
   */
  function guardarMarcador(x, live) {
    const m = d.est().marcador;
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
    const ahora = d.ahora();
    tv.ahora = ahora;
    if (!activo(tv.e)) return;
    // otro torneo abierto mientras tanto: el avance se apaga (la clásica, al elegir otro)
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
        nota: d.est().nota,
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
   * Enciende el avance con el torneo `id` (lo abre si no es el abierto) o,
   * sin id, con el abierto. Con una pelea de ese torneo en juego, la toma.
   * @param {{id?: string, pausa: number}} o
   */
  async function iniciar({ id = '', pausa }) {
    if (activo(tv.e)) return;
    const g = ++gen;
    tv.pararTras = false;
    tv.e = { ...estadoInicial(), fase: 'edicion' }; // «sorteando» mientras carga
    tv.final = null;
    const x = await d.asegurarTorneos();
    if (g !== gen) return;
    if (id && x.lg.cur?.id !== id) await d.abrir(id);
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
      d.reanudarSim();
    } else if (live) d.abandonar(); // un partido a la vez (como la clásica)
    tv.e = estadoInicial();
    if (!L) {
      tv.e = { ...estadoInicial(), fase: 'error', error: { clave: 'tv-sin-torneo', params: {} } };
      return;
    }
    d.enCurso.guardar(L.id);
    despachar({
      t: 'iniciar',
      pausa,
      enCurso,
      temporada: enCurso ? live.season : lgSeason(L).no,
    });
    if (reloj === null) reloj = d.reloj.poner(tic, TIC_MS);
    tv.ahora = d.ahora();
  }

  /** Apaga el avance (el partido en curso sigue y se registra al terminar). */
  function detener() {
    gen++;
    tv.pararTras = false;
    if (reloj !== null) d.reloj.quitar(reloj);
    reloj = null;
    tv.e = paso(tv.e, { t: 'detener' }).e;
    d.enCurso.borrar();
  }

  /** ¿Hay una pelea lanzada o en juego? */
  const hayPelea = () => CON_PELEA.has(tv.e.fase);

  return {
    iniciar,
    detener,
    tic,
    hayPelea,
    /** «Parar»: con una pelea en juego, al terminarla (se registra); si no, ya. */
    parar() {
      if (hayPelea()) tv.pararTras = true;
      else detener();
    },
    /** Cancela el «Parar al terminar esta pelea» pedido. */
    seguir() {
      tv.pararTras = false;
    },
    /** Corta la pelea en juego sin registrarla y apaga el avance. */
    abandonarPelea() {
      detener();
      d.abandonar();
    },
  };
}
