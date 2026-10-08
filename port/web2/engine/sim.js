// @ts-check
// Orquestación de la sim (extraída de port/web/worker.js, E1 del PLAN de web2).
//
// Es la lógica del worker de la clásica sin el worker: `crearSim` recibe el
// Module de createDbCore y una función `post(msg, transfer)`, y devuelve
// `{ handle(msg) }`. No toca el DOM, `self` ni `importScripts`; los relojes
// y timers se inyectan (por defecto, los de `globalThis`), así corre igual
// en un worker del navegador (engine/worker.js) y en node (tests).
//
// Regla 4 del brief intacta: esto NUNCA recalcula física ni RNG — solo llama
// a db_sim_* y empaqueta lo que el core vuelca. Mismas llamadas, en el mismo
// orden, que port/web/worker.js; mismo protocolo de mensajes (ver la
// cabecera de engine/worker.js) y mismo layout de frame (engine/protocolo.js).

import { crearImNet } from './imnet.js';
import {
  esCadaver,
  gruposValidos,
  HISTOGRAMAS,
  N_COMPORTAMIENTO,
  N_DOMINANTE,
  N_ESPECIE,
  N_LINAJE,
  N_METRICAS,
  N_ORIGEN,
} from './metricas.js';
import { EXTRA_MONITOR, EXTRA_SKINS, HEADER, REG, VIS_MAX_EVENTS } from './protocolo.js';
import { distintas, injertar, sinColaDeGuardado } from './variantes.js';

/**
 * @typedef {(msg: any, transfer?: Transferable[]) => void} Post
 */

/**
 * @typedef {object} OpcionesSim
 * @property {any} Module           Module de createDbCore (ya resuelto)
 * @property {Post} post            publica un mensaje hacia la página
 * @property {any} [imnet]          cliente IM (por defecto, crearImNet())
 * @property {() => number} [ahora] reloj monótono en ms (performance.now)
 * @property {() => Date} [fecha]   fecha de pared (vbNowSimStart, AssignSkin)
 * @property {(fn: () => void, ms: number) => any} [programar]  setTimeout
 * @property {() => number} [azar]  Math.random (colores de formas: capa host)
 */

/**
 * @param {OpcionesSim} opciones
 * @returns {{ handle: (msg: any) => void }}
 */
export function crearSim(opciones) {
  const M = opciones.Module;
  const postMessage = opciones.post;
  const ImNet = opciones.imnet ?? crearImNet();
  const ahora = opciones.ahora ?? (() => globalThis.performance.now());
  const fecha = opciones.fecha ?? (() => new Date());
  const programar = opciones.programar ?? ((fn, ms) => globalThis.setTimeout(fn, ms));
  const azar = opciones.azar ?? Math.random;
  // C15: fuente de los colores de las formas nuevas. Por defecto `azar`
  // (Math.random, como la clásica); un reset con `limpio` o `semillaColores`
  // la cambia por un LCG sembrado (ver resetSim).
  /** @type {() => number} */
  let azarFormas = azar;

  /** @type {Record<string, (...args: any[]) => any>} */
  let api = {}; // cwraps
  let sim = 0; // handle
  // PLAN-EDITOR E2.2: último trace-on pedido. Un handle nuevo arranca con la
  // traza apagada (db_sim_create) y db_sim_load conserva el interruptor; por
  // eso nuevoHandle() lo vuelve a aplicar.
  let trazaOn = false;

  let running = false;
  let speed = 4; // ticks por frame; 0 = máx
  let canPost = true; // el frame anterior ya fue devuelto con 'ack'
  let wantFrame = false; // hay estado nuevo pendiente de publicar
  let focusBot = 0; // robfocus (E2): 0 = sin selección
  // E6.5: número de la última selección de la página. Viaja en cada frame
  // para que la página distinga "el bot con foco murió" (focus 0 en un frame
  // que ya conoce la selección) de un frame armado antes del clic.
  let selSeq = 0;
  // N4.1 (nueva, opcional; la clásica no lo manda): {t:'pb', on:true,
  // seguirFoco:true}. Con el Player Bot encendido, KillRobot pasa robfocus
  // al último resaltado vivo (los hijos nacidos bajo control heredan el
  // resaltado) o lo pone en 0; sin el indicador el worker suelta el foco
  // cuando muere el bot (como la clásica), con él adopta el del core.
  let pbSeguir = false;

  /**
   * N4.1: el foco de la página pasa al robfocus del core si el core lo movió
   * (murió el bot controlado; también cubre que su slot ya lo ocupe otro).
   * Avisa con {t:'pb-focus', n, prev} (n = 0: no quedó nadie controlado).
   */
  function seguirFocoPb() {
    const f = api.getFocus(sim) | 0;
    if (f === focusBot) return;
    const prev = focusBot;
    focusBot = f > 0 ? f : 0;
    postMessage({ t: 'pb-focus', n: focusBot, prev });
  }

  // ticks/segundo medidos (va en stats de cada frame)
  let tickCount = 0;
  let tpsT = 0;
  let tps = 0;

  /**
   * @param {string} name
   * @param {string | null} ret
   * @param {string[]} args
   */
  const C = (name, ret, args) => M.cwrap(name, ret, args);

  function bindApi() {
    const n = 'number';
    const s = 'string';
    api = {
      create: C('db_sim_create', n, []),
      destroy: C('db_sim_destroy', null, [n]),
      start: C('db_sim_start', null, [n, n]),
      tick: C('db_sim_tick', null, [n]),
      setField: C('db_sim_set_field', null, [n, n, n]),
      fieldW: C('db_sim_field_width', n, [n]),
      fieldH: C('db_sim_field_height', n, [n]),
      setMinVegs: C('db_sim_set_minvegs', null, [n, n]),
      setMaxPop: C('db_sim_set_maxpop', null, [n, n]),
      setRepop: C('db_sim_set_repop', null, [n, n, n]),
      setMaxEnergy: C('db_sim_set_max_energy', null, [n, n]),
      setMutations: C('db_sim_set_mutations', null, [n, n]),
      setStartChlr: C('db_sim_set_start_chlr', null, [n, n]),
      setOpt: C('db_sim_set_opt', null, [n, n, n]),
      getOpt: C('db_sim_get_opt', n, [n, n]),
      setCost: C('db_sim_set_cost', null, [n, n, n]),
      getCost: C('db_sim_get_cost', n, [n, n]),
      addSpecies: C('db_sim_add_species', n, [n, s, s, n, n, n, n, n]),
      seedSpecies: C('db_sim_seed_species', n, [n, n, n]),
      numSpecies: C('db_sim_num_species', n, [n]),
      speciesName: C('db_sim_species_name', n, [n, n]),
      speciesMissing: C('db_sim_species_missing', n, [n, n]),
      speciesSetDna: C('db_sim_species_set_dna', null, [n, n, s]),
      cycle: C('db_sim_cycle', n, [n]),
      totalRobots: C('db_sim_total_robots', n, [n]),
      maxRobs: C('db_sim_max_robs', n, [n]),
      totvegs: C('db_sim_totvegs', n, [n]),
      shotsCap: C('db_sim_shots_capacity', n, [n]),
      numObstacles: C('db_sim_num_obstacles', n, [n]),
      numTeleporters: C('db_sim_num_teleporters', n, [n]),
      dumpBots: C('db_sim_dump_bots', n, [n, n, n]),
      dumpShots: C('db_sim_dump_shots', n, [n, n, n]),
      dumpTies: C('db_sim_dump_ties', n, [n, n, n]),
      dumpObstacles: C('db_sim_dump_obstacles', n, [n, n, n]),
      dumpTeleporters: C('db_sim_dump_teleporters', n, [n, n, n]),
      dumpFocus: C('db_sim_dump_focus', n, [n, n, n]),
      botText: C('db_sim_bot_text', n, [n, n]),
      addTeleporter: C('db_sim_add_teleporter', n, [n, n, n, n, n, n, n, n, n, n]),
      // E3 — menú Objects (transcripciones en wasm/dbcore_api.cpp)
      makeShape: C('db_sim_make_shape', n, [n, n, n]),
      addRandObs: C('db_sim_add_random_obstacles', n, [n, n, n, n]),
      delObstacle: C('db_sim_delete_obstacle', null, [n, n]),
      delAllObs: C('db_sim_delete_all_obstacles', null, [n]),
      delTenObs: C('db_sim_delete_ten_random_obstacles', null, [n]),
      obsColor: C('db_sim_obstacle_set_color', null, [n, n, n]),
      mazeH: C('db_sim_maze_horizontal', n, [n, n, n]),
      mazeV: C('db_sim_maze_vertical', n, [n, n, n]),
      mazeSpiral: C('db_sim_maze_spiral', n, [n, n, n]),
      mazeChecker: C('db_sim_maze_checkerboard', n, [n, n]),
      mazePolar: C('db_sim_maze_polar_ice', n, [n]),
      mazeTrash: C('db_sim_maze_trash_compactor', n, [n]),
      delTeleporter: C('db_sim_delete_teleporter', null, [n, n]),
      delAllTps: C('db_sim_delete_all_teleporters', null, [n]),
      // E5 — modos de juego
      f1Start: C('db_sim_f1_start', n, [n]),
      f1Contests: C('db_sim_f1_contests', n, [n]),
      f1TotSpecies: C('db_sim_f1_totspecies', n, [n]),
      f1Over: C('db_sim_f1_over', n, [n]),
      f1Cap: C('db_sim_f1_cap', n, [n, n]),
      f1PopCap: C('db_sim_f1_popcap', n, [n, n]),
      f1Pop: C('db_sim_f1_pop', n, [n, n]),
      f1Wins: C('db_sim_f1_wins', n, [n, n]),
      f1Name: C('db_sim_f1_name', n, [n, n]),
      f1Restore: C('db_sim_f1_restore', null, [n, n, n, n, n, n]),
      f1SetWins: C('db_sim_f1_set_wins', null, [n, n, n]),
      restartsCount: C('db_sim_restarts_count', n, [n]),
      startAnother: C('db_sim_start_another_round', n, [n]),
      clearAnother: C('db_sim_clear_start_another_round', null, [n]),
      events: C('db_sim_events', n, [n]),
      eventsWinner: C('db_sim_events_winner', n, [n]),
      eventsDq: C('db_sim_events_dq', n, [n]),
      eventsClear: C('db_sim_events_clear', null, [n]),
      pbOn: C('db_sim_pb_on', null, [n, n]),
      pbMouse: C('db_sim_pb_mouse', null, [n, n, n]),
      pbClearKeys: C('db_sim_pb_clear_keys', null, [n]),
      pbAddKey: C('db_sim_pb_add_key', n, [n, n, n, n]),
      pbKeyActive: C('db_sim_pb_key_active', null, [n, n, n]),
      setFocus: C('db_sim_set_focus', null, [n, n]),
      getFocus: C('db_sim_get_focus', n, [n]), // N4.1: foco del Player Bot
      // E6 - registro y analisis
      graphFeed: C('db_sim_graph_feed', n, [n, n, n, n]),
      graphName: C('db_sim_graph_series_name', n, [n, n]),
      graphSetQuery: C('db_sim_graph_set_query', null, [n, n, s]),
      graphGetQuery: C('db_sim_graph_get_query', n, [n, n]),
      graphGet: C('db_sim_graph_get', n, [n, n, n]),
      graphSet: C('db_sim_graph_set', null, [n, n, n, n]),
      snapRun: C('db_sim_snapshot_run', n, [n, n]),
      snapTake: C('db_sim_snapshot_take', n, [n, n]),
      deadRecords: C('db_sim_dead_records', n, [n]),
      deadTake: C('db_sim_dead_take', n, [n, n]),
      deadDrain: C('db_sim_dead_drain', null, [n]),
      deadReset: C('db_sim_dead_reset', null, [n]),
      fittest: C('db_sim_fittest', n, [n]),
      offspring: C('db_sim_offspring', n, [n, n, n]),
      highlightFam: C('db_sim_highlight_family', n, [n, n, n]),
      clearHighlight: C('db_sim_clear_highlight', null, [n]),
      familyLines: C('db_sim_family_lines', n, [n, n, n, n]),
      consoleOpen: C('db_sim_console_open', null, [n, n, n]),
      botGa: C('db_sim_bot_ga', n, [n, n, n, n]),
      botDbg: C('db_sim_bot_dbg', n, [n, n]),
      botMem: C('db_sim_bot_mem', n, [n, n, n]),
      botSetMem: C('db_sim_bot_set_mem', null, [n, n, n, n]),
      sysvarTok: C('db_sim_sysvar_tok', n, [n, n, s]),
      botSetNrg: C('db_sim_bot_set_nrg', null, [n, n, n]),
      execRobs: C('db_sim_exec_robs', null, [n]),
      botGenenum: C('db_sim_bot_genenum', n, [n, n]),
      botAbsnum: C('db_sim_bot_absnum', n, [n, n]),
      botName: C('db_sim_bot_name', n, [n, n]),
      save: C('db_sim_save', n, [n, n]),
      load: C('db_sim_load', null, [n, n, n]),
      free: C('db_free', null, [n]),
      lint: C('db_dna_lint', n, [s]),
      // PLAN-EDITOR E1: traza de un gen (ExecuteDNA sobre un bot descartable)
      traceDna: C('db_dna_trace', n, [s, n, n, n]),
      // PLAN-EDITOR E2: traza del bot con foco y volcado de memoria (solo lectura)
      traceOn: C('db_sim_trace_on', null, [n, n]),
      botTrace: C('db_sim_bot_trace', n, [n, n]),
      // PLAN-EDITOR E4: fundador suelto desde texto y mutación del bot. Solo
      // sobre la sim descartable de variantesDe (nunca sobre la del usuario).
      insertFounder: C('db_sim_insert_founder', n, [n, s, s, n, n, n]),
      botMutate: C('db_sim_bot_mutate', n, [n, n, n, n, n]),
      botMemDump: C('db_sim_bot_mem_dump', n, [n, n, n, n]),
      // E6.5 - vista enriquecida (solo lectura del Sim)
      visReset: C('db_sim_vis_reset', null, [n]),
      visObserve: C('db_sim_vis_observe', null, [n]),
      dumpBotsVis: C('db_sim_dump_bots_vis', n, [n, n, n]),
      visEvents: C('db_sim_vis_events', n, [n, n, n, n]),
      visSpVersion: C('db_sim_vis_species_version', n, [n]),
      visSpCount: C('db_sim_vis_species_count', n, [n]),
      visSpName: C('db_sim_vis_species_name', n, [n, n]),
      gendistRef: C('db_sim_vis_gendist_ref', null, [n, n]),
      gendistStep: C('db_sim_vis_gendist_step', n, [n, n]),
      // E7 - Internet Mode
      tpGet: C('db_sim_tp_get', n, [n, n, n]),
      tpCopy: C('db_sim_tp_copy', n, [n, n, n]),
      tpSet: C('db_sim_tp_set', null, [n, n, n, n]),
      outCount: C('db_sim_tp_outbox_count', n, [n, n]),
      outTake: C('db_sim_tp_outbox_take', n, [n, n, n]),
      inboxPush: C('db_sim_tp_inbox_push', null, [n, n, n, n]),
      setIName: C('db_sim_set_iname', null, [n, s]),
      getIName: C('db_sim_get_iname', n, [n]),
      setSimStart: C('db_sim_set_sim_start', null, [n, s]),
      imEnable: C('db_sim_im_enable', n, [n, n]),
      imDisable: C('db_sim_im_disable', n, [n]),
      imStats: C('db_sim_im_stats', n, [n]),
      imSpecies: C('db_sim_im_species', n, [n]),
      dboPeek: C('db_dbo_peek', n, [n, n]),
      // E8 - extras (monitor RGB y skins: campos de render del Type robot)
      monCapture: C('db_sim_monitor_capture', null, [n, n, n, n]),
      dumpMonitor: C('db_sim_dump_monitor', n, [n, n, n]),
      dumpSkins: C('db_sim_dump_skins', n, [n, n, n]),
      sysvarTok0: C('db_sim_sysvar_tok0', n, [n, s]),
      assignSkin: C('db_sim_species_assign_skin', null, [n, n, n]),
      // PP-03 - formas de la ronda/sim nueva (xObstacle, main.frm:1357-1365)
      obsRepop: C('db_sim_obs_repop', null, [n]),
      obsCarry: C('db_sim_obs_carry', null, [n, n]),
      obsRegen: C('db_sim_obs_regen', n, [n]),
      xobsCount: C('db_xobs_count', n, []),
      // RV-32..RV-35 (revision del port, piloto 12)
      roundCarry: C('db_sim_round_carry', null, [n, n]),
      roundSeed: C('db_sim_round_seed', n, [n]),
      roundSpecies: C('db_sim_round_species', null, [n, n]),
      startNewCarry: C('db_sim_startnew_carry', null, [n, n]),
      getBase: C('db_sim_get_base', n, [n, n]),
      optionsOk: C('db_sim_options_ok', null, [n]),
      // web2 E2/N2 - métricas de solo lectura (decisiones 6-9)
      metrics: C('db_sim_metrics', n, [n, n, n]),
      speciesStats: C('db_sim_species_stats', n, [n, n, n]),
      histogram: C('db_sim_histogram', n, [n, n, n, n, n, n]),
      behaviorEnable: C('db_sim_behavior_enable', null, [n, n]),
      behaviorTake: C('db_sim_behavior_take', n, [n, n, n]),
      dumpLineage: C('db_sim_dump_lineage', n, [n, n, n]),
      speciesOrigin: C('db_sim_species_origin', n, [n, n, n]),
      speciesDominant: C('db_sim_species_dominant', n, [n, n, n]),
    };
  }

  /** @param {string} msg */
  function log(msg) {
    postMessage({ t: 'log', msg });
  }
  // "1 shape" / "3 shapes"
  /**
   * @param {number} n
   * @param {string} w
   */
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  // String malloc'd del core -> JS (y liberar).
  /** @param {number} p */
  function takeStr(p) {
    if (!p) return '';
    const s = M.UTF8ToString(p);
    api.free(p);
    return s;
  }

  // Colores de las formas nuevas (índices from+1..numObstacles): decisión de
  // host (B7-5/Q01 — el original sorteaba Rnd*65536+Rnd*255+Rnd con Rnd crudo;
  // aquí la paleta es de la página y Math.random NO toca el RNG de la sim).
  /** @param {number} from */
  function recolorObstacles(from) {
    const n = api.numObstacles(sim);
    for (let i = from + 1; i <= n; i++) api.obsColor(sim, i, Math.floor(azarFormas() * 0x1000000));
    return n - from;
  }

  // ---- Búferes de volcado en el heap C (crecen bajo demanda) ----------------
  /** @typedef {{p: number, cap: number}} Scratch */
  /** @type {Record<string, Scratch>} */
  const scratch = {
    bots: { p: 0, cap: 0 },
    shots: { p: 0, cap: 0 },
    ties: { p: 0, cap: 0 },
    obs: { p: 0, cap: 0 },
    tps: { p: 0, cap: 0 },
    focus: { p: 0, cap: 0 },
    graph: { p: 0, cap: 0 },
    ga: { p: 0, cap: 0 },
    fam: { p: 0, cap: 0 },
    vis: { p: 0, cap: 0 },
    births: { p: 0, cap: 0 },
    deaths: { p: 0, cap: 0 },
    mon: { p: 0, cap: 0 },
    skin: { p: 0, cap: 0 },
    // N2: muestreo de métricas
    met: { p: 0, cap: 0 },
    spst: { p: 0, cap: 0 },
    hist: { p: 0, cap: 0 },
    beh: { p: 0, cap: 0 },
    lin: { p: 0, cap: 0 },
    orig: { p: 0, cap: 0 },
    dom: { p: 0, cap: 0 },
    // PLAN-EDITOR E1: memoria de ejemplo (1001 enteros) para db_dna_trace
    traceMem: { p: 0, cap: 0 },
    // PLAN-EDITOR E2: memoria del bot con foco (1000 enteros) para mem-dump
    mem: { p: 0, cap: 0 },
  };

  /**
   * @param {Scratch} b
   * @param {number} floatsNeeded
   */
  function ensure(b, floatsNeeded) {
    if (b.cap >= floatsNeeded || floatsNeeded === 0) return;
    if (b.p) M._free(b.p);
    b.cap = Math.ceil(floatsNeeded * 1.5) + 64;
    b.p = M._malloc(b.cap * 4);
  }
  // Vista fresca en cada uso: HEAPF32.buffer puede reubicarse (MEMORY_GROWTH).
  /**
   * @param {number} p
   * @param {number} floats
   */
  function heapView(p, floats) {
    return new Float32Array(M.HEAPF32.buffer, p, floats);
  }

  // ---- Pool de frames (ping-pong con la página) -----------------------------
  /** @type {ArrayBuffer[]} */
  const framePool = [];

  /** @param {number} floats */
  function takeFrameBuffer(floats) {
    const bytes = floats * 4;
    for (let i = 0; i < framePool.length; i++) {
      if (framePool[i].byteLength >= bytes) return framePool.splice(i, 1)[0];
    }
    // Alineado a 4: new Float32Array(buf) exige byteLength múltiplo de 4.
    return new ArrayBuffer((Math.ceil(bytes * 1.5) + 1024 + 3) & ~3);
  }
  /** @param {unknown} buf */
  function recycleFrameBuffer(buf) {
    if (buf instanceof ArrayBuffer && framePool.length < 2) framePool.push(buf);
  }

  // ---- Snapshot: 6 volcados del core → un solo búfer transferible -----------
  function buildFrame() {
    const maxB = api.maxRobs(sim);
    const shotCap = api.shotsCap(sim);
    const tieCap = maxB * 9;
    const obsCap = api.numObstacles(sim);
    const tpCap = api.numTeleporters(sim);

    ensure(scratch.bots, maxB * REG.bot);
    ensure(scratch.shots, shotCap * REG.shot);
    ensure(scratch.ties, tieCap * REG.tie);
    ensure(scratch.obs, obsCap * REG.obs);
    ensure(scratch.tps, tpCap * REG.tp);
    ensure(scratch.focus, REG.focus);
    if (rich) {
      ensure(scratch.vis, maxB * REG.vis);
      ensure(scratch.births, VIS_MAX_EVENTS * REG.evento);
      ensure(scratch.deaths, VIS_MAX_EVENTS * REG.evento);
    }

    const nB = maxB > 0 ? api.dumpBots(sim, scratch.bots.p, maxB) : 0;
    const nS = shotCap > 0 ? api.dumpShots(sim, scratch.shots.p, shotCap) : 0;
    const nT = tieCap > 0 ? api.dumpTies(sim, scratch.ties.p, tieCap) : 0;
    const nO = obsCap > 0 ? api.dumpObstacles(sim, scratch.obs.p, obsCap) : 0;
    const nP = tpCap > 0 ? api.dumpTeleporters(sim, scratch.tps.p, tpCap) : 0;
    // N4.1 (nueva, opcional): con {t:'pb', on:true, seguirFoco:true} el foco
    // sigue al robfocus del core antes de volcarlo.
    if (pbSeguir && focusBot > 0) seguirFocoPb();
    // Foco (E2): si el bot murió, dumpFocus devuelve 0 y el foco se apaga.
    const nF = focusBot > 0 ? api.dumpFocus(sim, focusBot, scratch.focus.p) : 0;
    if (!nF) focusBot = 0;
    // E6.5: mismo recorrido de slots que dumpBots → misma fila por bot.
    let nV = 0;
    let nBi = 0;
    let nDe = 0;
    if (rich) {
      nV = maxB > 0 ? api.dumpBotsVis(sim, scratch.vis.p, maxB) : 0;
      nBi = api.visEvents(sim, 0, scratch.births.p, VIS_MAX_EVENTS);
      nDe = api.visEvents(sim, 1, scratch.deaths.p, VIS_MAX_EVENTS);
      const ver = api.visSpVersion(sim);
      if (ver !== speciesVersion) {
        speciesVersion = ver;
        const names = [];
        for (let i = 0; i < api.visSpCount(sim); i++) names.push(takeStr(api.visSpName(sim, i)));
        postMessage({ t: 'species', names });
      }
    }

    // E8: mismo recorrido de slots que dumpBots → misma fila por bot.
    let nM = 0;
    let nK = 0;
    if (monitor.on && maxB > 0) {
      ensure(scratch.mon, maxB * REG.monitor);
      nM = api.dumpMonitor(sim, scratch.mon.p, maxB);
    }
    if (skinsOn && maxB > 0) {
      ensure(scratch.skin, maxB * REG.skin);
      nK = api.dumpSkins(sim, scratch.skin.p, maxB);
    }
    const extras = (nM === nB && nM ? EXTRA_MONITOR : 0) | (nK === nB && nK ? EXTRA_SKINS : 0);

    const total =
      HEADER +
      nB * REG.bot +
      nS * REG.shot +
      nT * REG.tie +
      nO * REG.obs +
      nP * REG.tp +
      nF * REG.focus +
      nV * REG.vis +
      (nBi + nDe) * REG.evento +
      (extras & EXTRA_MONITOR ? nB * REG.monitor : 0) +
      (extras & EXTRA_SKINS ? nB * REG.skin : 0);
    const buf = takeFrameBuffer(total);
    const v = new Float32Array(buf);
    v[0] = api.fieldW(sim);
    v[1] = api.fieldH(sim);
    v[2] = nB;
    v[3] = nS;
    v[4] = nT;
    v[5] = nO;
    v[6] = nP;
    v[7] = nF ? focusBot : 0;
    v[8] = rich && nV === nB ? 1 : 0;
    v[9] = nBi;
    v[10] = nDe;
    v[11] = api.cycle(sim);
    v[12] = extras;

    let off = HEADER;
    if (nB) {
      v.set(heapView(scratch.bots.p, nB * REG.bot), off);
      off += nB * REG.bot;
    }
    if (nS) {
      v.set(heapView(scratch.shots.p, nS * REG.shot), off);
      off += nS * REG.shot;
    }
    if (nT) {
      v.set(heapView(scratch.ties.p, nT * REG.tie), off);
      off += nT * REG.tie;
    }
    if (nO) {
      v.set(heapView(scratch.obs.p, nO * REG.obs), off);
      off += nO * REG.obs;
    }
    if (nP) {
      v.set(heapView(scratch.tps.p, nP * REG.tp), off);
      off += nP * REG.tp;
    }
    if (nF) {
      v.set(heapView(scratch.focus.p, REG.focus), off);
      off += REG.focus;
    }
    if (v[8]) {
      if (nV) {
        v.set(heapView(scratch.vis.p, nV * REG.vis), off);
        off += nV * REG.vis;
      }
      if (nBi) {
        v.set(heapView(scratch.births.p, nBi * REG.evento), off);
        off += nBi * REG.evento;
      }
      if (nDe) {
        v.set(heapView(scratch.deaths.p, nDe * REG.evento), off);
        off += nDe * REG.evento;
      }
    } else {
      v[9] = 0;
      v[10] = 0;
    }
    if (extras & EXTRA_MONITOR) {
      v.set(heapView(scratch.mon.p, nB * REG.monitor), off);
      off += nB * REG.monitor;
    }
    if (extras & EXTRA_SKINS) {
      v.set(heapView(scratch.skin.p, nB * REG.skin), off);
      off += nB * REG.skin;
    }
    return buf;
  }

  function postFrame() {
    if (!sim) return;
    if (!canPost) {
      wantFrame = true;
      return;
    }
    const buf = buildFrame();
    canPost = false;
    wantFrame = false;
    postMessage(
      {
        t: 'frame',
        buf,
        stats: {
          cycle: api.cycle(sim),
          bots: api.totalRobots(sim),
          vegs: Math.max(api.totvegs(sim), 0),
          tps,
          costx: api.getCost(sim, 54), // panel "CostX" (MDIForm1:3051)
          f1: f1Stats(), // E5: estado del contest (o null)
          dead: api.deadRecords(sim), // E6: snapshot de los muertos
          selSeq, // E6.5: ver arriba
        },
      },
      [buf],
    );
    if (activOn && focusBot) sendGenes(focusBot); // E6 (DNA.bas:1265)
    if (gdOn && running && !gdPumpQueued) gdPump(); // E6.5: una rebanada
  }

  // ---- E6.5: vista enriquecida ------------------------------------------------
  // Capa host pura (spec/PLAN-EXTENSIONES.md §E6.5): con la vista encendida el
  // worker llama a db_sim_vis_observe tras CADA tick (acumula en el wasm lo que
  // hizo cada bot; nada se publica a ritmo de tick — lección de E6) y el frame
  // lleva el bloque extendido. Nada de esto escribe en la sim ni consume RNG.
  let rich = false;
  let speciesVersion = -1;
  // Lente de distancia genética: DoGeneticDistance es O(DnaLen²) por par, así
  // que corre en rebanadas de ~3 ms por frame y como mucho una vuelta por
  // segundo con la sim corriendo; en pausa completa la vuelta y publica.
  let gdOn = false;
  let gdRoundDone = false;
  let gdLastRound = 0;
  let gdPumpQueued = false;

  function tickOnce() {
    api.tick(sim);
    // E8 — paso 23 (Master.bas:416-427): tras UpdateSim es el mismo instante
    // (los pasos 24-26 no tocan mem() ni crean bots).
    if (monitor.on) api.monCapture(sim, monitor.mem[0], monitor.mem[1], monitor.mem[2]);
    // N2: el acumulador de comportamiento comparte la foto de la vista
    // enriquecida y también exige un observe tras CADA tick (uno solo).
    if (rich || muestreo.beh) api.visObserve(sim);
  }

  // ---- N2: muestreo de métricas (decisiones 7-9, exports de E2) --------------
  // Capa host de SOLO LECTURA: los exports de E2 no escriben en el Sim ni
  // consumen RNG (port/tests/wasm/solo_lectura.mjs; en web2,
  // test/muestreo_worker.test.js compara el .dbsim con y sin muestreo).
  // Su único estado es del host: la tabla de especies de la vista (FName →
  // índice; los índices dependen de quién la llene primero, por eso todo lo
  // que sale de acá lleva el NOMBRE) y el acumulador de comportamiento.
  //
  // Es estado de orquestación, como la vista: sobrevive a reset (también al
  // `limpio`: no cambia el resultado de la sim), carga y ronda nueva; en
  // cada handle nuevo se vuelve a encender el acumulador.
  //
  // Costos: métricas, especies e histogramas son O(MaxRobs) por muestra (una
  // cada `cada` ciclos): despreciable. El grupo 'comportamiento' exige
  // db_sim_vis_observe tras cada tick, O(MaxRobs + maxshotarray) con una
  // búsqueda por nombre por bot, aunque la vista sea la clásica; con
  // `linaje`, db_sim_dump_lineage tras cada tick (O(MaxRobs)) para no perder
  // a los que nacen y mueren entre dos muestras. Medido en node con la vista
  // clásica (ms por tick, sin muestreo → sin comportamiento → los seis
  // grupos → más linaje): sopa primordial (~60 bots) 0,39 → 0,35 → 0,41 →
  // 0,45; depredador y presa (~130) 1,14 → 1,19 → 1,41 → 1,45; océano
  // (~190 vivos, ~1.500 bots con cadáveres) 13,3 → 14,4 → 14,8 → 16,4. Es
  // decir, del orden de +5-25 % con todo encendido.
  const muestreo = {
    /** ciclos entre muestras (0 = apagado) */
    cada: 0,
    /** @type {string[]} */
    grupos: [],
    /** acumulador de comportamiento encendido */
    beh: false,
    linaje: false,
    /** cada cuántas muestras va el ADN dominante (0 = nunca) */
    dominante: 0,
    bins: 20,
    vegMode: 0,
    /** @type {any} correlación del último {t:'muestreo'} (va en cada muestra) */
    req: undefined,
    /** ciclo de la última muestra (no se repite) */
    ultimo: -1,
    /** muestras publicadas desde el último muestreo/handle */
    cuenta: 0,
    /** AbsNum más alto ya visto por el linaje (los nuevos son mayores) */
    maxAbs: 0,
    /** @type {number[]} filas de linaje nacidas desde la última muestra */
    nacidos: [],
    /** @type {Map<string, number>} especie → hash del último ADN dominante mandado */
    hashes: new Map(),
  };

  /** Heap int32 → copia. @param {number} p @param {number} n */
  const copiaI32 = (p, n) => new Int32Array(M.HEAP32.buffer, p, n).slice();

  /** Nombres de la tabla de especies de la vista, por índice. */
  function nombresVista() {
    const out = [];
    const n = api.visSpCount(sim);
    for (let i = 0; i < n; i++) out.push(takeStr(api.visSpName(sim, i)));
    return out;
  }

  /** Handle nuevo o carga: el acumulador se enciende de nuevo y el linaje empieza de cero. */
  function muestreoRearmar() {
    muestreo.ultimo = -1;
    muestreo.cuenta = 0;
    muestreo.maxAbs = 0;
    muestreo.nacidos = [];
    muestreo.hashes.clear();
    if (sim && muestreo.beh) api.behaviorEnable(sim, 1);
  }

  /** @param {any} msg {t:'muestreo', cada?, grupos?, linaje?, dominante?, bins?, vegMode?, req?} */
  function configurarMuestreo(msg) {
    const cada = msg.cada === undefined ? 100 : Math.max(0, Math.trunc(+msg.cada) || 0);
    muestreo.cada = cada;
    muestreo.grupos = cada > 0 ? gruposValidos(msg.grupos) : [];
    const beh = muestreo.grupos.includes('comportamiento');
    if (sim && muestreo.beh && !beh) api.behaviorEnable(sim, 0);
    muestreo.beh = beh;
    muestreo.linaje = cada > 0 && !!msg.linaje;
    muestreo.dominante = cada > 0 ? Math.max(0, Math.trunc(+msg.dominante) || 0) : 0;
    muestreo.bins = Math.min(256, Math.max(1, Math.trunc(+msg.bins) || 20));
    muestreo.vegMode = [0, 1, 2].includes(msg.vegMode) ? msg.vegMode : 0;
    muestreo.req = msg.req;
    muestreoRearmar();
    // Punto de partida: una muestra ya (si la sim ya tuvo su primer ciclo).
    if (sim && cada > 0 && api.cycle(sim) >= 0) publicarMuestra();
  }

  /** Tras cada tick: acumula el linaje y, si toca, publica la muestra. */
  function muestreoTick() {
    if (muestreo.linaje) acumularNacidos();
    const c = api.cycle(sim);
    if (c >= 0 && c !== muestreo.ultimo && c % muestreo.cada === 0) publicarMuestra();
  }

  /** Vuelca el linaje y guarda las filas de los AbsNum que no se habían visto. */
  function acumularNacidos() {
    const filas = volcarLinaje();
    let max = muestreo.maxAbs;
    for (let i = 0; i < filas.length; i += N_LINAJE) {
      if (filas[i] > muestreo.maxAbs) {
        for (let k = 0; k < N_LINAJE; k++) muestreo.nacidos.push(filas[i + k]);
        if (filas[i] > max) max = filas[i];
      }
    }
    muestreo.maxAbs = max;
    return filas;
  }

  /** db_sim_dump_lineage de todos los bots existentes (copia). */
  function volcarLinaje() {
    const max = api.maxRobs(sim);
    ensure(scratch.lin, max * N_LINAJE);
    const n = max > 0 ? api.dumpLineage(sim, scratch.lin.p, max) : 0;
    return copiaI32(scratch.lin.p, n * N_LINAJE);
  }

  /** Linaje completo: filas actuales, origen de las especies y la tabla de nombres. */
  function linajeAhora() {
    const filas = volcarLinaje();
    const ns = api.visSpCount(sim) + 1;
    ensure(scratch.orig, ns * N_ORIGEN);
    const no = api.speciesOrigin(sim, scratch.orig.p, ns);
    const origen = copiaI32(scratch.orig.p, no * N_ORIGEN);
    // nombres después de los volcados: pueden registrar especies nuevas
    return { filas, origen, nombres: nombresVista() };
  }

  /**
   * ADN dominante de cada especie viva (sin «Corpse»). `soloNuevos` (el
   * muestreo periódico): el texto solo va si el hash cambió desde el último
   * mandado EN UNA MUESTRA para esa especie, y se recuerda. Sin él (el
   * pedido suelto {t:'dominante'}) va siempre y no toca esos hashes: si no,
   * una foto pedida suelta entre dos muestras haría que la muestra siguiente
   * no mandara el texto y la foto no llegaría a la corrida.
   * @param {boolean} soloNuevos
   */
  function dominantesAhora(soloNuevos) {
    const ns = api.visSpCount(sim) + api.maxRobs(sim) + 1; // cota: puede registrar especies
    ensure(scratch.dom, ns * N_DOMINANTE);
    const nd = api.speciesDominant(sim, scratch.dom.p, ns);
    const d = copiaI32(scratch.dom.p, nd * N_DOMINANTE);
    const nombres = nombresVista();
    const out = [];
    for (let r = 0; r < nd; r++) {
      const o = r * N_DOMINANTE;
      const nombre = nombres[d[o]] ?? '';
      if (!nombre || esCadaver(nombre)) continue;
      /** @type {{nombre: string, indice: number, slot: number, abs: number, copias: number,
       *   adnLen: number, hash: number, adn?: string}} */
      const e = {
        nombre,
        indice: d[o],
        slot: d[o + 1],
        abs: d[o + 2],
        copias: d[o + 3],
        adnLen: d[o + 4],
        hash: d[o + 5],
      };
      if (!soloNuevos || muestreo.hashes.get(nombre) !== e.hash) {
        e.adn = takeStr(api.botText(sim, e.slot));
        if (soloNuevos) muestreo.hashes.set(nombre, e.hash);
      }
      out.push(e);
    }
    return out;
  }

  /** Arma y publica {t:'muestra'} (ver la cabecera de engine/worker.js). */
  function publicarMuestra() {
    const ciclo = api.cycle(sim);
    muestreo.ultimo = ciclo;
    /** @type {Transferable[]} */
    const transfer = [];
    ensure(scratch.met, N_METRICAS);
    api.metrics(sim, scratch.met.p, N_METRICAS);
    const metrics = heapView(scratch.met.p, N_METRICAS).slice();
    transfer.push(metrics.buffer);

    const ns = api.visSpCount(sim) + api.maxRobs(sim) + 1; // cota de especies vivas
    ensure(scratch.spst, ns * N_ESPECIE);
    const nst = api.speciesStats(sim, scratch.spst.p, ns);
    const st = heapView(scratch.spst.p, nst * N_ESPECIE).slice();
    transfer.push(st.buffer);

    /** @type {Float32Array | null} */
    let bh = null;
    let nbh = 0;
    if (muestreo.beh) {
      // En tandas hasta que devuelva 0 (vacía lo leído).
      const nsb = api.visSpCount(sim) + 1;
      ensure(scratch.beh, nsb * N_COMPORTAMIENTO);
      /** @type {Float32Array[]} */
      const partes = [];
      for (let k = 0; k < 64; k++) {
        const r = api.behaviorTake(sim, scratch.beh.p, nsb);
        if (r <= 0) break;
        partes.push(heapView(scratch.beh.p, r * N_COMPORTAMIENTO).slice());
        nbh += r;
      }
      bh = new Float32Array(nbh * N_COMPORTAMIENTO);
      let off = 0;
      for (const p of partes) {
        bh.set(p, off);
        off += p.length;
      }
      transfer.push(bh.buffer);
    }

    /** @type {any} */
    let hist = null;
    if (muestreo.grupos.includes('genetica')) {
      const b = muestreo.bins;
      ensure(scratch.hist, b + 2);
      const datos = new Float32Array(HISTOGRAMAS.length * (b + 2));
      const n = new Int32Array(HISTOGRAMAS.length);
      for (let k = 0; k < HISTOGRAMAS.length; k++) {
        n[k] = api.histogram(sim, k, -1, muestreo.vegMode, b, scratch.hist.p);
        datos.set(heapView(scratch.hist.p, b + 2), k * (b + 2));
      }
      hist = { bins: b, vegMode: muestreo.vegMode, n, datos };
      transfer.push(datos.buffer, n.buffer);
    }

    /** @type {any} */
    let linaje = null;
    if (muestreo.linaje) {
      const l = linajeAhora();
      // los vivos de ahora que el último tick no alcanzó a ver (p. ej. la
      // muestra de partida) también son nacidos para quien la recibe
      for (let i = 0; i < l.filas.length; i += N_LINAJE)
        if (l.filas[i] > muestreo.maxAbs)
          for (let k = 0; k < N_LINAJE; k++) muestreo.nacidos.push(l.filas[i + k]);
      for (let i = 0; i < l.filas.length; i += N_LINAJE)
        if (l.filas[i] > muestreo.maxAbs) muestreo.maxAbs = l.filas[i];
      const nacidos = Int32Array.from(muestreo.nacidos);
      muestreo.nacidos = [];
      linaje = { ...l, nacidos };
      transfer.push(l.filas.buffer, l.origen.buffer, nacidos.buffer);
    }

    /** @type {any} */
    let dominante = null;
    if (muestreo.dominante > 0 && muestreo.cuenta % muestreo.dominante === 0)
      dominante = dominantesAhora(true);

    // Nombres al final: los volcados de arriba pueden registrar especies.
    const nombres = nombresVista();
    const especies = [];
    for (let r = 0; r < nst; r++) {
      const stats = st.subarray(r * N_ESPECIE, (r + 1) * N_ESPECIE);
      const nombre = nombres[stats[0]] ?? '';
      if (!nombre || esCadaver(nombre)) continue;
      especies.push({ nombre, indice: stats[0], stats });
    }
    /** @type {any} */
    let comportamiento = null;
    if (bh) {
      comportamiento = [];
      for (let r = 0; r < nbh; r++) {
        const datos = bh.subarray(r * N_COMPORTAMIENTO, (r + 1) * N_COMPORTAMIENTO);
        const nombre = nombres[datos[0]] ?? '';
        if (!nombre || esCadaver(nombre)) continue;
        comportamiento.push({ nombre, indice: datos[0], datos });
      }
    }
    muestreo.cuenta++;
    postMessage(
      {
        t: 'muestra',
        ...(muestreo.req !== undefined ? { req: muestreo.req } : {}),
        ciclo,
        cada: muestreo.cada,
        grupos: muestreo.grupos,
        metrics,
        especies,
        histogramas: hist,
        comportamiento,
        linaje,
        dominante,
      },
      transfer,
    );
  }

  // ---- E8: extras ------------------------------------------------------------
  // Monitor RGB: MonitorOn.Checked + las 3 direcciones de frmMonitorSet (el
  // piso/techo solo los usa DrawMonitor: viven en la página). Skins:
  // Form1.dispskin, que arranca en True (main.frm:394).
  const monitor = { on: false, mem: [1, 1, 1] };
  let skinsOn = true;
  const EYE1DIR = 521; // Robots.bas:106
  const EYE1WIDTH = 531; // Robots.bas:115

  // La sim cambió de handle o de slots (reset, ronda nueva, carga): la
  // referencia de la lente ya no vale y la página tiene que enterarse.
  function gdDrop() {
    if (gdOn) postMessage({ t: 'gendist-off' });
    gdOn = false;
  }

  function visPrime() {
    // N2: con el acumulador de comportamiento también (sembrar no es nacer).
    if ((rich || muestreo.beh) && sim) api.visReset(sim);
  }

  function gdPump() {
    gdPumpQueued = false;
    if (!gdOn || !sim) return;
    if (gdRoundDone) {
      if (!running || ahora() - gdLastRound < 1000) return;
      gdRoundDone = false; // vuelta nueva: el cursor ya volvió a 1
    }
    const t0 = ahora();
    let r = 0;
    do {
      r = api.gendistStep(sim, 4);
    } while (r === 0 && ahora() - t0 < 3);
    if (r === -1) {
      gdOn = false;
      postMessage({ t: 'gendist-off' });
      return;
    }
    if (r === 1) {
      gdRoundDone = true;
      gdLastRound = ahora();
      if (!running) postFrame();
    } else if (!running) {
      gdPumpQueued = true;
      programar(gdPump, 0);
    }
  }

  // ---- E5: eventos del tick y rondas ----------------------------------------

  // Estado del contest para las stats de cada frame (null si no hay contest).
  function f1Stats() {
    if (!api.f1TotSpecies(sim)) return null;
    const sp = [];
    // Hasta 20 especies (PopArray(1 To 20), F1Mode.bas:59): la barra de
    // estado y el marcador de contest.js las muestran todas.
    const n = Math.min(api.f1TotSpecies(sim), 20);
    for (let i = 1; i <= n; i++)
      sp.push({
        name: takeStr(api.f1Name(sim, i)),
        pop: api.f1Pop(sim, i),
        wins: api.f1Wins(sim, i),
        capWins: f1CapWins[i] || 0,
      });
    return {
      contests: api.f1Contests(sim),
      minrounds: api.getOpt(sim, 97),
      over: api.f1Over(sim),
      restarts: api.restartsCount(sim),
      sp,
    };
  }

  // Ronda nueva: el While StartAnotherRound del host original
  // (OptionsForm.frm:4805-4809 + MDIForm1:2166-2170). El mundo se reconstruye
  // con seed nueva (SimOpts.UserSeedNumber = Rnd * 2147483647 — Rnd de HOST,
  // no toca el RNG de la sim) y el estado de módulo F1Mode sobrevive
  // (Contests/Wins/MinRounds/ReStarts; FindSpecies preserva Wins por slot).
  // Ids de db_sim_set_opt que en el original son checks de menú de MDIForm1
  // (main.frm:1259-1269 los refleja) y no del diálogo de opciones.
  const MENU_OPT_IDS = new Set([54, 55, 70, 71, 72, 111, 112]);
  // SimOpts que la ronda hereda de la sim que termina (tabla de ids de
  // wasm/dbcore_api.cpp; los de modos de juego 90-101 los restaura newRound).
  const ROUND_OPT_IDS = [
    1, 2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
    40, 41, 50, 51, 52, 53, 54, 55, 56, 60, 61, 62, 63, 64, 70, 71, 72, 80, 81, 82, 83, 84, 85, 110,
    111, 112,
  ];

  function newRound() {
    // PP-03 (revisión): StartSimul no toca SimOpts salvo lo que el propio
    // arranque rehace (main.frm:1182-1368): las opciones en vivo — y las que
    // escribió la sim, como la deriva de Polar Ice o el COSTMULTIPLIER de los
    // costes dinámicos — pasan a la ronda. Los ids 90-101 van aparte (abajo).
    /** @type {Record<number, number>} */
    const opts = {};
    for (const id of ROUND_OPT_IDS) opts[id] = api.getOpt(sim, id);
    /** @type {Record<number, number>} */
    const costs = {};
    for (let i = 0; i <= 70; i++) costs[i] = api.getCost(sim, i);
    const keep = {
      contests: api.f1Contests(sim),
      minrounds: api.getOpt(sim, 97),
      optminrounds: api.getOpt(sim, 101),
      over: api.f1Over(sim),
      restarts: api.restartsCount(sim),
      restart: api.getOpt(sim, 90),
      f1: api.getOpt(sim, 91),
      dq: api.getOpt(sim, 93),
      maxrounds: api.getOpt(sim, 98),
      maxcycles: api.getOpt(sim, 99),
      maxpop: api.getOpt(sim, 100),
      /** @type {number[]} */
      wins: [],
    };
    for (let i = 1; i <= 20; i++) keep.wins.push(api.f1Wins(sim, i));
    // RV-34: `SimOpts.UserSeedNumber = Rnd * 2147483647` con el LCG de la sim
    // que termina (OptionsForm.frm:4809, MDIForm1.frm:2168).
    const seed = api.roundSeed(sim);
    const wasRunning = running;
    // E7: StartSimul no toca Teleporters() (solo LoadSimulation los
    // reinicia, HDRoutines.bas:1332) y la ronda no pasa por StartNew_Click
    // (OptionsForm.frm:4802, que apagaría Internet): los teleporters — el
    // puerto Internet con su inbox incluido — pasan tal cual al handle nuevo,
    // sin RNG.
    // RV-38: las opciones base y la lista de especies salen de la sim que
    // termina — tras una carga, las del archivo (MDIForm1.frm:2166-2170) —,
    // no del último "Start New". La lista la copia resetSim (loadrobs siembra
    // SimOpts.Specie, main.frm:1517).
    /** @param {number} k */
    const base = (k) => api.getBase(sim, k);
    resetSim(
      {
        seed,
        species: [],
        options: {
          fieldW: api.fieldW(sim),
          fieldH: api.fieldH(sim),
          minVegs: base(0),
          repopAmount: base(1),
          repopCooldown: base(2),
          maxEnergy: base(3),
          startChlr: base(4),
          mutations: !!base(5),
          maxPopulation: base(6),
          opts,
          costs,
        },
      },
      true,
    );
    if (imCfg) imInboxKnown = imPort() ? api.tpGet(sim, imPort(), 13) : 0;
    api.setOpt(sim, 90, keep.restart);
    api.setOpt(sim, 91, keep.f1);
    api.setOpt(sim, 93, keep.dq);
    api.setOpt(sim, 97, keep.optminrounds); // fija MinRounds + optMinRounds
    api.setOpt(sim, 98, keep.maxrounds);
    api.setOpt(sim, 99, keep.maxcycles);
    api.setOpt(sim, 100, keep.maxpop);
    api.f1Restore(
      sim,
      keep.contests,
      keep.minrounds,
      keep.optminrounds,
      keep.over ? 1 : 0,
      keep.restarts,
    );
    for (let i = 1; i <= 20; i++) api.f1SetWins(sim, i, keep.wins[i - 1]);
    // FindSpecies corre aquí después de la regeneración de formas de resetSim
    // (en StartSimul va antes, main.frm:1337-1340 vs :1357): no consume RNG ni
    // lee formas, así que el orden no se observa.
    const ts = api.f1Start(sim);
    log(`new round (seed ${seed})${ts ? ` — contest: round ${api.f1Contests(sim) + 1}` : ''}`);
    running = wasRunning;
  }

  // Tras cada tanda de ticks: eventos E5 del core + gate de rondas.
  function checkGameState() {
    if (!sim) return false;
    f1CapSettle();
    let stopped = false;
    const ev = api.events(sim);
    if (ev) {
      if (ev & (1 << 13))
        for (const line of takeStr(api.eventsDq(sim)).split('\n')) if (line) log(`DQ: ${line}`);
      if (ev & (1 << 10))
        log(`F1: winner ${takeStr(api.eventsWinner(sim))} (${api.f1Contests(sim) + 1} rounds)`);
      if (ev & (1 << 11)) {
        log('F1: only one species — mode disabled');
        postMessage({ t: 'f1-note', kind: 'single' });
      }
      if (ev & (1 << 12)) {
        log('F1: more than 2 species — cycle/population limits disabled');
        postMessage({ t: 'f1-note', kind: 'many' });
      }
      if (ev & (1 << 1)) log('evo: Mutate extinct (evo lost)');
      if (ev & (1 << 2)) log('evo: Base extinct (evo won)');
      if (ev & (1 << 3)) log('seeding: round complete (cycle 2000)');
      if (ev & (1 << 4)) log('zerobot: restart needed');
      if (ev & (1 << 6)) log('zerobot: ready for the test stage');
      if (ev & (1 << 8)) log('zerobot: test passed');
      if (ev & (1 << 9)) log('zerobot: test failed');
      const winner = ev & (1 << 10) ? takeStr(api.eventsWinner(sim)) : '';
      stopped = !!(ev & 1);
      api.eventsClear(sim);
      // E10: el marcador final y los ciclos jugados viajan con el aviso (las
      // ligas no dependen de que llegue un frame; en segundo plano casi no hay).
      if (ev & (1 << 10))
        postMessage({ t: 'f1-over', winner, f1: f1Stats(), cycles: f1CycAcc + api.cycle(sim) });
      if (stopped) {
        // Form1.Active = False del original: la sim queda pausada.
        running = false;
        postMessage({ t: 'stopped' });
        postFrame();
      }
    }
    if (api.startAnother(sim)) {
      api.clearAnother(sim);
      // Con parada del core en este mismo chequeo (ganador declarado con
      // StartAnotherRound colgado del mismo Countpop, F1Mode.bas:364+380) el
      // original queda detenido en el mundo final: no se abre otra ronda.
      if (!stopped) {
        f1CycAcc += api.cycle(sim);
        newRound();
        return true;
      }
    }
    return false;
  }

  // ---- E6: registro y análisis ---------------------------------------------
  // Gráficas: el loop del original alimenta cada SimOpts.chartingInterval
  // ciclos y SOLO los charts visibles (main.frm:2098-2107). Aquí `graphOpen`
  // es el espejo de Charts(i).graf.Visible; el core guarda graphvisible(n) en
  // sim.evo (lo persiste el formato de sim, HDRoutines.bas:802).
  /** @type {Set<number>} */
  const graphOpen = new Set();
  // ActivForm.Visible del original: con la ventana abierta, DNA.bas:1265 llama
  // a exechighlight para el bot con foco en CADA ciclo. Aqui el push viaja con
  // el frame (una vez por frame dibujado, no por tick).
  let activOn = false;

  /** @param {number} n */
  function feedGraph(n) {
    if (!sim) return;
    ensure(scratch.graph, 76 * 2);
    const nS = api.graphFeed(sim, n, scratch.graph.p, 76);
    const v = heapView(scratch.graph.p, Math.max(nS, 1) * 2);
    const series = [];
    for (let i = 0; i < nS; i++)
      series.push({
        name: takeStr(api.graphName(sim, i + 1)),
        color: v[i * 2 + 1],
        value: v[i * 2],
      });
    postMessage({
      t: 'graph-data',
      n,
      series,
      cycle: api.cycle(sim),
      interval: api.getOpt(sim, 110),
    });
  }

  // main.frm:2174-2201 NewGraph: registra el chart y lo alimenta ya mismo
  // ("EricL - Get the first data point and show the graph key right from the
  // start").
  /** @param {number} n */
  function openGraph(n) {
    graphOpen.add(n);
    api.graphSet(sim, n, 0, 1); // graphvisible(n) = True (Form_Activate)
    feedGraph(n);
  }
  /** @param {number} n */
  function closeGraph(n) {
    graphOpen.delete(n);
    if (sim) api.graphSet(sim, n, 0, 0);
  }

  // ---- Consola del bot (console.frm:evnt_textentered) ----------------------
  const CONSOLE_HELP = [
    '',
    'This console works as an input/output interface for a single robot.',
    'It could be used for robot debugging and manipulation.',
    'One of the most useful features of the r.c. is that it shows',
    'which parts of the dna are executed in each cycle. Just press the single',
    'cycle button to try. To watch the entire dna, just click the button at',
    'the extreme right in the console.',
    '',
    'Other commands are:',
    'printeye : prints the eye cells status',
    'printtouch : prints the touch cells status',
    'printtaste : prints the taste (hit) cells status',
    'printmem (or ?) (.var|n): prints value of .var or location n',
    'set (.var|n) value : stores value in variable .var or location n',
    'energy e : sets the robot’s energy at e',
    'cycle n : executes n cycles',
    'execrob : executes all robots without doing a cycle',
    'showdna : brings up the robot details window showing the robot’s dna',
    'debug : fires one cycle with debugger enabled',
  ];

  // Direcciones que usan printeye/printtouch/printtaste (memmap del core).
  const A = {
    EyeStart: 500,
    EYEF: 510,
    FOCUSEYE: 511,
    EYE1DIR: 521,
    EYE1WIDTH: 531,
    hitup: 205,
    hitdn: 206,
    hitdx: 207,
    hitsx: 208,
    shup: 210,
    shdn: 211,
    shdx: 212,
    shsx: 213,
  };

  /**
   * @param {number} n
   * @param {string} text
   */
  function conOut(n, text) {
    postMessage({ t: 'console-out', n, text });
  }

  // console.frm:398-407 — `Dim v As Integer: v = val(w)`; si 0, SysvarTok.
  // printmem: val() primero, sysvar despues; el rango impreso es 0 < v < 1000
  // (el fuente excluye mem(1000)).
  /**
   * @param {number} n
   * @param {string} w
   */
  function printmem(n, w) {
    let v = vbCInt(parseFloat(w) || 0);
    if (v === 0) v = api.sysvarTok(sim, n, w || '');
    if (v > 0 && v < 1000) conOut(n, ` ${v}-> ${api.botMem(sim, n, v)}`);
  }

  /**
   * @param {number} n
   * @param {string} line
   */
  function consoleCmd(n, line) {
    const words = String(line).split(' ');
    /** @param {number} i */
    const w = (i) => (i < words.length ? words[i] : '');
    switch (words[0]) {
      case 'debug':
        // El botón `debug` del original dispara un ciclo con el debugger:
        // aquí la traza ya la escribe la VM en cada tick (dbgstring).
        conOut(n, `***ROBOT DEBUG***${takeStr(api.botDbg(sim, n))}`);
        break;
      case 'printeye': {
        let s = 'EyeN: ';
        for (let t = 1; t <= 9; t++) s += ` ${api.botMem(sim, n, A.EyeStart + t)}`;
        s += ` .eyef: ${api.botMem(sim, n, A.EYEF)} .focuseye: ${api.botMem(sim, n, A.FOCUSEYE)}`;
        s += '\nEyeNDir: ';
        for (let t = 0; t <= 8; t++) s += ` ${api.botMem(sim, n, A.EYE1DIR + t)}`;
        s += '\nEyeNWidth: ';
        for (let t = 0; t <= 8; t++) s += ` ${api.botMem(sim, n, A.EYE1WIDTH + t)}`;
        conOut(n, s);
        break;
      }
      case 'printtouch':
        conOut(
          n,
          `Up: ${api.botMem(sim, n, A.hitup)} Dn: ${api.botMem(sim, n, A.hitdn)}` +
            ` Sx: ${api.botMem(sim, n, A.hitsx)} Dx: ${api.botMem(sim, n, A.hitdx)}`,
        );
        break;
      case 'printtaste':
        conOut(
          n,
          `Up: ${api.botMem(sim, n, A.shup)} Dn: ${api.botMem(sim, n, A.shdn)}` +
            ` Sx: ${api.botMem(sim, n, A.shsx)} Dx: ${api.botMem(sim, n, A.shdx)}`,
        );
        break;
      case 'cycle': {
        const k = parseInt(w(1), 10) || 0;
        for (let i = 0; i < k; i++) {
          tickOnce();
          if (imCfg) imDrainOutbox();
          if (!checkGameState() && imCfg) imAfterTick();
          // N2: como en runTicks, el muestreo (y los nacidos del linaje)
          // en cada tick; sin muestreo (la clásica) no hace nada
          if (muestreo.cada > 0) muestreoTick();
        }
        postFrame();
        conOut(n, `${k} cycle(s) run — cycle ${api.cycle(sim)}`);
        sendGenes(n);
        break;
      }
      case 'energy':
        api.botSetNrg(sim, n, parseFloat(w(1)) || 0);
        break;
      case 'play':
        running = true;
        loop();
        postMessage({ t: 'running', running: true });
        break;
      case 'pause':
        running = false;
        postMessage({ t: 'running', running: false });
        break;
      case 'set': {
        // console.frm:360-362: mem(SysvarTok(x)) = val(v), con CInt bancario
        // en la dirección (SysvarTok -> val) y en el valor (RV-37).
        const val = parseFloat(w(2)) || 0;
        if (Math.abs(val) < 32001) {
          const v = api.sysvarTok(sim, n, w(1));
          api.botSetMem(sim, n, v, vbCInt(val));
          printmem(n, w(1));
        } else {
          conOut(n, 'Value out of range.  Memory values must be between -32000 and 32000.');
        }
        break;
      }
      case 'printmem':
      case '?':
        printmem(n, w(1));
        break;
      case 'execrob':
        api.execRobs(sim);
        postFrame();
        sendGenes(n);
        break;
      case 'showdna': {
        const p = api.botText(sim, n);
        let text = '';
        if (p) {
          text = M.UTF8ToString(p);
          api.free(p);
        }
        postMessage({ t: 'bot-text', n, text });
        break;
      }
      case 'help':
        for (const l of CONSOLE_HELP) conOut(n, l);
        break;
      default:
        break; // el original ignora lo que no reconoce
    }
  }

  // DNA.bas:1254-1263 — la lista de genes ejecutados que la consola imprime
  // tras cada ciclo, y el mismo dato que come ActivForm.DrawGrid.
  /** @param {number} n */
  function sendGenes(n) {
    ensure(scratch.ga, 512);
    const c = api.botGa(sim, n, scratch.ga.p, 512);
    const g = new Int32Array(M.HEAP32.buffer, scratch.ga.p, Math.max(c, 1));
    postMessage({ t: 'genes', n, ga: Array.from(g.subarray(0, c)) });
  }

  // ---- E7: Internet Mode ----------------------------------------------------
  // El toggle es F1Internet_Click (MDIForm1.frm:1259-1380, transcrito en
  // db_sim_im_enable/disable) y el transporte es el cliente IM de imnet.js,
  // que hace lo que hacía DarwinbotsIM.exe con las carpetas inbound/outbound.
  // Tras cada tick con IM encendido: el outbox del teleporter Internet se
  // vacía hacia el cliente y, cada 200 ciclos, sale el .stats de writeIMdata
  // (main.frm:2109-2111). Lo que llega entra al inbox y el paso 18 del core lo
  // carga a su ritmo (InboundPollCycles/BotsPerPoll y el gate de 45 especies).
  /** @type {{name: string, kind: string, url: string, room: string} | null} */
  let imCfg = null; // con IM encendido; si no, null
  let imName = ''; // IntOpts.IName: global de proceso (sobrevive resets)
  // teleporterDefaultWidth (Teleport.bas:56): 0 hasta que se usa el form de
  // teleporters (TeleportForm.frm:378 lo pone en 300); entra al sorteo de la
  // posición del puerto Internet.
  let tpDefaultWidth = 0;
  // Lo que está en el inbox del puerto, en orden FIFO: {label, bytes}. Se
  // guardan los bytes porque el inbox puede perderse sin haberse cargado
  // (LoadSimulation borra el puerto; apagar lo borra): esos registros ya
  // confirmados pasan a imHeld y entran en el próximo puerto — como los
  // archivos que quedaban en la carpeta inbound del original.
  /** @typedef {{label: string, bytes: Uint8Array}} Llegada */
  /** @type {Llegada[]} */
  let imArrivals = [];
  /** @type {Llegada[]} */
  let imHeld = [];
  let imInboxKnown = 0; // registros que el inbox tenía tras el último tick
  /** @type {string[]} */
  let imLogBuf = [];
  /** @type {any} */
  let imLogTimer = 0;
  /** @type {any} */
  let imStateTimer = 0;

  /** @param {string} line */
  function imLog(line) {
    imLogBuf.push(line);
    if (!imLogTimer)
      imLogTimer = programar(() => {
        imLogTimer = 0;
        const lines = imLogBuf;
        imLogBuf = [];
        if (lines.length > 40) lines.splice(20, lines.length - 40, `… (${lines.length - 40} more)`);
        postMessage({ t: 'im-log', lines });
      }, 250);
  }

  function imState() {
    if (imStateTimer) return;
    imStateTimer = programar(() => {
      imStateTimer = 0;
      const st = ImNet.snapshot();
      st.enabled = !!imCfg;
      st.port = imPort();
      st.inbox = st.port ? api.tpGet(sim, st.port, 13) : 0;
      st.inTotal = st.port ? api.tpGet(sim, st.port, 12) : 0;
      st.outTotal = st.port ? api.tpGet(sim, st.port, 11) : 0;
      postMessage({ t: 'im-state', st });
    }, 250);
  }

  // Primer teleporter Internet de la sim (0 si no hay: p. ej. lo borraron).
  function imPort() {
    if (!sim) return 0;
    const n = api.numTeleporters(sim);
    for (let i = 1; i <= n; i++) if (api.tpGet(sim, i, 3)) return i;
    return 0;
  }

  /**
   * @param {number} p
   * @param {number} len
   */
  function peekLabel(p, len) {
    const f = takeStr(api.dboPeek(p, len)).split('\t');
    if (f.length < 7) return { label: 'organism', owner: '' };
    const cells = +f[0];
    return { label: f[1] + (cells > 1 ? ` (${cells} cells)` : ''), owner: f[2] };
  }

  // Hook del cliente IM: un .dbo para esta sim. Devuelve false si no hay
  // puerto Internet (sin ack: el emisor lo re-sortea hacia otro par).
  /**
   * @param {Uint8Array} bytes
   * @param {string} from
   */
  function imOnDbo(bytes, from) {
    const tp = imPort();
    if (!imCfg || !tp) return false;
    const p = M._malloc(bytes.length);
    M.HEAPU8.set(bytes, p);
    const meta = peekLabel(p, bytes.length);
    api.inboxPush(sim, tp, p, bytes.length);
    M._free(p);
    imArrivals.push({ label: `${meta.label} from ${meta.owner || from}`, bytes });
    imInboxKnown += 1;
    imState();
    return true;
  }

  // Los registros de un inbox que se pierde quedan retenidos (ya se
  // confirmaron al emisor: no pueden volver a la red).
  function imHoldInbox() {
    for (const a of imArrivals) imHeld.push(a);
    imArrivals = [];
    imInboxKnown = 0;
  }

  // Puerto nuevo: entra lo retenido, en orden.
  /** @param {number} tp */
  function imFlushHeld(tp) {
    const held = imHeld;
    imHeld = [];
    for (const a of held) {
      const p = M._malloc(a.bytes.length);
      M.HEAPU8.set(a.bytes, p);
      api.inboxPush(sim, tp, p, a.bytes.length);
      M._free(p);
      imArrivals.push(a);
    }
    imInboxKnown = api.tpGet(sim, tp, 13);
    return held.length;
  }

  // Replace(Replace(Now, ":", "-"), "/", "-") de main.frm:1351 con el Now de
  // VB6 en formato de EE. UU. (el original dependía de la configuración
  // regional de Windows).
  function vbNowSimStart() {
    const d = fecha();
    let h = d.getHours();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    /** @param {number} x */
    const p2 = (x) => String(x).padStart(2, '0');
    return (
      `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()} ` +
      `${h}-${p2(d.getMinutes())}-${p2(d.getSeconds())} ${ap}`
    );
  }

  function simStartOf() {
    // El JSON de writeIMdata lleva simId = strSimStart.
    const t = takeStr(api.imStats(sim));
    const m = /"simId":"([^"]*)"/.exec(t);
    return m ? m[1] : '';
  }

  // F1Internet_Click, encendido: puerto + cliente. Devuelve true si quedó on.
  /** @param {{name: string, kind: string, url: string, room: string}} cfg */
  function imEnable(cfg) {
    if (!sim) return false;
    api.setIName(sim, cfg.name || '');
    const i = api.imEnable(sim, tpDefaultWidth);
    if (i <= -100) {
      const mode = -100 - i;
      log(
        `Internet: cannot be enabled with restart mode ${mode} ` +
          '(Internet Mode needs a different restart mode)',
      );
      return false;
    }
    if (i < 0) {
      log('Internet: teleporter cap (10) — could not create the port');
      return false;
    }
    imName = takeStr(api.getIName(sim)); // "Newbie N" si venía vacío
    imCfg = { ...cfg, name: imName };
    imArrivals = [];
    imInboxKnown = 0;
    const held = imFlushHeld(i);
    if (held) log(`Internet: ${plural(held, 'held organism')} moved into the new port`);
    ImNet.start(
      { name: imName, simId: simStartOf(), kind: cfg.kind, url: cfg.url, room: cfg.room },
      { onDbo: imOnDbo, onChange: imState, onLog: imLog },
    );
    log(
      `Internet Mode: port #${i} (${cfg.kind === 'ws' ? `relay ${cfg.url}` : 'tabs of this browser'}, ` +
        `room "${cfg.room}") as "${imName}"`,
    );
    imState();
    postFrame();
    return true;
  }

  // Rama de apagado: el cliente se va (CloseWindow) y los puertos Internet se
  // borran. Nada se pierde: lo que esperaba salir sigue en la cola del cliente
  // (la carpeta outbound) y lo que estaba en el inbox queda retenido (la
  // inbound); todo sale/entra al volver a conectar.
  /** @param {string} why */
  function imDisable(why) {
    if (!imCfg) return;
    imCfg = null;
    if (sim) imDrainOutbox(); // lo que el último tick dejó en el outbox
    const out = ImNet.stop();
    imHoldInbox();
    const n = sim ? api.imDisable(sim) : 0;
    log(
      `Internet Mode off${why ? ` — ${why}` : ''}` +
        (n ? ` (${plural(n, 'port')} deleted)` : '') +
        (out ? `; ${out} waiting to leave` : '') +
        (imHeld.length ? `; ${imHeld.length} received waiting for a port` : ''),
    );
    imState();
    postMessage({ t: 'im-off' });
    postFrame();
  }

  // Tras cada tick con IM encendido, ANTES del chequeo de rondas: lo que el
  // tick escribió en el outbox ya es un "archivo" en la carpeta outbound del
  // original y sobrevive a StartAnotherRound.
  function imDrainOutbox() {
    const n = api.numTeleporters(sim);
    for (let i = 1; i <= n; i++) {
      if (!api.tpGet(sim, i, 3)) continue;
      let k = api.outCount(sim, i);
      while (k-- > 0) {
        const lp = M._malloc(4);
        const p = api.outTake(sim, i, lp);
        const len = M.HEAP32[lp >> 2];
        M._free(lp);
        if (!p || len <= 0) break;
        const bytes = new Uint8Array(M.HEAPU8.buffer, p, len).slice();
        const meta = peekLabel(p, len);
        api.free(p);
        ImNet.push(bytes, meta.label);
      }
    }
  }

  // Después del chequeo de rondas, y solo si la sim siguió: en el original
  // `If StartAnotherRound Then Exit Sub` (main.frm:2081) corta el loop antes
  // de writeIMdata.
  function imAfterTick() {
    // Llegadas: el paso 18 sacó registros del inbox (FIFO).
    const tpIn = imPort();
    const now = tpIn ? api.tpGet(sim, tpIn, 13) : 0;
    if (now < imInboxKnown) {
      for (let k = imInboxKnown - now; k > 0 && imArrivals.length; k--)
        imLog(`arrived ${/** @type {Llegada} */ (imArrivals.shift()).label}`);
      imState();
    }
    imInboxKnown = now;
    // main.frm:2109-2111 — writeIMdata cada 200 ciclos.
    if (api.cycle(sim) % 200 === 0) {
      const txt = takeStr(api.imStats(sim));
      const cut = txt.indexOf('\n');
      const species = takeStr(api.imSpecies(sim))
        .split('\n')
        .filter(Boolean)
        .map((/** @type {string} */ r) => {
          const [nm, pop, veg, col] = r.split('\t');
          return [nm, +pop, +veg, +col];
        });
      ImNet.pushStats(txt.slice(0, cut), txt.slice(cut + 1), species);
    }
  }

  // La sim cambió de handle (reset, ronda, carga): el apodo es global de
  // proceso y Sim::fmt no se persiste — se vuelve a fijar.
  function imRebind() {
    if (sim) api.setIName(sim, imName);
  }

  // Canal F1 (capa host): tope de ciclos por ronda para N especies. Vive en el
  // worker, no en la sim: sobrevive a rondas y reinicios hasta que la página
  // lo cambie ({t:'f1-cap', cycles}; 0 = sin tope).
  // E10: mode 'nrg' decide por nrg + body×10 en vez de por número de bots.
  let f1CapCycles = 0;
  let f1CapMode = 0;
  // E10: ciclos de las rondas ya terminadas del contest (desde el f1start).
  let f1CycAcc = 0;
  // Suizo: rondas ganadas por el tope, por slot de PopArray (el suizo desempata
  // por las ganadas por extinción). Al disparar el tope se anotan las
  // victorias (f1CapSnap); la especie que suma una en un tick siguiente ganó
  // esa ronda por el tope.
  /** @type {number[]} */
  let f1CapWins = [];
  /** @type {number[] | null} */
  let f1CapSnap = null;
  function f1WinsNow() {
    const n = Math.min(api.f1TotSpecies(sim), 20);
    /** @type {number[]} */
    const w = [];
    for (let i = 1; i <= n; i++) w[i] = api.f1Wins(sim, i);
    return w;
  }
  function f1CapSettle() {
    if (!f1CapSnap) return;
    const snap = f1CapSnap;
    const w = f1WinsNow();
    const i = w.findIndex((x, k) => k > 0 && x > (snap[k] || 0));
    if (i < 0) return;
    f1CapWins[i] = (f1CapWins[i] || 0) + 1;
    f1CapSnap = null;
  }
  function f1CapCheck() {
    if (!f1CapCycles || api.cycle(sim) <= f1CapCycles) return;
    const k = api.f1Cap(sim, f1CapMode);
    if (k) {
      f1CapSnap = f1WinsNow();
      log(
        `F1: ${f1CapCycles}-cycle cap — the ${
          f1CapMode ? 'species with the most energy' : 'most numerous species'
        } wins the round`,
      );
      postMessage({ t: 'f1-note', kind: 'cap' });
    }
  }
  // Tope de bots por especie ({t:'f1-popcap', n}; 0 = sin tope): poda a los
  // más pobres (nrg + body×10) de la especie que se pase, tras cada tick.
  let f1PopCap = 0;
  function f1PopCapCheck() {
    if (f1PopCap) api.f1PopCap(sim, f1PopCap);
  }

  // ---- Loop de ticks --------------------------------------------------------
  /** @param {number} n */
  function runTicks(n) {
    // El chequeo E5 corre tras CADA tick (como el loop de main.frm:2079-2081):
    // un evento de parada corta la tanda; una ronda nueva sigue en la sim
    // reconstruida.
    for (let i = 0; i < n; i++) {
      tickOnce();
      if (imCfg) imDrainOutbox(); // E7
      const restarted = checkGameState();
      if (!restarted) {
        f1PopCapCheck();
        f1CapCheck();
      }
      if (imCfg && !restarted) imAfterTick(); // E7
      // main.frm:2099-2107 — el loop alimenta cada chartingInterval ciclos y
      // solo los charts visibles. RV-41: no en el tick que abrió la ronda (el
      // `If StartAnotherRound Then Exit Sub` de main.frm:2081 va antes).
      if (graphOpen.size && !restarted) {
        const iv = api.getOpt(sim, 110) | 0;
        if (iv > 0 && api.cycle(sim) % iv === 0) for (const g of graphOpen) feedGraph(g);
      }
      if (muestreo.cada > 0) muestreoTick(); // N2
      if (!running) break;
    }
    tickCount += n;
    const now = ahora();
    if (now - tpsT >= 1000) {
      tps = Math.round((tickCount * 1000) / (now - tpsT));
      tickCount = 0;
      tpsT = now;
    }
  }

  function loop() {
    if (!running || !sim) return;
    if (speed > 0) {
      // El ack del frame anterior reanuda el loop: N ticks por frame dibujado.
      if (!canPost) return;
      runTicks(speed);
      postFrame();
    } else {
      // Máx: rebanadas de ~12ms a fondo; publica frame cuando la página puede.
      // De a 1 tick por vuelta: con sims pesadas (ticks de >100ms) la rebanada
      // termina en el primer tick y el frame sale igual de seguido.
      const t0 = ahora();
      do {
        runTicks(1);
      } while (running && ahora() - t0 < 12);
      if (canPost) postFrame();
      programar(loop, 0);
    }
  }

  // ---- Comandos -------------------------------------------------------------
  // Lint del ADN al sembrar desde el formulario (db_dna_lint, capa host de
  // wasm/dbcore_api.cpp): los tokens que el cargador convierte en 0 sin avisar.
  // Solo informa; el bot se siembra igual que en el original.
  /** @param {string} dna */
  function lintIssues(dna) {
    return takeStr(api.lint(dna))
      .split('\n')
      .filter(Boolean)
      .map((/** @type {string} */ row) => {
        const [kind, token, count, line, hint] = row.split('\t');
        return { kind, token, count: +count, line: +line, hint };
      });
  }

  /** @param {Especie} sp */
  function lintSpecies(sp) {
    postMessage({ t: 'lint', name: sp.name, issues: lintIssues(sp.dna) });
  }

  // PLAN-EDITOR E1: traza de un gen paso a paso (db_dna_trace, wasm/dbcore_api.cpp).
  // El core carga el ADN en un bot descartable y no toca la sim del usuario.
  // Devuelve el TSV tal cual (el parseo lo hace engine/pila.js en la página).
  /**
   * @param {string} dna
   * @param {number[] | null} mem  memoria de ejemplo (1001 enteros) o null
   * @param {number} seed
   * @returns {string}
   */
  function traceSteps(dna, mem, seed) {
    if (mem) {
      ensure(scratch.traceMem, 1001);
      // Cero-relleno: un `mem` corto no deja datos de una traza anterior.
      const base = scratch.traceMem.p >> 2;
      M.HEAP32.fill(0, base, base + 1001);
      M.HEAP32.set(mem.slice(0, 1001), base);
    }
    return takeStr(api.traceDna(dna, mem ? scratch.traceMem.p : 0, mem ? 1001 : 0, seed | 0));
  }

  // PLAN-EDITOR E4.2: variantes del ADN para la evolución asistida. Cada cuenta
  // es una sim descartable (create/start/insertFounder/botMutate/botText/
  // destroy); la del usuario no se toca ni consume RNG. Cada variante usa su
  // semilla (semilla + i) para no repetir las mutaciones.
  // El texto que devuelve el motor se decompila (el core reescribe alias y
  // sysvars), así que cada variante se injerta sobre el ADN del usuario con la
  // referencia (el mismo fundador sin mutar): solo cambian los genes que mutó
  // y el resto conserva su texto y sus comentarios (injertar, engine/variantes.js).
  /**
   * @param {{adn?: string, k?: number, modo?: number, factor?: number, semilla?: number}} o
   * @returns {{textos: string[]} | {error: 'adn'}}
   */
  function variantesDe(o) {
    const adn = String(o.adn ?? '');
    const k = Math.max(1, o.k | 0);
    const modo = o.modo | 0;
    const factor = Math.max(1, o.factor | 0);
    const semilla = Number(o.semilla) || 0;
    /** @type {string} */
    let ref = '';
    const h0 = api.create();
    try {
      api.start(h0, semilla);
      const nb = api.insertFounder(h0, adn, 'variante', 0, 0, 1000);
      if (nb < 0) return { error: 'adn' };
      ref = sinColaDeGuardado(takeStr(api.botText(h0, nb)));
    } finally {
      api.destroy(h0);
    }
    /** @type {string[]} */
    const hechas = [];
    for (let i = 0; i <= k * 3 && distintas(adn, hechas).length < k; i++) {
      const h = api.create();
      try {
        api.start(h, semilla + i);
        const nb = api.insertFounder(h, adn, 'variante', 0, 0, 1000);
        if (nb < 0) return { error: 'adn' };
        api.botMutate(h, nb, modo, 1, factor);
        const crudo = sinColaDeGuardado(takeStr(api.botText(h, nb)));
        hechas.push(injertar(adn, crudo, ref));
      } finally {
        api.destroy(h);
      }
    }
    return { textos: distintas(adn, hechas).slice(0, k) };
  }

  /** @type {Map<string, number>} */
  const skinTimers = new Map(); // E8: especie (nombre + ADN) → Timer

  /**
   * @typedef {object} Especie
   * @property {string} dna
   * @property {string} name
   * @property {boolean} [veg]
   * @property {number} nrg
   * @property {number} color
   * @property {number} qty
   */

  /**
   * @param {Especie} sp
   * @param {boolean} [limpio]  C15: el Timer sale del reloj de ahora, sin
   *   la tabla de la sesión (un worker nuevo haría lo mismo)
   */
  function seedSpecies(sp, limpio) {
    const idx = api.addSpecies(sim, sp.dna, sp.name, sp.veg ? 1 : 0, 0, sp.nrg, sp.color, sp.qty);
    // E8 — AssignSkin (OptionsForm.frm:3411): el original la corre una vez, al
    // agregar la especie al formulario (la skin queda en TmpOpts.Specie); el
    // Timer del Randomize final se fija la primera vez que se ve la especie
    // (nombre + ADN) para que sims y rondas nuevas conserven la skin.
    const skey = `${sp.name}\n${sp.dna}`;
    /** Timer de VB6: segundos desde la medianoche. */
    const timer = () => {
      const d = fecha();
      return (d.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 1000;
    };
    if (limpio) api.assignSkin(sim, idx, timer());
    else {
      if (!skinTimers.has(skey)) skinTimers.set(skey, timer());
      api.assignSkin(sim, idx, skinTimers.get(skey));
    }
    dnaLib.set(sp.name, sp.dna); // RV-40: la "carpeta Robots" de la sesión
    return seedIndex(idx);
  }

  // loadrobs para la especie `idx` ya registrada en la sim.
  /** @param {number} idx */
  function seedIndex(idx) {
    const name = takeStr(api.speciesName(sim, idx));
    const missing = api.speciesMissing(sim, idx);
    const n = api.seedSpecies(sim, idx, 0);
    log(
      n > 0
        ? `seeded ${n} × ${name}`
        : missing
          ? `no DNA for ${name} (the .txt is missing: not seeded)`
          : `DNA rejected by the loader (${name})`,
    );
    return n;
  }

  // ---- RV-40: el ADN de las especies sin archivo ----------------------------
  // El .sim guarda ruta + nombre de cada especie y el original relee el .txt
  // del disco (RobScriptLoad; si falta, lo busca por nombre en la carpeta
  // común Robots, DNATokenizing.bas:180-186). Aquí la "carpeta" es lo que la
  // sesión conoce por nombre: las especies sembradas y lo que la página
  // resuelve de sus presets y del Bestiary ('dna-lib').
  /** @type {Map<string, string>} */
  const dnaLib = new Map(); // nombre de especie → ADN

  // Aplica la biblioteca a las especies sin archivo; devuelve los nombres que
  // siguen sin ADN.
  function dnaResolve() {
    /** @type {string[]} */
    const left = [];
    if (!sim) return left;
    for (let i = 0; i < api.numSpecies(sim); i++) {
      if (!api.speciesMissing(sim, i)) continue;
      const name = takeStr(api.speciesName(sim, i));
      if (dnaLib.has(name)) api.speciesSetDna(sim, i, dnaLib.get(name));
      else left.push(name);
    }
    return left;
  }

  // C15: el estado de orquestación que un worker nuevo tiene en su valor
  // inicial y que, si no, sobrevive al reset (topes del Canal, contadores
  // del contest, ancho por defecto de teleporters y charts abiertos: su
  // graphvisible viaja en el .dbsim).
  function limpiarHost() {
    f1CapCycles = 0;
    f1CapMode = 0;
    f1CycAcc = 0;
    f1CapWins = [];
    f1CapSnap = null;
    f1PopCap = 0;
    tpDefaultWidth = 0;
    graphOpen.clear();
  }

  // PLAN-EDITOR E2.2: todo handle nuevo (db_sim_create) arranca con la traza
  // apagada; si el último trace-on pedido fue encenderla, se reaplica acá.
  function nuevoHandle() {
    sim = api.create();
    if (trazaOn) api.traceOn(sim, 1);
  }

  /**
   * @param {any} msg  {seed, options, species[], quietF1?, limpio?, semillaColores?}
   * @param {boolean} [carryTeleporters]  true = ronda nueva
   */
  function resetSim(msg, carryTeleporters) {
    // C15: con `limpio` la sim nueva no hereda nada de la anterior (ver la
    // cabecera de engine/worker.js): el resultado es el de un worker recién
    // creado. La ronda nueva nunca es limpia.
    const limpio = !carryTeleporters && !!msg.limpio;
    if (limpio) limpiarHost();
    if (!carryTeleporters)
      azarFormas =
        msg.semillaColores !== undefined
          ? lcgSembrado(msg.semillaColores)
          : limpio
            ? lcgSembrado(msg.seed)
            : azar;
    const old = sim;
    // N4.1: sin sim anterior o con `limpio` el Player Bot no pasa (RV-42).
    if (limpio || !old) pbSeguir = false;
    nuevoHandle();
    const o = msg.options;
    api.setField(sim, o.fieldW, o.fieldH);
    api.setMinVegs(sim, o.minVegs);
    // MaxPopulation (OptionsForm MaxPopText): sin dato, el default del core.
    if (o.maxPopulation !== undefined) api.setMaxPop(sim, o.maxPopulation);
    api.setRepop(sim, o.repopAmount, o.repopCooldown);
    api.setMaxEnergy(sim, o.maxEnergy);
    api.setStartChlr(sim, o.startChlr);
    api.setMutations(sim, o.mutations ? 1 : 0);
    // Opciones E1 por id (tabla en wasm/dbcore_api.cpp): {id: valor, ...}
    if (o.opts) for (const id in o.opts) api.setOpt(sim, +id | 0, +o.opts[id]);
    // Costes por índice VB6 (E4): {i: valor, ...} — Costs(54) default 1 viene
    // del panel (MDIForm1.frm:2484).
    if (o.costs) for (const i in o.costs) api.setCost(sim, +i | 0, +o.costs[i]);
    api.start(sim, msg.seed); // Rnd -1 + Randomize seed/100 + buckets
    // E7: IntOpts.IName. C15: la sim limpia queda con el apodo vacío de un
    // worker nuevo (el IM se apagó antes del reset; al encenderlo se fija).
    if (!limpio) imRebind();
    api.setSimStart(sim, vbNowSimStart()); // E7: main.frm:1351
    // C15: xObstacle es un global del módulo wasm; ObsRepop sobre la sim
    // recién creada (sin formas) lo vacía, así obsRegen no re-crea las
    // formas de la sim anterior. Nada se traspasa de la sim vieja.
    if (limpio) api.obsRepop(sim);
    if (old && limpio) api.destroy(old);
    else if (old) {
      // PP-03: StartSimul apaga el array global de formas sin borrarlo y los
      // índices del compactador siguen (db_sim_obs_carry).
      api.obsCarry(sim, old);
      // RV-33/RV-35: en la ronda, StartSimul no toca TotRunCycle ni la
      // repoblación (cooldown y contadores): siguen los de la sim que termina.
      if (carryTeleporters) api.roundCarry(sim, old);
      // RV-42..RV-44: en "Start New" siguen el Player Bot, el registro de
      // muertos y los globales de E6/evo (StartNew_Click no los toca).
      else api.startNewCarry(sim, old);
      if (carryTeleporters)
        for (let i = 1; i <= api.numTeleporters(old); i++) api.tpCopy(sim, old, i);
      // RV-38: la ronda siembra SimOpts.Specie tal como quedó (main.frm:1517).
      if (carryTeleporters) api.roundSpecies(sim, old);
      api.destroy(old);
    }
    log(`new sim (seed ${msg.seed})`);
    if (carryTeleporters) {
      dnaResolve();
      for (let i = 0; i < api.numSpecies(sim); i++) seedIndex(i);
    } else {
      for (const sp of msg.species) seedSpecies(sp, limpio);
    }
    // E6: la sim nueva no sabe de los charts abiertos — repone graphvisible
    // (el formato de sim lo persiste, HDRoutines.bas:802). RV-41: sin punto
    // nuevo — StartSimul no llama a FeedGraph (el grafico.ResetGraph de
    // main.frm:1273 es la instancia por defecto, no un chart abierto).
    for (const g of graphOpen) api.graphSet(sim, g, 0, 1);
    speciesVersion = -1; // E6.5: handle nuevo, tabla de especies nueva
    gdDrop();
    muestreoRearmar(); // N2: handle nuevo (acumulador apagado en él)
    visPrime(); // la siembra inicial no son nacimientos
    // E5: con F1 activo el arranque corre FindSpecies (main.frm:1337-1340).
    if (api.getOpt(sim, 91)) {
      const ts = api.f1Start(sim);
      if (ts) log(`F1 contest: ${ts} species competing`);
      else if (!msg.quietF1) log('F1: no combat species — seed 2+ and "Start contest"');
    }
    // PP-03 — main.frm:1357-1365: después de loadrobs y FindSpecies, StartSimul
    // re-crea las formas de xObstacle escaladas al campo.
    const nObs = api.obsRegen(sim);
    if (nObs) log(`shapes regenerated: ${nObs}`);
    postFrame();
  }

  /**
   * @param {any} msg  {t:'save', req?, id?}: con correlación (req o id) la
   *   respuesta es siempre saved o save-error y la devuelve; sin ella, como
   *   la clásica (un volcado vacío solo deja un log)
   */
  function saveSim(msg) {
    const corr = correlacion(msg);
    const conCorr = Object.keys(corr).length > 0;
    if (!sim) {
      if (conCorr) postMessage({ t: 'save-error', ...corr, clave: 'save-empty' });
      else log('empty save');
      return;
    }
    const lenP = M._malloc(4);
    const p = api.save(sim, lenP);
    const len = M.HEAP32[lenP >> 2];
    M._free(lenP);
    if (!p || len <= 0) {
      log('empty save');
      if (conCorr) postMessage({ t: 'save-error', ...corr, clave: 'save-empty' });
      return;
    }
    const bytes = new Uint8Array(M.HEAPU8.buffer, p, len).slice();
    api.free(p);
    postMessage({ t: 'saved', bytes: bytes.buffer, cycle: api.cycle(sim), ...corr }, [
      bytes.buffer,
    ]);
  }

  /** @param {{bytes: ArrayBuffer, req?: any, id?: any}} msg */
  function loadSim(msg) {
    const bytes = new Uint8Array(msg.bytes);
    if (imCfg) imDrainOutbox(); // E7: lo que ya salió no se pierde
    // Sin sim todavía (worker recién creado: la página retoma una corrida
    // antes de cualquier reset): db_sim_load necesita un handle. La clásica
    // siempre tiene uno al cargar, así que con ella nada cambia.
    if (!sim) nuevoHandle();
    const p = M._malloc(bytes.length);
    M.HEAPU8.set(bytes, p);
    api.load(sim, p, bytes.length);
    M._free(p);
    imRebind();
    // RV-40: el archivo no trae el ADN de las especies; lo que la sesión no
    // conoce por nombre se le pide a la página (presets y Bestiary).
    const left = dnaResolve();
    if (left.length) postMessage({ t: 'dna-missing', names: left });
    // E7: LoadSimulation borra los teleporters Internet (quirk replicado en el
    // core). Cargar desde el menú (loadsim_Click con path = "",
    // MDIForm1.frm:2105-2148) NO vuelve a llamar a F1Internet_Click: el modo
    // queda encendido SIN puerto hasta desconectar y conectar. Lo que había
    // en el inbox queda retenido para el próximo puerto.
    if (imCfg) {
      imHoldInbox();
      log(
        'Internet Mode still connected without a port: LoadSimulation deleted the ' +
          'Internet teleporter — disconnect and reconnect to recreate it',
      );
      imState();
    }
    running = false;
    focusBot = 0; // los slots de bot cambian al cargar
    speciesVersion = -1;
    gdDrop();
    muestreoRearmar(); // N2: la carga vació la tabla de especies y lo acumulado
    visPrime();
    log(
      `sim loaded (${bytes.length} bytes), cycle ${api.cycle(sim)}, ` +
        `${api.totalRobots(sim)} bots`,
    );
    // E6 — HDRoutines.bas:1482-1519: el archivo dice qué charts estaban
    // visibles y el original los reabre uno a uno al cargar.
    const restore = [];
    for (let g = 1; g <= 18; g++) if (api.graphGet(sim, g, 0)) restore.push(g);
    // RV-41: NewGraph sobre un chart ya abierto no lo recrea pero sí lo
    // alimenta (main.frm:2183-2198); los que no estaban los abre la página.
    for (const g of restore) if (graphOpen.has(g)) feedGraph(g);
    if (restore.length) postMessage({ t: 'graphs-restore', list: restore });
    postFrame();
    // Indicador opcional de la nueva (la clásica no lo manda): con
    // correlación, la carga contesta qué quedó (un archivo que no es un
    // .dbsim deja una sim vacía en el ciclo 0) y qué especies siguen sin ADN.
    const corr = correlacion(msg);
    if (Object.keys(corr).length)
      postMessage({
        t: 'loaded',
        ...corr,
        cycle: api.cycle(sim),
        bots: api.totalRobots(sim),
        missing: left,
      });
  }

  // C12: las opciones 'base' en vivo, con los mismos exports y conversiones
  // que resetSim (db_sim_set_minvegs & cía.). Las que no vienen quedan como
  // están (repop se escribe de a par: la que falta se relee de la sim). El
  // tamaño del campo no es vivo: se ignora con un log. Como setopt, pasa por
  // el diálogo de opciones salvo `nocap` (ObsRepop antes, OKButton después).
  /** @param {any} msg  {t:'setbase', vals:{minVegs?, maxPopulation?, …}, nocap?} */
  function setBase(msg) {
    if (!sim) return;
    const v = msg.vals || {};
    /** @param {string} k */
    const hay = (k) => Object.hasOwn(v, k) && v[k] !== undefined;
    if (hay('fieldW') || hay('fieldH')) log('setbase: the field size needs a new sim');
    if (!msg.nocap) api.obsRepop(sim);
    if (hay('minVegs')) api.setMinVegs(sim, v.minVegs);
    if (hay('maxPopulation')) api.setMaxPop(sim, v.maxPopulation);
    if (hay('repopAmount') || hay('repopCooldown'))
      api.setRepop(
        sim,
        hay('repopAmount') ? v.repopAmount : api.getBase(sim, 1),
        hay('repopCooldown') ? v.repopCooldown : api.getBase(sim, 2),
      );
    if (hay('maxEnergy')) api.setMaxEnergy(sim, v.maxEnergy);
    if (hay('startChlr')) api.setStartChlr(sim, v.startChlr);
    if (hay('mutations')) api.setMutations(sim, v.mutations ? 1 : 0);
    if (!msg.nocap) api.optionsOk(sim);
  }

  /**
   * Correlación opcional de un pedido (`req` y/o `id`) para su respuesta;
   * vacía si el pedido no la trae (la clásica nunca la manda).
   * @param {any} msg
   */
  function correlacion(msg) {
    /** @type {{req?: any, id?: any}} */
    const c = {};
    if (msg.req !== undefined) c.req = msg.req;
    if (msg.id !== undefined) c.id = msg.id;
    return c;
  }

  /** @param {any} msg */
  function handle(msg) {
    switch (msg.t) {
      case 'reset':
        running = false;
        focusBot = 0;
        // E7: StartNew_Click hace `If InternetMode Then F1Internet_Click`
        // (OptionsForm.frm:4802) — el toggle, con el modo encendido, lo APAGA.
        if (imCfg) imDisable('new sim');
        // PP-03: para llegar a "Start New" el original activa el diálogo de
        // opciones, y con la sim visible eso corre ObsRepop
        // (OptionsForm.frm:4546): las formas de ahora son las de la sim
        // nueva y de sus rondas. La ronda nueva no pasa por aquí.
        // C15: la sim limpia no captura las formas de la anterior.
        if (sim && !msg.limpio) api.obsRepop(sim);
        resetSim(msg);
        break;
      // ---- E7: Internet Mode ----
      case 'im':
        if (msg.on) {
          if (imCfg) imDisable('reconnection');
          imEnable({
            name: msg.name || '',
            kind: msg.kind,
            url: msg.url || '',
            room: msg.room || 'public',
          });
          if (!imCfg) postMessage({ t: 'im-off' });
        } else {
          imDisable('');
        }
        break;
      case 'im-name':
        imName = String(msg.name || '');
        imRebind();
        if (imCfg) {
          imCfg.name = imName;
          ImNet.setIdentity(imName, simStartOf());
        }
        imState();
        break;
      case 'select':
        focusBot = msg.n | 0;
        if (msg.seq !== undefined) selSeq = msg.seq | 0;
        if (sim) api.setFocus(sim, focusBot); // E5: robfocus vive en el core
        postFrame(); // con la sim pausada el foco tiene que verse igual
        break;
      // ---- E5: modos de juego ----
      case 'f1-popcap':
        f1PopCap = Math.max(0, msg.n | 0);
        break;
      case 'f1-cap':
        f1CapCycles = Math.max(0, msg.cycles | 0);
        f1CapMode = msg.mode === 'nrg' ? 1 : 0;
        break;
      case 'f1start': {
        f1CycAcc = 0;
        f1CapWins = [];
        f1CapSnap = null;
        const ts = api.f1Start(sim);
        log(
          ts
            ? `F1 contest: ${ts} species competing`
            : 'F1 contest not active (is the F1 option off?)',
        );
        postMessage({ t: 'f1-started', n: ts });
        postFrame();
        break;
      }
      case 'pb':
        if (sim) api.pbOn(sim, msg.on ? 1 : 0);
        // N4.1 (opcional): seguir el foco que mueve el core (ver pbSeguir).
        pbSeguir = !!(sim && msg.on && msg.seguirFoco);
        break;
      case 'pb-mouse':
        if (sim) api.pbMouse(sim, +msg.x, +msg.y);
        break;
      case 'pb-keys':
        if (sim) {
          api.pbClearKeys(sim);
          for (const k of msg.keys) api.pbAddKey(sim, k.memloc | 0, k.value | 0, k.invert ? 1 : 0);
        }
        break;
      case 'pb-key':
        if (sim) api.pbKeyActive(sim, msg.idx | 0, msg.active ? 1 : 0);
        break;
      case 'bot-text': {
        const n = msg.n | 0;
        const p = sim ? api.botText(sim, n) : 0;
        let text = '';
        if (p) {
          text = M.UTF8ToString(p);
          api.free(p);
        }
        postMessage({ t: 'bot-text', n, text, ...correlacion(msg) });
        break;
      }
      case 'run':
        running = !!msg.running;
        if (running) {
          tickCount = 0;
          tpsT = ahora();
          loop();
        }
        break;
      case 'speed':
        speed = msg.n | 0;
        if (running && speed === 0) loop(); // el modo máx se auto-agenda
        break;
      case 'step':
        runTicks(1);
        postFrame();
        break;
      case 'seed-species':
        lintSpecies(msg.sp);
        seedSpecies(msg.sp);
        visPrime(); // E6.5: sembrar no es nacer
        postFrame();
        break;
      case 'lint-dna':
        // N3.3 (decisión 18), opcional de la nueva: el lint del editor de ADN.
        // Solo db_dna_lint (no toca ninguna sim ni consume RNG) y no siembra.
        postMessage({
          t: 'lint-dna',
          ...correlacion(msg),
          issues: lintIssues(String(msg.dna ?? '')),
        });
        break;
      case 'variantes':
        // PLAN-EDITOR E4.2: k variantes distintas del ADN (variantesDe). Anda
        // sin sim y no la toca.
        postMessage({ t: 'variantes', ...correlacion(msg), ...variantesDe(msg) });
        break;
      case 'trace-dna':
        // PLAN-EDITOR E1.3: traza de un gen para el visor de pila. Anda sin
        // sim (como lint-dna) y no toca la sim del usuario.
        postMessage({
          t: 'trace-dna',
          ...correlacion(msg),
          tsv: traceSteps(
            String(msg.dna ?? ''),
            Array.isArray(msg.mem) ? msg.mem : null,
            msg.seed | 0,
          ),
        });
        break;
      // ---- PLAN-EDITOR E2.2: trazador del inspector (bot con foco) ----
      case 'trace-on':
        // Sin sim no hay handle que encender: se recuerda y nuevoHandle lo aplica.
        trazaOn = !!msg.on;
        if (sim) api.traceOn(sim, trazaOn ? 1 : 0);
        break;
      case 'trace-bot': {
        // db_sim_bot_trace: "" salvo que n sea el bot con foco y haya corrido un
        // ciclo con la traza encendida (lo decide el core).
        const n = msg.n | 0;
        postMessage({
          t: 'trace',
          n,
          ...correlacion(msg),
          tsv: sim ? takeStr(api.botTrace(sim, n)) : '',
        });
        break;
      }
      case 'mem-dump': {
        // mem[i] es la dirección i+1. Sin sim (o bot inexistente), lista vacía.
        const n = msg.n | 0;
        let mem = [];
        if (sim) {
          ensure(scratch.mem, 1000);
          const c = api.botMemDump(sim, n, scratch.mem.p, 1000);
          mem = Array.from(new Int32Array(M.HEAP32.buffer, scratch.mem.p, c));
        }
        postMessage({ t: 'mem', n, ...correlacion(msg), mem });
        break;
      }
      case 'dna-lib': {
        // RV-40: lo que la página resolvió por nombre
        for (const e of msg.entries || []) dnaLib.set(String(e.name), String(e.dna));
        const left = dnaResolve();
        const got = (msg.entries || []).length;
        if (got) log(`DNA by name: ${got} species from the page library`);
        if (left.length) log(`no DNA: ${left.join(', ')}`);
        break;
      }
      case 'setopt':
        // Cambio en vivo (el core lee las opciones cada tick; mismo efecto
        // que el diálogo de opciones del original sobre una sim corriendo).
        if (!sim) break;
        // PP-03: abrir OptionsForm con la sim visible corre ObsRepop
        // (OptionsForm.frm:4546). Los toggles de menú de MDIForm1 (ids de
        // MENU_OPT_IDS) y el eye designer (nocap) no pasan por el diálogo.
        if (!msg.nocap && !MENU_OPT_IDS.has(msg.id | 0)) api.obsRepop(sim);
        api.setOpt(sim, msg.id | 0, +msg.v);
        // RV-32: OKButton_Click normaliza el sol (OptionsForm.frm:4620-4624).
        if (!msg.nocap && !MENU_OPT_IDS.has(msg.id | 0)) api.optionsOk(sim);
        break;
      case 'getopt': // solo lectura (smokes)
        // `id` es el de la opción: la correlación solo puede ir en `req`.
        if (sim)
          postMessage({
            t: 'opt',
            id: msg.id | 0,
            v: api.getOpt(sim, msg.id | 0),
            ...(msg.req !== undefined ? { req: msg.req } : {}),
          });
        break;
      case 'setbase':
        setBase(msg);
        break;
      case 'setcost':
        // E4: Costs(i) en vivo, como el CostsForm del original. PP-03: el
        // CostsForm solo se abre desde OptionsForm (OptionsForm.frm:2990), que
        // al activarse corrió ObsRepop; el eye designer (nocap) no.
        if (!sim) break;
        if (!msg.nocap) api.obsRepop(sim);
        api.setCost(sim, msg.i | 0, +msg.v);
        if (!msg.nocap) api.optionsOk(sim); // RV-32 (OKButton_Click)
        break;
      case 'save':
        saveSim(msg);
        break;
      case 'load':
        loadSim(msg);
        break;
      case 'teleporter': {
        // local: entra y sale en esta sim (2 RNG + ReSpawn). Tamaño = el
        // slider del form sin tocar (TeleportForm.frm:378-379: 300, rango
        // 100..1000), que es también el ancho del sorteo de posición (RV-36).
        // Filtros con los defaults del form (TeleportForm.frm:383-388: las
        // tres casillas marcadas, 10/10) — E7: hasta aquí teleportHeterotrophs
        // quedaba en False y el puerto local no movía a nadie.
        tpDefaultWidth = 300; // TeleportForm.frm:378 (el form se abrió)
        const i = api.addTeleporter(sim, 0, 0, 300, 0, 1, 1, 1, 10, 10);
        if (i > 0) api.tpSet(sim, i, 6, 1); // heterótrofos
        log(i > 0 ? `local teleporter #${i} created` : 'teleporter cap (10) reached');
        postFrame();
        break;
      }
      // ---- E3: menú Objects (shapes / mazes / teleporters) ----
      case 'shape': {
        const before = api.numObstacles(sim);
        const i = api.makeShape(sim, +msg.dw, +msg.dh);
        recolorObstacles(before);
        log(i > 0 ? `shape #${i} created` : 'shape cap (1000) reached');
        postFrame();
        break;
      }
      case 'shapes-add10': {
        const before = api.numObstacles(sim);
        api.addRandObs(sim, 10, +msg.dw, +msg.dh);
        log(
          `+${plural(recolorObstacles(before), 'random shape')} ` +
            `(${api.numObstacles(sim)} total)`,
        );
        postFrame();
        break;
      }
      case 'shapes-del10':
        api.delTenObs(sim);
        log(`deleted 10 at random; ${plural(api.numObstacles(sim), 'shape')} left`);
        postFrame();
        break;
      case 'shape-del':
        api.delObstacle(sim, msg.n | 0);
        postFrame();
        break;
      case 'shapes-clear':
        api.delAllObs(sim);
        log('all shapes deleted');
        postFrame();
        break;
      case 'maze': {
        const before = api.numObstacles(sim);
        const cw = msg.corridor | 0;
        const wt = msg.wall | 0;
        let n = 0;
        switch (msg.kind) {
          case 'h':
            n = api.mazeH(sim, cw, wt);
            break;
          case 'v':
            n = api.mazeV(sim, cw, wt);
            break;
          case 'spiral':
            n = api.mazeSpiral(sim, cw, wt);
            break;
          case 'checker':
            n = api.mazeChecker(sim, cw);
            break;
          case 'polar':
            n = api.mazePolar(sim);
            break;
          case 'trash':
            n = api.mazeTrash(sim);
            break;
        }
        recolorObstacles(before);
        // DrawPolarIceMaze enciende la deriva (Obstacles.bas:123-125): la
        // página relee los ids 83/84/85 para que el panel lo refleje.
        if (msg.kind === 'polar')
          postMessage({
            t: 'opts',
            vals: { 83: api.getOpt(sim, 83), 84: api.getOpt(sim, 84), 85: api.getOpt(sim, 85) },
          });
        log(`maze ${msg.kind}: +${plural(n, 'shape')}`);
        postFrame();
        break;
      }
      case 'tp-del':
        api.delTeleporter(sim, msg.n | 0);
        postFrame();
        break;
      case 'tp-clear':
        api.delAllTps(sim);
        log('all teleporters deleted');
        postFrame();
        break;
      // ---- E6: registro y analisis ----
      case 'graph-open':
        if (sim) openGraph(msg.n | 0);
        break;
      case 'graph-close':
        closeGraph(msg.n | 0);
        break;
      case 'graph-update': // boton "Update Now" (grafico.frm:4147)
        if (sim) feedGraph(msg.n | 0);
        break;
      case 'graph-query':
        if (sim) {
          api.graphSetQuery(sim, msg.which | 0, msg.q || '');
          postMessage({
            t: 'graph-query',
            which: msg.which | 0,
            q: takeStr(api.graphGetQuery(sim, msg.which | 0)),
          });
        }
        break;
      case 'graph-save-flag': // chk_GDsave (grafico.frm:3868)
        if (sim) api.graphSet(sim, msg.n | 0, 1, msg.on ? 1 : 0);
        break;
      case 'graph-pos': // graphleft/graphtop (grafico.frm:3999-4000)
        if (sim) {
          api.graphSet(sim, msg.n | 0, 2, msg.left | 0);
          api.graphSet(sim, msg.n | 0, 3, msg.top | 0);
        }
        break;
      case 'graph-filecounter': // grafico.frm:4085 (+1 por .gsave escrito)
        if (sim) {
          const c = api.graphGet(sim, msg.n | 0, 4) + 1;
          api.graphSet(sim, msg.n | 0, 4, c);
          postMessage({ t: 'graph-filecounter', n: msg.n | 0, c });
        }
        break;
      case 'snapshot': {
        // Database.bas:19 Snapshot (los vivos)
        const r = api.snapRun(sim, msg.withMut ? 1 : 0);
        postMessage({
          t: 'snapshot-done',
          records: r,
          snp: takeStr(api.snapTake(sim, 0)),
          mut: msg.withMut ? takeStr(api.snapTake(sim, 1)) : '',
        });
        break;
      }
      case 'dead-take': // Autosave\DeadRobots.snp del original
        postMessage({
          t: 'dead-data',
          records: api.deadRecords(sim),
          snp: takeStr(api.deadTake(sim, 0)),
          mut: takeStr(api.deadTake(sim, 1)),
        });
        if (msg.drain) api.deadDrain(sim);
        break;
      case 'dead-reset':
        api.deadReset(sim);
        log('dead robots log reset');
        break;
      case 'findbest': {
        // MDIForm1.frm:1398 — robfocus = fittest
        const n = api.fittest(sim);
        focusBot = n;
        postMessage({ t: 'focus', n });
        log(
          n
            ? `Find Best: bot #${n} (${takeStr(api.botName(sim, n))})`
            : 'Find Best: no candidates (fittest ignores vegetables)',
        );
        postFrame();
        break;
      }
      case 'family': {
        // parentele.frm: score tipos 0/1 y 2/3
        // Sin clearHighlight previo: el original ACUMULA (Command1 solo pone
        // highlight; el unico borrado es `unfocus`, main.frm:2155, que aqui es
        // el boton "Limpiar"). Es el mismo flag que usa el Player Bot para
        // elegir a quien pilotar — tambien en el original.
        const n = msg.n | 0;
        const maxrec = msg.maxrec | 0 || 1000;
        const total = api.offspring(sim, n, maxrec);
        const hl = api.highlightFam(sim, n, maxrec);
        let lines = null;
        if (msg.lines) {
          ensure(scratch.fam, 4096 * 7);
          const c = api.familyLines(sim, n, scratch.fam.p, 4096);
          if (c >= 4096) log('philogeny: tree trimmed to 4096 links');
          lines = Array.from(heapView(scratch.fam.p, Math.max(c, 1) * 7).subarray(0, c * 7));
        }
        postMessage({ t: 'family', n, total, highlighted: hl, lines });
        postFrame();
        break;
      }
      case 'clear-highlight':
        api.clearHighlight(sim);
        postMessage({ t: 'family', n: 0, total: 0, highlighted: 0, lines: [] });
        postFrame();
        break;
      case 'console': // Consoleform.openconsole / endconsole
        if (sim) api.consoleOpen(sim, msg.n | 0, msg.on ? 1 : 0);
        if (msg.on && sim)
          postMessage({
            t: 'console-open',
            n: msg.n | 0,
            absnum: api.botAbsnum(sim, msg.n | 0),
            name: takeStr(api.botName(sim, msg.n | 0)),
            genenum: api.botGenenum(sim, msg.n | 0),
          });
        break;
      case 'console-cmd':
        if (sim) consoleCmd(msg.n | 0, msg.line || '');
        break;
      case 'genes':
        if (sim) sendGenes(msg.n | 0);
        break;
      case 'activ': // ActivForm abierta/cerrada
        activOn = !!msg.on;
        if (activOn && sim && focusBot) sendGenes(focusBot);
        break;
      // ---- E6.5: vista enriquecida ----
      case 'view':
        rich = !!msg.rich;
        speciesVersion = -1;
        visPrime();
        if (!rich) {
          gdOn = false;
          if (sim) api.gendistRef(sim, 0);
        }
        postFrame();
        break;
      case 'gendist':
        if (!sim) break;
        api.gendistRef(sim, msg.n | 0);
        gdOn = (msg.n | 0) > 0;
        gdRoundDone = false;
        if (gdOn) gdPump();
        else postFrame();
        break;
      case 'redraw':
        postFrame();
        break;
      // ---- E8: extras ----
      case 'monitor':
        monitor.on = !!msg.on;
        if (Array.isArray(msg.mem)) for (let c = 0; c < 3; c++) monitor.mem[c] = msg.mem[c] | 0;
        postFrame();
        break;
      case 'skins':
        skinsOn = !!msg.on;
        postFrame();
        break;
      case 'eye-read': {
        // showEyeDesign_Click (MDIForm1.frm:1635-1643)
        const n = msg.n | 0;
        const dir = [];
        const wth = [];
        for (let i = 0; i < 9; i++) {
          dir.push(sim ? api.botMem(sim, n, i + EYE1DIR) : 0);
          wth.push(sim ? api.botMem(sim, n, i + EYE1WIDTH) : 0);
        }
        postMessage({ t: 'eye-vals', n, dir, wth });
        break;
      }
      // ---- N2: métricas (mensajes opcionales de la nueva) ----
      case 'muestreo':
        configurarMuestreo(msg);
        break;
      case 'linaje':
        postMessage(
          sim
            ? (() => {
                const l = linajeAhora();
                return { t: 'linaje', ...correlacion(msg), ciclo: api.cycle(sim), ...l };
              })()
            : {
                t: 'linaje',
                ...correlacion(msg),
                ciclo: -1,
                filas: new Int32Array(0),
                origen: new Int32Array(0),
                nombres: [],
              },
        );
        break;
      case 'dominante':
        postMessage({
          t: 'dominante',
          ...correlacion(msg),
          ciclo: sim ? api.cycle(sim) : -1,
          especies: sim ? dominantesAhora(false) : [],
        });
        break;
      case 'ciclo':
        // Indicador opcional de la nueva (la clásica no lo manda): el ciclo
        // de la sim en este punto de la cola. Con la sim en pausa, lo que se
        // mande a continuación se aplica en ese ciclo (decisión 13).
        postMessage({ t: 'ciclo', ...correlacion(msg), cycle: sim ? api.cycle(sim) : -1 });
        break;
      case 'sysvar':
        postMessage({
          t: 'sysvar',
          id: msg.id,
          v: sim ? api.sysvarTok0(sim, String(msg.name || '')) : 0,
        });
        break;
      case 'setmem':
        if (sim) api.botSetMem(sim, msg.n | 0, msg.addr | 0, msg.v | 0);
        if (!running) postFrame(); // la rejilla de visión con la sim en pausa
        break;
      case 'ack':
        recycleFrameBuffer(msg.buf);
        canPost = true;
        if (wantFrame) postFrame();
        else if (running && speed > 0) loop();
        break;
    }
  }

  bindApi();
  return { handle };
}

// CInt de VB6 (redondeo bancario) sobre val(): la asignación a Integer de
// console.frm (RV-37).
/** @param {number} x */
export function vbCInt(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * C15: generador determinista (el LCG de Numerical Recipes que usa también
 * el arnés de los tests) sembrado con cualquier número (FNV-1a de su texto).
 * Devuelve valores en [0, 1), como Math.random.
 * @param {number | string} semilla
 * @returns {() => number}
 */
export function lcgSembrado(semilla) {
  let h = 0x811c9dc5;
  for (const ch of String(semilla)) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let x = h || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
}
