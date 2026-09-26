'use strict';
// Extensión Rendimiento (spec/PROGRESO.md §"Siguiente") — Web Worker de sim.
//
// La sim entera (dbcore.wasm, el handle, los ticks y los volcados) vive en
// este worker; el hilo de la página queda solo con UI y render. Regla 4 del
// brief intacta: este worker NUNCA recalcula física ni RNG — solo llama a
// db_sim_* y empaqueta lo que el core vuelca.
//
// Protocolo (página → worker):
//   {t:'reset', seed, options, species[]}  nueva sim + siembra inicial
//   {t:'run', running}                     arrancar/pausar el loop de ticks
//   {t:'speed', n}                         n ticks por frame; 0 = máx
//                                          (corre a fondo en rebanadas ~12ms)
//   {t:'step'}                             un tick suelto
//   {t:'seed-species', sp}                 sembrar especie del formulario
//                                          → {t:'lint', name, issues[]}
//                                          (tokens del ADN que valen 0)
//   {t:'setopt', id, v}                    opción E1 en vivo (tabla de ids
//                                          en wasm/dbcore_api.cpp)
//   {t:'setcost', i, v}                    E4: Costs(i) en vivo (índices de
//                                          SimOptions.bas:2-39; 51..62 =
//                                          costes dinámicos)
//   {t:'save'}                             → {t:'saved', bytes, cycle}
//   {t:'load', bytes}                      cargar sim binaria (transferido)
//   {t:'teleporter'}                       alta de teleporter local
//   {t:'shape', dw, dh}                    E3: "New Shape..." (fracciones
//                                          de campo, default 0.2)
//   {t:'shapes-add10', dw, dh}             E3: Add Ten Random Shapes
//   {t:'shapes-del10'}                     E3: Delete 10 Random Shapes
//   {t:'shape-del', n}                     E3: borrar la forma n (clic)
//   {t:'shapes-clear'}                     E3: Delete All Shapes
//   {t:'maze', kind, corridor, wall}       E3: kind = h|v|spiral|checker|
//                                          polar|trash (Obstacles.bas:45-181)
//   {t:'tp-del', n} · {t:'tp-clear'}       E3: borrar teleporter(s)
//   {t:'f1start'}                          E5: arrancar contest (FindSpecies)
//   {t:'pb', on} · {t:'pb-mouse', x, y}    E5: Player Bot Mode (paso 13)
//   {t:'pb-keys', keys:[{memloc,value,invert}]} · {t:'pb-key', idx, active}
//   {t:'select', n, seq?}                  bot con foco (0 = ninguno); su
//                                          volcado de ojos/inspector viaja
//                                          en cada frame (etapa E2); seq
//                                          vuelve en stats.selSeq (E6.5)
//   {t:'bot-text', n}                      → {t:'bot-text', n, text} con
//                                          db_sim_bot_text (inspector)
//   {t:'graph-open', n} · {t:'graph-close', n} · {t:'graph-update', n}
//                                          E6: charts (main.frm NewGraph /
//                                          FeedGraph; el loop alimenta cada
//                                          chartingInterval ciclos)
//   {t:'graph-query', which, q}            E6: strGraphQuery1..3
//   {t:'graph-save-flag', n, on} · {t:'graph-pos', n, left, top} ·
//   {t:'graph-filecounter', n}             E6: estado que persiste la sim
//   {t:'snapshot', withMut}                E6: Snapshot de los vivos
//   {t:'dead-take', drain}                 E6: DeadRobots.snp acumulado
//   {t:'dead-reset'}                       E6: "borrar los archivos"
//   {t:'findbest'}                         E6: robfocus = fittest
//   {t:'family', n, maxrec, lines}         E6: philogeny (parentele.frm)
//   {t:'clear-highlight'}
//   {t:'console', n, on} · {t:'console-cmd', n, line} · {t:'genes', n}
//                                          E6: consola del bot (console.frm)
//   {t:'view', rich}                       E6.5: vista enriquecida on/off
//   {t:'gendist', n}                       E6.5: lente de distancia genética
//                                          al bot n (0 = apagada)
//   {t:'redraw'}                           E6.5: frame fresco sin tick
//                                          (cámara y efectos con la sim en
//                                          pausa)
//   {t:'im', on, name, kind, url, room}    E7: Internet Mode (F1Internet_Click
//                                          + el cliente IM de web/imnet.js);
//                                          kind = 'bc' (pestañas) | 'ws'
//   {t:'im-name', name}                    E7: IntOpts.IName (LastOwner)
//   {t:'monitor', on, mem:[r,g,b]}         E8: monitor RGB (MonitorOn +
//                                          frmMonitorSet.Monitor_mem_*): el
//                                          paso 23 corre tras cada tick
//   {t:'skins', on}                        E8: Form1.dispskin (DrawRobSkin)
//   {t:'eye-read', n}                      E8: showEyeDesign_Click →
//                                          {t:'eye-vals', n, dir[9], wth[9]}
//   {t:'setmem', n, addr, v}               E8: frmEYE (txtDir/txtWth_Change,
//                                          Reset Aim) — escribe rob(n).mem
//   {t:'sysvar', id, name}                 E8: SysvarTok sin bot →
//                                          {t:'sysvar', id, v}
//   {t:'ack', buf}                         devuelve el búfer del último frame
//
// Protocolo (worker → página):
//   {t:'ready'} · {t:'log', msg} · {t:'saved', bytes, cycle} ·
//   {t:'stopped'}                          E5: el core pidió parar la sim
//                                          (Form1.Active = False del original)
//   {t:'f1-over', winner}                  E5: contest terminado ·
//   {t:'bot-text', n, text} ·
//   {t:'opts', vals:{id: v}}               opciones que cambió el core (E3:
//                                          polar ice enciende la deriva) —
//                                          la página actualiza su panel
//   {t:'graph-data', n, series:[{name,color,value}], cycle, interval} ·
//   {t:'graph-query', which, q} · {t:'graph-filecounter', n, c} ·
//   {t:'snapshot-done', records, snp, mut} · {t:'dead-data', records, snp, mut} ·
//   {t:'focus', n} · {t:'family', n, total, highlighted, lines} ·
//   {t:'console-open', n, absnum, name, genenum} · {t:'console-out', n, text} ·
//   {t:'genes', n, ga[]} · {t:'running', running}   (etapa E6)
//   {t:'frame', buf, stats:{cycle,bots,vegs,tps,costx,f1,dead}}
//   {t:'species', names[]}                 E6.5: tabla de especies de la
//                                          vista (antes del frame que la usa)
//   {t:'gendist-off'}                      E6.5: la referencia murió o la sim
//                                          cambió (reset, ronda nueva, carga)
//   {t:'im-state', st}                     E7: estado del cliente IM (pares,
//                                          censos, InternetSpecies, colas) —
//                                          a lo sumo 4 por segundo
//   {t:'im-log', lines[]}                  E7: salidas/llegadas en tandas
//
// El frame es UN solo ArrayBuffer transferible (zero-copy) con ping-pong:
// la página lo devuelve con 'ack' al terminar de dibujar y el worker lo
// reutiliza — sin basura por frame y nunca más de un frame en vuelo (el
// backpressure sale solo: con speed>0 el ritmo lo marca el rAF de la
// página; con speed=0 el worker corre a fondo y publica cuando puede).
//
// Layout del frame (Float32Array):
//   [0..12] header: fieldW, fieldH, nBots, nShots, nTies, nObs, nTps, focus
//           (focus = índice del bot seleccionado con volcado válido; 0 = no),
//           rich (E6.5: 1 si viaja el bloque de la vista enriquecida),
//           nBirths, nDeaths, cycle, extras (E8: bit0 monitor, bit1 skins)
//   después: bots nBots×20, shots nShots×9, ties nTies×5,
//            obstáculos nObs×5, teleporters nTps×7
//           y, si focus > 0, el bloque de foco: 44 floats de
//           db_sim_dump_focus (inspector + 9 ojos, etapa E2)
//           y, si rich, nBots×24 de db_sim_dump_bots_vis (misma fila que
//           el bot) + nBirths×6 + nDeaths×6 de db_sim_vis_events
//           y, si extras&1, nBots×3 de db_sim_dump_monitor (E8)
//           y, si extras&2, nBots×9 de db_sim_dump_skins (E8)
//   (mismos registros que db_sim_dump_* — ver wasm/dbcore_api.cpp)

importScripts('../build-wasm/dbcore.js', 'imnet.js');

let M = null;   // Module de Emscripten
let api = {};   // cwraps
let sim = 0;    // handle

let running = false;
let speed = 4;          // ticks por frame; 0 = máx
let canPost = true;     // el frame anterior ya fue devuelto con 'ack'
let wantFrame = false;  // hay estado nuevo pendiente de publicar
let focusBot = 0;       // robfocus (E2): 0 = sin selección
// E6.5: número de la última selección de la página. Viaja en cada frame
// para que la página distinga "el bot con foco murió" (focus 0 en un frame
// que ya conoce la selección) de un frame armado antes del clic.
let selSeq = 0;

// ticks/segundo medidos (va en stats de cada frame)
let tickCount = 0, tpsT = 0, tps = 0;

const C = (name, ret, args) => M.cwrap(name, ret, args);

function bindApi() {
  api = {
    create:        C('db_sim_create', 'number', []),
    destroy:       C('db_sim_destroy', null, ['number']),
    start:         C('db_sim_start', null, ['number', 'number']),
    tick:          C('db_sim_tick', null, ['number']),
    setField:      C('db_sim_set_field', null, ['number', 'number', 'number']),
    fieldW:        C('db_sim_field_width', 'number', ['number']),
    fieldH:        C('db_sim_field_height', 'number', ['number']),
    setMinVegs:    C('db_sim_set_minvegs', null, ['number', 'number']),
    setMaxPop:     C('db_sim_set_maxpop', null, ['number', 'number']),
    setRepop:      C('db_sim_set_repop', null, ['number', 'number', 'number']),
    setMaxEnergy:  C('db_sim_set_max_energy', null, ['number', 'number']),
    setMutations:  C('db_sim_set_mutations', null, ['number', 'number']),
    setStartChlr:  C('db_sim_set_start_chlr', null, ['number', 'number']),
    setOpt:        C('db_sim_set_opt', null, ['number', 'number', 'number']),
    getOpt:        C('db_sim_get_opt', 'number', ['number', 'number']),
    setCost:       C('db_sim_set_cost', null, ['number', 'number', 'number']),
    getCost:       C('db_sim_get_cost', 'number', ['number', 'number']),
    addSpecies:    C('db_sim_add_species', 'number',
                     ['number', 'string', 'string', 'number', 'number', 'number', 'number', 'number']),
    seedSpecies:   C('db_sim_seed_species', 'number', ['number', 'number', 'number']),
    numSpecies:    C('db_sim_num_species', 'number', ['number']),
    speciesName:   C('db_sim_species_name', 'number', ['number', 'number']),
    speciesMissing: C('db_sim_species_missing', 'number', ['number', 'number']),
    speciesSetDna: C('db_sim_species_set_dna', null, ['number', 'number', 'string']),
    cycle:         C('db_sim_cycle', 'number', ['number']),
    totalRobots:   C('db_sim_total_robots', 'number', ['number']),
    maxRobs:       C('db_sim_max_robs', 'number', ['number']),
    totvegs:       C('db_sim_totvegs', 'number', ['number']),
    shotsCap:      C('db_sim_shots_capacity', 'number', ['number']),
    numObstacles:  C('db_sim_num_obstacles', 'number', ['number']),
    numTeleporters:C('db_sim_num_teleporters', 'number', ['number']),
    dumpBots:      C('db_sim_dump_bots', 'number', ['number', 'number', 'number']),
    dumpShots:     C('db_sim_dump_shots', 'number', ['number', 'number', 'number']),
    dumpTies:      C('db_sim_dump_ties', 'number', ['number', 'number', 'number']),
    dumpObstacles: C('db_sim_dump_obstacles', 'number', ['number', 'number', 'number']),
    dumpTeleporters:C('db_sim_dump_teleporters', 'number', ['number', 'number', 'number']),
    dumpFocus:     C('db_sim_dump_focus', 'number', ['number', 'number', 'number']),
    botText:       C('db_sim_bot_text', 'number', ['number', 'number']),
    addTeleporter: C('db_sim_add_teleporter', 'number',
                     ['number','number','number','number','number','number','number','number','number','number']),
    // E3 — menú Objects (transcripciones en wasm/dbcore_api.cpp)
    makeShape:     C('db_sim_make_shape', 'number', ['number','number','number']),
    addRandObs:    C('db_sim_add_random_obstacles', 'number', ['number','number','number','number']),
    delObstacle:   C('db_sim_delete_obstacle', null, ['number','number']),
    delAllObs:     C('db_sim_delete_all_obstacles', null, ['number']),
    delTenObs:     C('db_sim_delete_ten_random_obstacles', null, ['number']),
    obsColor:      C('db_sim_obstacle_set_color', null, ['number','number','number']),
    mazeH:         C('db_sim_maze_horizontal', 'number', ['number','number','number']),
    mazeV:         C('db_sim_maze_vertical', 'number', ['number','number','number']),
    mazeSpiral:    C('db_sim_maze_spiral', 'number', ['number','number','number']),
    mazeChecker:   C('db_sim_maze_checkerboard', 'number', ['number','number']),
    mazePolar:     C('db_sim_maze_polar_ice', 'number', ['number']),
    mazeTrash:     C('db_sim_maze_trash_compactor', 'number', ['number']),
    delTeleporter: C('db_sim_delete_teleporter', null, ['number','number']),
    delAllTps:     C('db_sim_delete_all_teleporters', null, ['number']),
    // E5 — modos de juego
    f1Start:       C('db_sim_f1_start', 'number', ['number']),
    f1Contests:    C('db_sim_f1_contests', 'number', ['number']),
    f1TotSpecies:  C('db_sim_f1_totspecies', 'number', ['number']),
    f1Over:        C('db_sim_f1_over', 'number', ['number']),
    f1Pop:         C('db_sim_f1_pop', 'number', ['number', 'number']),
    f1Wins:        C('db_sim_f1_wins', 'number', ['number', 'number']),
    f1Name:        C('db_sim_f1_name', 'number', ['number', 'number']),
    f1Restore:     C('db_sim_f1_restore', null,
                     ['number','number','number','number','number','number']),
    f1SetWins:     C('db_sim_f1_set_wins', null, ['number','number','number']),
    restartsCount: C('db_sim_restarts_count', 'number', ['number']),
    startAnother:  C('db_sim_start_another_round', 'number', ['number']),
    clearAnother:  C('db_sim_clear_start_another_round', null, ['number']),
    events:        C('db_sim_events', 'number', ['number']),
    eventsWinner:  C('db_sim_events_winner', 'number', ['number']),
    eventsDq:      C('db_sim_events_dq', 'number', ['number']),
    eventsClear:   C('db_sim_events_clear', null, ['number']),
    pbOn:          C('db_sim_pb_on', null, ['number', 'number']),
    pbMouse:       C('db_sim_pb_mouse', null, ['number', 'number', 'number']),
    pbClearKeys:   C('db_sim_pb_clear_keys', null, ['number']),
    pbAddKey:      C('db_sim_pb_add_key', 'number',
                     ['number','number','number','number']),
    pbKeyActive:   C('db_sim_pb_key_active', null,
                     ['number','number','number']),
    setFocus:      C('db_sim_set_focus', null, ['number', 'number']),
    // E6 - registro y analisis
    graphFeed:     C('db_sim_graph_feed', 'number', ['number','number','number','number']),
    graphName:     C('db_sim_graph_series_name', 'number', ['number','number']),
    graphSetQuery: C('db_sim_graph_set_query', null, ['number','number','string']),
    graphGetQuery: C('db_sim_graph_get_query', 'number', ['number','number']),
    graphGet:      C('db_sim_graph_get', 'number', ['number','number','number']),
    graphSet:      C('db_sim_graph_set', null, ['number','number','number','number']),
    snapRun:       C('db_sim_snapshot_run', 'number', ['number','number']),
    snapTake:      C('db_sim_snapshot_take', 'number', ['number','number']),
    deadRecords:   C('db_sim_dead_records', 'number', ['number']),
    deadTake:      C('db_sim_dead_take', 'number', ['number','number']),
    deadDrain:     C('db_sim_dead_drain', null, ['number']),
    deadReset:     C('db_sim_dead_reset', null, ['number']),
    fittest:       C('db_sim_fittest', 'number', ['number']),
    offspring:     C('db_sim_offspring', 'number', ['number','number','number']),
    highlightFam:  C('db_sim_highlight_family', 'number', ['number','number','number']),
    clearHighlight:C('db_sim_clear_highlight', null, ['number']),
    familyLines:   C('db_sim_family_lines', 'number', ['number','number','number','number']),
    consoleOpen:   C('db_sim_console_open', null, ['number','number','number']),
    botGa:         C('db_sim_bot_ga', 'number', ['number','number','number','number']),
    botDbg:        C('db_sim_bot_dbg', 'number', ['number','number']),
    botMem:        C('db_sim_bot_mem', 'number', ['number','number','number']),
    botSetMem:     C('db_sim_bot_set_mem', null, ['number','number','number','number']),
    sysvarTok:     C('db_sim_sysvar_tok', 'number', ['number','number','string']),
    botSetNrg:     C('db_sim_bot_set_nrg', null, ['number','number','number']),
    execRobs:      C('db_sim_exec_robs', null, ['number']),
    botGenenum:    C('db_sim_bot_genenum', 'number', ['number','number']),
    botAbsnum:     C('db_sim_bot_absnum', 'number', ['number','number']),
    botName:       C('db_sim_bot_name', 'number', ['number','number']),
    save:          C('db_sim_save', 'number', ['number', 'number']),
    load:          C('db_sim_load', null, ['number', 'number', 'number']),
    free:          C('db_free', null, ['number']),
    lint:          C('db_dna_lint', 'number', ['string']),
    // E6.5 - vista enriquecida (solo lectura del Sim)
    visReset:      C('db_sim_vis_reset', null, ['number']),
    visObserve:    C('db_sim_vis_observe', null, ['number']),
    dumpBotsVis:   C('db_sim_dump_bots_vis', 'number', ['number','number','number']),
    visEvents:     C('db_sim_vis_events', 'number', ['number','number','number','number']),
    visSpVersion:  C('db_sim_vis_species_version', 'number', ['number']),
    visSpCount:    C('db_sim_vis_species_count', 'number', ['number']),
    visSpName:     C('db_sim_vis_species_name', 'number', ['number','number']),
    gendistRef:    C('db_sim_vis_gendist_ref', null, ['number','number']),
    gendistStep:   C('db_sim_vis_gendist_step', 'number', ['number','number']),
    // E7 - Internet Mode
    tpGet:         C('db_sim_tp_get', 'number', ['number','number','number']),
    tpCopy:        C('db_sim_tp_copy', 'number', ['number','number','number']),
    tpSet:         C('db_sim_tp_set', null, ['number','number','number','number']),
    outCount:      C('db_sim_tp_outbox_count', 'number', ['number','number']),
    outTake:       C('db_sim_tp_outbox_take', 'number', ['number','number','number']),
    inboxPush:     C('db_sim_tp_inbox_push', null, ['number','number','number','number']),
    setIName:      C('db_sim_set_iname', null, ['number','string']),
    getIName:      C('db_sim_get_iname', 'number', ['number']),
    setSimStart:   C('db_sim_set_sim_start', null, ['number','string']),
    imEnable:      C('db_sim_im_enable', 'number', ['number','number']),
    imDisable:     C('db_sim_im_disable', 'number', ['number']),
    imStats:       C('db_sim_im_stats', 'number', ['number']),
    imSpecies:     C('db_sim_im_species', 'number', ['number']),
    dboPeek:       C('db_dbo_peek', 'number', ['number','number']),
    // E8 - extras (monitor RGB y skins: campos de render del Type robot)
    monCapture:    C('db_sim_monitor_capture', null, ['number','number','number','number']),
    dumpMonitor:   C('db_sim_dump_monitor', 'number', ['number','number','number']),
    dumpSkins:     C('db_sim_dump_skins', 'number', ['number','number','number']),
    sysvarTok0:    C('db_sim_sysvar_tok0', 'number', ['number','string']),
    assignSkin:    C('db_sim_species_assign_skin', null, ['number','number','number']),
    // PP-03 - formas de la ronda/sim nueva (xObstacle, main.frm:1357-1365)
    obsRepop:      C('db_sim_obs_repop', null, ['number']),
    obsCarry:      C('db_sim_obs_carry', null, ['number','number']),
    obsRegen:      C('db_sim_obs_regen', 'number', ['number']),
    xobsCount:     C('db_xobs_count', 'number', []),
    // RV-32..RV-35 (revision del port, piloto 12)
    roundCarry:    C('db_sim_round_carry', null, ['number','number']),
    roundSeed:     C('db_sim_round_seed', 'number', ['number']),
    roundSpecies:  C('db_sim_round_species', null, ['number','number']),
    startNewCarry: C('db_sim_startnew_carry', null, ['number','number']),
    getBase:      C('db_sim_get_base', 'number', ['number','number']),
    optionsOk:     C('db_sim_options_ok', null, ['number']),
  };
}

function log(msg) { self.postMessage({ t: 'log', msg }); }

// String malloc'd del core -> JS (y liberar).
function takeStr(p) {
  if (!p) return '';
  const s = M.UTF8ToString(p);
  api.free(p);
  return s;
}

// Colores de las formas nuevas (índices from+1..numObstacles): decisión de
// host (B7-5/Q01 — el original sorteaba Rnd*65536+Rnd*255+Rnd con Rnd crudo;
// aquí la paleta es de la página y Math.random NO toca el RNG de la sim).
function recolorObstacles(from) {
  const n = api.numObstacles(sim);
  for (let i = from + 1; i <= n; i++)
    api.obsColor(sim, i, Math.floor(Math.random() * 0x1000000));
  return n - from;
}

// ---- Búferes de volcado en el heap C (crecen bajo demanda) ----------------
const scratch = { bots: {p:0, cap:0}, shots: {p:0, cap:0}, ties: {p:0, cap:0},
                  obs: {p:0, cap:0}, tps: {p:0, cap:0}, focus: {p:0, cap:0},
                  graph: {p:0, cap:0}, ga: {p:0, cap:0}, fam: {p:0, cap:0},
                  vis: {p:0, cap:0}, births: {p:0, cap:0}, deaths: {p:0, cap:0},
                  mon: {p:0, cap:0}, skin: {p:0, cap:0} };

function ensure(b, floatsNeeded) {
  if (b.cap >= floatsNeeded || floatsNeeded === 0) return;
  if (b.p) M._free(b.p);
  b.cap = Math.ceil(floatsNeeded * 1.5) + 64;
  b.p = M._malloc(b.cap * 4);
}
// Vista fresca en cada uso: HEAPF32.buffer puede reubicarse (MEMORY_GROWTH).
function heapView(p, floats) {
  return new Float32Array(M.HEAPF32.buffer, p, floats);
}

// ---- Pool de frames (ping-pong con la página) -----------------------------
const framePool = [];

function takeFrameBuffer(floats) {
  const bytes = floats * 4;
  for (let i = 0; i < framePool.length; i++) {
    if (framePool[i].byteLength >= bytes) return framePool.splice(i, 1)[0];
  }
  // Alineado a 4: new Float32Array(buf) exige byteLength múltiplo de 4.
  return new ArrayBuffer((Math.ceil(bytes * 1.5) + 1024 + 3) & ~3);
}
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

  ensure(scratch.bots, maxB * 20);
  ensure(scratch.shots, shotCap * 9);
  ensure(scratch.ties, tieCap * 5);
  ensure(scratch.obs, obsCap * 5);
  ensure(scratch.tps, tpCap * 7);
  ensure(scratch.focus, 44);
  if (rich) {
    ensure(scratch.vis, maxB * 24);
    ensure(scratch.births, VIS_MAX_EVENTS * 6);
    ensure(scratch.deaths, VIS_MAX_EVENTS * 6);
  }

  const nB = maxB > 0 ? api.dumpBots(sim, scratch.bots.p, maxB) : 0;
  const nS = shotCap > 0 ? api.dumpShots(sim, scratch.shots.p, shotCap) : 0;
  const nT = tieCap > 0 ? api.dumpTies(sim, scratch.ties.p, tieCap) : 0;
  const nO = obsCap > 0 ? api.dumpObstacles(sim, scratch.obs.p, obsCap) : 0;
  const nP = tpCap > 0 ? api.dumpTeleporters(sim, scratch.tps.p, tpCap) : 0;
  // Foco (E2): si el bot murió, dumpFocus devuelve 0 y el foco se apaga.
  const nF = focusBot > 0 ? api.dumpFocus(sim, focusBot, scratch.focus.p) : 0;
  if (!nF) focusBot = 0;
  // E6.5: mismo recorrido de slots que dumpBots → misma fila por bot.
  let nV = 0, nBi = 0, nDe = 0;
  if (rich) {
    nV = maxB > 0 ? api.dumpBotsVis(sim, scratch.vis.p, maxB) : 0;
    nBi = api.visEvents(sim, 0, scratch.births.p, VIS_MAX_EVENTS);
    nDe = api.visEvents(sim, 1, scratch.deaths.p, VIS_MAX_EVENTS);
    const ver = api.visSpVersion(sim);
    if (ver !== speciesVersion) {
      speciesVersion = ver;
      const names = [];
      for (let i = 0; i < api.visSpCount(sim); i++)
        names.push(takeStr(api.visSpName(sim, i)));
      self.postMessage({ t: 'species', names });
    }
  }

  // E8: mismo recorrido de slots que dumpBots → misma fila por bot.
  let nM = 0, nK = 0;
  if (monitor.on && maxB > 0) {
    ensure(scratch.mon, maxB * 3);
    nM = api.dumpMonitor(sim, scratch.mon.p, maxB);
  }
  if (skinsOn && maxB > 0) {
    ensure(scratch.skin, maxB * 9);
    nK = api.dumpSkins(sim, scratch.skin.p, maxB);
  }
  const extras = (nM === nB && nM ? 1 : 0) | (nK === nB && nK ? 2 : 0);

  const total = 13 + nB * 20 + nS * 9 + nT * 5 + nO * 5 + nP * 7 + nF * 44 +
                nV * 24 + (nBi + nDe) * 6 + (extras & 1 ? nB * 3 : 0) +
                (extras & 2 ? nB * 9 : 0);
  const buf = takeFrameBuffer(total);
  const v = new Float32Array(buf);
  v[0] = api.fieldW(sim);
  v[1] = api.fieldH(sim);
  v[2] = nB; v[3] = nS; v[4] = nT; v[5] = nO; v[6] = nP;
  v[7] = nF ? focusBot : 0;
  v[8] = rich && nV === nB ? 1 : 0;
  v[9] = nBi; v[10] = nDe;
  v[11] = api.cycle(sim);
  v[12] = extras;

  let off = 13;
  if (nB) { v.set(heapView(scratch.bots.p, nB * 20), off); off += nB * 20; }
  if (nS) { v.set(heapView(scratch.shots.p, nS * 9), off); off += nS * 9; }
  if (nT) { v.set(heapView(scratch.ties.p, nT * 5), off); off += nT * 5; }
  if (nO) { v.set(heapView(scratch.obs.p, nO * 5), off); off += nO * 5; }
  if (nP) { v.set(heapView(scratch.tps.p, nP * 7), off); off += nP * 7; }
  if (nF) { v.set(heapView(scratch.focus.p, 44), off); off += 44; }
  if (v[8]) {
    if (nV) { v.set(heapView(scratch.vis.p, nV * 24), off); off += nV * 24; }
    if (nBi) { v.set(heapView(scratch.births.p, nBi * 6), off); off += nBi * 6; }
    if (nDe) { v.set(heapView(scratch.deaths.p, nDe * 6), off); off += nDe * 6; }
  } else {
    v[9] = 0; v[10] = 0;
  }
  if (extras & 1) { v.set(heapView(scratch.mon.p, nB * 3), off); off += nB * 3; }
  if (extras & 2) { v.set(heapView(scratch.skin.p, nB * 9), off); off += nB * 9; }
  return buf;
}

function postFrame() {
  if (!sim) return;
  if (!canPost) { wantFrame = true; return; }
  const buf = buildFrame();
  canPost = false;
  wantFrame = false;
  self.postMessage({
    t: 'frame', buf,
    stats: { cycle: api.cycle(sim), bots: api.totalRobots(sim),
             vegs: Math.max(api.totvegs(sim), 0), tps,
             costx: api.getCost(sim, 54),  // panel "CostX" (MDIForm1:3051)
             f1: f1Stats(),                // E5: estado del contest (o null)
             dead: api.deadRecords(sim),   // E6: snapshot de los muertos
             selSeq },                     // E6.5: ver arriba
  }, [buf]);
  if (activOn && focusBot) sendGenes(focusBot);  // E6 (DNA.bas:1265)
  if (gdOn && running && !gdPumpQueued) gdPump();  // E6.5: una rebanada
}

// ---- E6.5: vista enriquecida ------------------------------------------------
// Capa host pura (spec/PLAN-EXTENSIONES.md §E6.5): con la vista encendida el
// worker llama a db_sim_vis_observe tras CADA tick (acumula en el wasm lo que
// hizo cada bot; nada se publica a ritmo de tick — lección de E6) y el frame
// lleva el bloque extendido. Nada de esto escribe en la sim ni consume RNG.
const VIS_MAX_EVENTS = 2000;
let rich = false;
let speciesVersion = -1;
// Lente de distancia genética: DoGeneticDistance es O(DnaLen²) por par, así
// que corre en rebanadas de ~3 ms por frame y como mucho una vuelta por
// segundo con la sim corriendo; en pausa completa la vuelta y publica.
let gdOn = false, gdRoundDone = false, gdLastRound = 0, gdPumpQueued = false;

function tickOnce() {
  api.tick(sim);
  // E8 — paso 23 (Master.bas:416-427): tras UpdateSim es el mismo instante
  // (los pasos 24-26 no tocan mem() ni crean bots).
  if (monitor.on) api.monCapture(sim, monitor.mem[0], monitor.mem[1], monitor.mem[2]);
  if (rich) api.visObserve(sim);
}

// ---- E8: extras ------------------------------------------------------------
// Monitor RGB: MonitorOn.Checked + las 3 direcciones de frmMonitorSet (el
// piso/techo solo los usa DrawMonitor: viven en la página). Skins:
// Form1.dispskin, que arranca en True (main.frm:394).
const monitor = { on: false, mem: [1, 1, 1] };
let skinsOn = true;
const EYE1DIR = 521, EYE1WIDTH = 531;   // Robots.bas:106, :115

// La sim cambió de handle o de slots (reset, ronda nueva, carga): la
// referencia de la lente ya no vale y la página tiene que enterarse.
function gdDrop() {
  if (gdOn) self.postMessage({ t: 'gendist-off' });
  gdOn = false;
}

function visPrime() {
  if (rich && sim) api.visReset(sim);
}

function gdPump() {
  gdPumpQueued = false;
  if (!gdOn || !sim) return;
  if (gdRoundDone) {
    if (!running || performance.now() - gdLastRound < 1000) return;
    gdRoundDone = false;       // vuelta nueva: el cursor ya volvió a 1
  }
  const t0 = performance.now();
  let r = 0;
  do { r = api.gendistStep(sim, 4); } while (r === 0 && performance.now() - t0 < 3);
  if (r === -1) {
    gdOn = false;
    self.postMessage({ t: 'gendist-off' });
    return;
  }
  if (r === 1) {
    gdRoundDone = true;
    gdLastRound = performance.now();
    if (!running) postFrame();
  } else if (!running) {
    gdPumpQueued = true;
    setTimeout(gdPump, 0);
  }
}

// ---- E5: eventos del tick y rondas ----------------------------------------

// Estado del contest para las stats de cada frame (null si no hay contest).
function f1Stats() {
  if (!api.f1TotSpecies(sim)) return null;
  const sp = [];
  const n = Math.min(api.f1TotSpecies(sim), 5);
  for (let i = 1; i <= n; i++)
    sp.push({ name: takeStr(api.f1Name(sim, i)),
              pop: api.f1Pop(sim, i), wins: api.f1Wins(sim, i) });
  return { contests: api.f1Contests(sim), minrounds: api.getOpt(sim, 97),
           over: api.f1Over(sim), restarts: api.restartsCount(sim), sp };
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
const ROUND_OPT_IDS = [1, 2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 50, 51, 52, 53, 54, 55, 56,
  60, 61, 62, 63, 64, 70, 71, 72, 80, 81, 82, 83, 84, 85, 110, 111, 112];

function newRound() {
  // PP-03 (revisión): StartSimul no toca SimOpts salvo lo que el propio
  // arranque rehace (main.frm:1182-1368): las opciones en vivo — y las que
  // escribió la sim, como la deriva de Polar Ice o el COSTMULTIPLIER de los
  // costes dinámicos — pasan a la ronda. Los ids 90-101 van aparte (abajo).
  const opts = {};
  for (const id of ROUND_OPT_IDS) opts[id] = api.getOpt(sim, id);
  const costs = {};
  for (let i = 0; i <= 70; i++) costs[i] = api.getCost(sim, i);
  const keep = {
    contests: api.f1Contests(sim),
    minrounds: api.getOpt(sim, 97), optminrounds: api.getOpt(sim, 101),
    over: api.f1Over(sim), restarts: api.restartsCount(sim),
    restart: api.getOpt(sim, 90), f1: api.getOpt(sim, 91),
    dq: api.getOpt(sim, 93), maxrounds: api.getOpt(sim, 98),
    maxcycles: api.getOpt(sim, 99), maxpop: api.getOpt(sim, 100),
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
  const base = (k) => api.getBase(sim, k);
  resetSim({ seed, species: [],
             options: { fieldW: api.fieldW(sim), fieldH: api.fieldH(sim),
                        minVegs: base(0), repopAmount: base(1),
                        repopCooldown: base(2), maxEnergy: base(3),
                        startChlr: base(4), mutations: !!base(5),
                        maxPopulation: base(6),
                        opts, costs } }, true);
  if (imCfg) imInboxKnown = imPort() ? api.tpGet(sim, imPort(), 13) : 0;
  api.setOpt(sim, 90, keep.restart);
  api.setOpt(sim, 91, keep.f1);
  api.setOpt(sim, 93, keep.dq);
  api.setOpt(sim, 97, keep.optminrounds);  // fija MinRounds + optMinRounds
  api.setOpt(sim, 98, keep.maxrounds);
  api.setOpt(sim, 99, keep.maxcycles);
  api.setOpt(sim, 100, keep.maxpop);
  api.f1Restore(sim, keep.contests, keep.minrounds, keep.optminrounds,
                keep.over ? 1 : 0, keep.restarts);
  for (let i = 1; i <= 20; i++) api.f1SetWins(sim, i, keep.wins[i - 1]);
  // FindSpecies corre aquí después de la regeneración de formas de resetSim
  // (en StartSimul va antes, main.frm:1337-1340 vs :1357): no consume RNG ni
  // lee formas, así que el orden no se observa.
  const ts = api.f1Start(sim);
  log(`ronda nueva (seed ${seed})` +
      (ts ? ` — contest: ronda ${api.f1Contests(sim) + 1}` : ''));
  running = wasRunning;
}

// Tras cada tanda de ticks: eventos E5 del core + gate de rondas.
function checkGameState() {
  if (!sim) return false;
  let stopped = false;
  const ev = api.events(sim);
  if (ev) {
    if (ev & (1 << 13))
      for (const line of takeStr(api.eventsDq(sim)).split('\n'))
        if (line) log('DQ: ' + line);
    if (ev & (1 << 10))
      log(`F1: gana ${takeStr(api.eventsWinner(sim))} ` +
          `(${api.f1Contests(sim) + 1} rondas)`);
    if (ev & (1 << 11)) log('F1: una sola especie — modo desactivado');
    if (ev & (1 << 12))
      log('F1: más de 2 especies — límites de ciclos/población desactivados');
    if (ev & (1 << 1)) log('evo: Mutate extinguido (evo perdido)');
    if (ev & (1 << 2)) log('evo: Base extinguido (evo ganado)');
    if (ev & (1 << 3)) log('seeding: ronda completada (ciclo 2000)');
    if (ev & (1 << 4)) log('zerobot: reinicio necesario');
    if (ev & (1 << 6)) log('zerobot: listo para la etapa de test');
    if (ev & (1 << 8)) log('zerobot: test superado');
    if (ev & (1 << 9)) log('zerobot: test fallido');
    const winner = (ev & (1 << 10)) ? takeStr(api.eventsWinner(sim)) : '';
    stopped = !!(ev & 1);
    api.eventsClear(sim);
    if (ev & (1 << 10)) self.postMessage({ t: 'f1-over', winner });
    if (stopped) {
      // Form1.Active = False del original: la sim queda pausada.
      running = false;
      self.postMessage({ t: 'stopped' });
      postFrame();
    }
  }
  if (api.startAnother(sim)) {
    api.clearAnother(sim);
    // Con parada del core en este mismo chequeo (ganador declarado con
    // StartAnotherRound colgado del mismo Countpop, F1Mode.bas:364+380) el
    // original queda detenido en el mundo final: no se abre otra ronda.
    if (!stopped) { newRound(); return true; }
  }
  return false;
}

// ---- E6: registro y análisis ---------------------------------------------
// Gráficas: el loop del original alimenta cada SimOpts.chartingInterval
// ciclos y SOLO los charts visibles (main.frm:2098-2107). Aquí `graphOpen`
// es el espejo de Charts(i).graf.Visible; el core guarda graphvisible(n) en
// sim.evo (lo persiste el formato de sim, HDRoutines.bas:802).
const graphOpen = new Set();
// ActivForm.Visible del original: con la ventana abierta, DNA.bas:1265 llama
// a exechighlight para el bot con foco en CADA ciclo. Aqui el push viaja con
// el frame (una vez por frame dibujado, no por tick).
let activOn = false;

function feedGraph(n) {
  if (!sim) return;
  ensure(scratch.graph, 76 * 2);
  const nS = api.graphFeed(sim, n, scratch.graph.p, 76);
  const v = heapView(scratch.graph.p, Math.max(nS, 1) * 2);
  const series = [];
  for (let i = 0; i < nS; i++)
    series.push({ name: takeStr(api.graphName(sim, i + 1)),
                  color: v[i * 2 + 1], value: v[i * 2] });
  self.postMessage({ t: 'graph-data', n, series, cycle: api.cycle(sim),
                     interval: api.getOpt(sim, 110) });
}

// main.frm:2174-2201 NewGraph: registra el chart y lo alimenta ya mismo
// ("EricL - Get the first data point and show the graph key right from the
// start").
function openGraph(n) {
  graphOpen.add(n);
  api.graphSet(sim, n, 0, 1);   // graphvisible(n) = True (Form_Activate)
  feedGraph(n);
}
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
const A = { EyeStart: 500, EYEF: 510, FOCUSEYE: 511, EYE1DIR: 521,
            EYE1WIDTH: 531, hitup: 205, hitdn: 206, hitdx: 207, hitsx: 208,
            shup: 210, shdn: 211, shdx: 212, shsx: 213 };

function conOut(n, text) { self.postMessage({ t: 'console-out', n, text }); }

// console.frm:395-405 — printmem: val() primero, sysvar despues; el rango
// impreso es 0 < v < 1000 (el fuente excluye mem(1000)).
// CInt de VB6 (redondeo bancario) sobre val(): la asignación a Integer de
// console.frm (RV-37).
function vbCInt(x) {
  const f = Math.floor(x), d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return (f % 2 === 0) ? f : f + 1;
}

// console.frm:398-407 — `Dim v As Integer: v = val(w)`; si 0, SysvarTok.
function printmem(n, w) {
  let v = vbCInt(parseFloat(w) || 0);
  if (v === 0) v = api.sysvarTok(sim, n, w || '');
  if (v > 0 && v < 1000) conOut(n, ' ' + v + '-> ' + api.botMem(sim, n, v));
}

function consoleCmd(n, line) {
  const words = String(line).split(' ');
  const w = (i) => (i < words.length ? words[i] : '');
  switch (words[0]) {
    case 'debug':
      // El botón `debug` del original dispara un ciclo con el debugger:
      // aquí la traza ya la escribe la VM en cada tick (dbgstring).
      conOut(n, '***ROBOT DEBUG***' + takeStr(api.botDbg(sim, n)));
      break;
    case 'printeye': {
      let s = 'EyeN: ';
      for (let t = 1; t <= 9; t++) s += ' ' + api.botMem(sim, n, A.EyeStart + t);
      s += ' .eyef: ' + api.botMem(sim, n, A.EYEF) +
           ' .focuseye: ' + api.botMem(sim, n, A.FOCUSEYE);
      s += '\nEyeNDir: ';
      for (let t = 0; t <= 8; t++) s += ' ' + api.botMem(sim, n, A.EYE1DIR + t);
      s += '\nEyeNWidth: ';
      for (let t = 0; t <= 8; t++) s += ' ' + api.botMem(sim, n, A.EYE1WIDTH + t);
      conOut(n, s);
      break;
    }
    case 'printtouch':
      conOut(n, 'Up: ' + api.botMem(sim, n, A.hitup) +
                ' Dn: ' + api.botMem(sim, n, A.hitdn) +
                ' Sx: ' + api.botMem(sim, n, A.hitsx) +
                ' Dx: ' + api.botMem(sim, n, A.hitdx));
      break;
    case 'printtaste':
      conOut(n, 'Up: ' + api.botMem(sim, n, A.shup) +
                ' Dn: ' + api.botMem(sim, n, A.shdn) +
                ' Sx: ' + api.botMem(sim, n, A.shsx) +
                ' Dx: ' + api.botMem(sim, n, A.shdx));
      break;
    case 'cycle': {
      const k = parseInt(w(1), 10) || 0;
      for (let i = 0; i < k; i++) {
        tickOnce();
        if (imCfg) imDrainOutbox();
        if (!checkGameState() && imCfg) imAfterTick();
      }
      postFrame();
      conOut(n, k + ' ciclo(s) ejecutado(s) — ciclo ' + api.cycle(sim));
      sendGenes(n);
      break;
    }
    case 'energy':
      api.botSetNrg(sim, n, parseFloat(w(1)) || 0);
      break;
    case 'play':
      running = true; loop();
      self.postMessage({ t: 'running', running: true });
      break;
    case 'pause':
      running = false;
      self.postMessage({ t: 'running', running: false });
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
        conOut(n, 'Value out of range.  Memory values must be between ' +
                  '-32000 and 32000.');
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
      if (p) { text = M.UTF8ToString(p); api.free(p); }
      self.postMessage({ t: 'bot-text', n, text });
      break;
    }
    case 'help':
      for (const l of CONSOLE_HELP) conOut(n, l);
      break;
    default:
      break;  // el original ignora lo que no reconoce
  }
}

// DNA.bas:1254-1263 — la lista de genes ejecutados que la consola imprime
// tras cada ciclo, y el mismo dato que come ActivForm.DrawGrid.
function sendGenes(n) {
  ensure(scratch.ga, 512);
  const c = api.botGa(sim, n, scratch.ga.p, 512);
  const g = new Int32Array(M.HEAP32.buffer, scratch.ga.p, Math.max(c, 1));
  self.postMessage({ t: 'genes', n, ga: Array.from(g.subarray(0, c)) });
}

// ---- E7: Internet Mode ----------------------------------------------------
// El toggle es F1Internet_Click (MDIForm1.frm:1259-1380, transcrito en
// db_sim_im_enable/disable) y el transporte es el cliente IM de imnet.js,
// que hace lo que hacía DarwinbotsIM.exe con las carpetas inbound/outbound.
// Tras cada tick con IM encendido: el outbox del teleporter Internet se
// vacía hacia el cliente y, cada 200 ciclos, sale el .stats de writeIMdata
// (main.frm:2109-2111). Lo que llega entra al inbox y el paso 18 del core lo
// carga a su ritmo (InboundPollCycles/BotsPerPoll y el gate de 45 especies).
let imCfg = null;       // {name, kind, url, room} con IM encendido; si no, null
let imName = '';        // IntOpts.IName: global de proceso (sobrevive resets)
// teleporterDefaultWidth (Teleport.bas:56): 0 hasta que se usa el form de
// teleporters (TeleportForm.frm:378 lo pone en 300); entra al sorteo de la
// posición del puerto Internet.
let tpDefaultWidth = 0;
// Lo que está en el inbox del puerto, en orden FIFO: {label, bytes}. Se
// guardan los bytes porque el inbox puede perderse sin haberse cargado
// (LoadSimulation borra el puerto; apagar lo borra): esos registros ya
// confirmados pasan a imHeld y entran en el próximo puerto — como los
// archivos que quedaban en la carpeta inbound del original.
let imArrivals = [];
let imHeld = [];
let imInboxKnown = 0;   // registros que el inbox tenía tras el último tick
let imLogBuf = [], imLogTimer = 0, imStateTimer = 0;

function imLog(line) {
  imLogBuf.push(line);
  if (!imLogTimer)
    imLogTimer = setTimeout(() => {
      imLogTimer = 0;
      const lines = imLogBuf;
      imLogBuf = [];
      if (lines.length > 40)
        lines.splice(20, lines.length - 40, `… (${lines.length - 40} más)`);
      self.postMessage({ t: 'im-log', lines });
    }, 250);
}

function imState() {
  if (imStateTimer) return;
  imStateTimer = setTimeout(() => {
    imStateTimer = 0;
    const st = ImNet.snapshot();
    st.enabled = !!imCfg;
    st.port = imPort();
    st.inbox = st.port ? api.tpGet(sim, st.port, 13) : 0;
    st.inTotal = st.port ? api.tpGet(sim, st.port, 12) : 0;
    st.outTotal = st.port ? api.tpGet(sim, st.port, 11) : 0;
    self.postMessage({ t: 'im-state', st });
  }, 250);
}

// Primer teleporter Internet de la sim (0 si no hay: p. ej. lo borraron).
function imPort() {
  if (!sim) return 0;
  const n = api.numTeleporters(sim);
  for (let i = 1; i <= n; i++) if (api.tpGet(sim, i, 3)) return i;
  return 0;
}

function peekLabel(p, len) {
  const f = takeStr(api.dboPeek(p, len)).split('\t');
  if (f.length < 7) return { label: 'organismo', owner: '' };
  const cells = +f[0];
  return { label: f[1] + (cells > 1 ? ` (${cells} células)` : ''),
           owner: f[2] };
}

// Hook del cliente IM: un .dbo para esta sim. Devuelve false si no hay
// puerto Internet (sin ack: el emisor lo re-sortea hacia otro par).
function imOnDbo(bytes, from) {
  const tp = imPort();
  if (!imCfg || !tp) return false;
  const p = M._malloc(bytes.length);
  M.HEAPU8.set(bytes, p);
  const meta = peekLabel(p, bytes.length);
  api.inboxPush(sim, tp, p, bytes.length);
  M._free(p);
  imArrivals.push({ label: `${meta.label} de ${meta.owner || from}`, bytes });
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
  const d = new Date();
  let h = d.getHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const p2 = (x) => String(x).padStart(2, '0');
  return `${d.getMonth() + 1}-${d.getDate()}-${d.getFullYear()} ` +
         `${h}-${p2(d.getMinutes())}-${p2(d.getSeconds())} ${ap}`;
}

function simStartOf() {
  // El JSON de writeIMdata lleva simId = strSimStart.
  const t = takeStr(api.imStats(sim));
  const m = /"simId":"([^"]*)"/.exec(t);
  return m ? m[1] : '';
}

// F1Internet_Click, encendido: puerto + cliente. Devuelve true si quedó on.
function imEnable(cfg) {
  if (!sim) return false;
  api.setIName(sim, cfg.name || '');
  const i = api.imEnable(sim, tpDefaultWidth);
  if (i <= -100) {
    const mode = -100 - i;
    log(`Internet: no se puede activar con el modo de reinicio ${mode} ` +
        '(MDIForm1.frm:1264-1296)');
    return false;
  }
  if (i < 0) {
    log('Internet: tope de teleporters (10) — no se pudo crear el puerto');
    return false;
  }
  imName = takeStr(api.getIName(sim));   // "Newbie N" si venía vacío
  imCfg = { ...cfg, name: imName };
  imArrivals = [];
  imInboxKnown = 0;
  const held = imFlushHeld(i);
  if (held) log(`Internet: ${held} organismos retenidos entran al puerto nuevo`);
  ImNet.start({ name: imName, simId: simStartOf(), kind: cfg.kind,
                url: cfg.url, room: cfg.room },
              { onDbo: imOnDbo, onChange: imState, onLog: imLog });
  log(`Internet Mode: puerto #${i} (${cfg.kind === 'ws' ? 'relay ' + cfg.url
      : 'pestañas de este navegador'}, sala "${cfg.room}") como "${imName}"`);
  imState();
  postFrame();
  return true;
}

// Rama de apagado: el cliente se va (CloseWindow) y los puertos Internet se
// borran. Nada se pierde: lo que esperaba salir sigue en la cola del cliente
// (la carpeta outbound) y lo que estaba en el inbox queda retenido (la
// inbound); todo sale/entra al volver a conectar.
function imDisable(why) {
  if (!imCfg) return;
  imCfg = null;
  if (sim) imDrainOutbox();   // lo que el último tick dejó en el outbox
  const out = ImNet.stop();
  imHoldInbox();
  const n = sim ? api.imDisable(sim) : 0;
  log(`Internet Mode apagado${why ? ' — ' + why : ''}` +
      (n ? ` (${n} puerto borrado)` : '') +
      (out ? `; ${out} por salir` : '') +
      (imHeld.length ? `; ${imHeld.length} recibidos esperan un puerto` : ''));
  imState();
  self.postMessage({ t: 'im-off' });
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
      imLog('llegó ' + imArrivals.shift().label);
    imState();
  }
  imInboxKnown = now;
  // main.frm:2109-2111 — writeIMdata cada 200 ciclos.
  if (api.cycle(sim) % 200 === 0) {
    const txt = takeStr(api.imStats(sim));
    const cut = txt.indexOf('\n');
    const species = takeStr(api.imSpecies(sim)).split('\n').filter(Boolean)
      .map((r) => { const [nm, pop, veg, col] = r.split('\t');
                    return [nm, +pop, +veg, +col]; });
    ImNet.pushStats(txt.slice(0, cut), txt.slice(cut + 1), species);
  }
}

// La sim cambió de handle (reset, ronda, carga): el apodo es global de
// proceso y Sim::fmt no se persiste — se vuelve a fijar.
function imRebind() {
  if (sim) api.setIName(sim, imName);
}



// ---- Loop de ticks --------------------------------------------------------
function runTicks(n) {
  // El chequeo E5 corre tras CADA tick (como el loop de main.frm:2079-2081):
  // un evento de parada corta la tanda; una ronda nueva sigue en la sim
  // reconstruida.
  for (let i = 0; i < n; i++) {
    tickOnce();
    if (imCfg) imDrainOutbox();              // E7
    const restarted = checkGameState();
    if (imCfg && !restarted) imAfterTick();  // E7
    // main.frm:2099-2107 — el loop alimenta cada chartingInterval ciclos y
    // solo los charts visibles. RV-41: no en el tick que abrió la ronda (el
    // `If StartAnotherRound Then Exit Sub` de main.frm:2081 va antes).
    if (graphOpen.size && !restarted) {
      const iv = api.getOpt(sim, 110) | 0;
      if (iv > 0 && api.cycle(sim) % iv === 0)
        for (const g of graphOpen) feedGraph(g);
    }
    if (!running) break;
  }
  tickCount += n;
  const now = performance.now();
  if (now - tpsT >= 1000) {
    tps = Math.round(tickCount * 1000 / (now - tpsT));
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
    const t0 = performance.now();
    do { runTicks(1); } while (running && performance.now() - t0 < 12);
    if (canPost) postFrame();
    setTimeout(loop, 0);
  }
}

// ---- Comandos -------------------------------------------------------------
// Lint del ADN al sembrar desde el formulario (db_dna_lint, capa host de
// wasm/dbcore_api.cpp): los tokens que el cargador convierte en 0 sin avisar.
// Solo informa; el bot se siembra igual que en el original.
function lintSpecies(sp) {
  const issues = takeStr(api.lint(sp.dna)).split('\n').filter(Boolean)
    .map((row) => {
      const [kind, token, count, line, hint] = row.split('\t');
      return { kind, token, count: +count, line: +line, hint };
    });
  self.postMessage({ t: 'lint', name: sp.name, issues });
}

const skinTimers = new Map();   // E8: especie (nombre + ADN) → Timer

function seedSpecies(sp) {
  const idx = api.addSpecies(sim, sp.dna, sp.name, sp.veg ? 1 : 0, 0,
                             sp.nrg, sp.color, sp.qty);
  // E8 — AssignSkin (OptionsForm.frm:3411): el original la corre una vez, al
  // agregar la especie al formulario (la skin queda en TmpOpts.Specie); el
  // Timer del Randomize final se fija la primera vez que se ve la especie
  // (nombre + ADN) para que sims y rondas nuevas conserven la skin.
  const skey = sp.name + '\n' + sp.dna;
  if (!skinTimers.has(skey)) {
    const d = new Date();
    skinTimers.set(skey, (d - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 1000);
  }
  api.assignSkin(sim, idx, skinTimers.get(skey));
  dnaLib.set(sp.name, sp.dna);   // RV-40: la "carpeta Robots" de la sesión
  return seedIndex(idx);
}

// loadrobs para la especie `idx` ya registrada en la sim.
function seedIndex(idx) {
  const name = takeStr(api.speciesName(sim, idx));
  const missing = api.speciesMissing(sim, idx);
  const n = api.seedSpecies(sim, idx, 0);
  log(n > 0 ? `sembrados ${n} × ${name}`
            : missing ? `sin ADN para ${name} (el .txt no está: no se siembra)`
            : `ADN rechazado por el cargador (${name})`);
  return n;
}

// ---- RV-40: el ADN de las especies sin archivo ----------------------------
// El .sim guarda ruta + nombre de cada especie y el original relee el .txt
// del disco (RobScriptLoad; si falta, lo busca por nombre en la carpeta
// común Robots, DNATokenizing.bas:180-186). Aquí la "carpeta" es lo que la
// sesión conoce por nombre: las especies sembradas y lo que la página
// resuelve de sus presets y del Bestiary ('dna-lib').
const dnaLib = new Map();   // nombre de especie → ADN

// Aplica la biblioteca a las especies sin archivo; devuelve los nombres que
// siguen sin ADN.
function dnaResolve() {
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

function resetSim(msg, carryTeleporters) {
  const old = sim;
  sim = api.create();
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
  if (o.opts) for (const id in o.opts) api.setOpt(sim, id | 0, +o.opts[id]);
  // Costes por índice VB6 (E4): {i: valor, ...} — Costs(54) default 1 viene
  // del panel (MDIForm1.frm:2484).
  if (o.costs) for (const i in o.costs) api.setCost(sim, i | 0, +o.costs[i]);
  api.start(sim, msg.seed);   // Rnd -1 + Randomize seed/100 + buckets
  imRebind();                                    // E7: IntOpts.IName
  api.setSimStart(sim, vbNowSimStart());         // E7: main.frm:1351
  if (old) {
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
  log(`sim nueva (seed ${msg.seed})`);
  if (carryTeleporters) {
    dnaResolve();
    for (let i = 0; i < api.numSpecies(sim); i++) seedIndex(i);
  } else {
    for (const sp of msg.species) seedSpecies(sp);
  }
  // E6: la sim nueva no sabe de los charts abiertos — repone graphvisible
  // (el formato de sim lo persiste, HDRoutines.bas:802). RV-41: sin punto
  // nuevo — StartSimul no llama a FeedGraph (el grafico.ResetGraph de
  // main.frm:1273 es la instancia por defecto, no un chart abierto).
  for (const g of graphOpen) api.graphSet(sim, g, 0, 1);
  speciesVersion = -1;   // E6.5: handle nuevo, tabla de especies nueva
  gdDrop();
  visPrime();           // la siembra inicial no son nacimientos
  // E5: con F1 activo el arranque corre FindSpecies (main.frm:1337-1340).
  if (api.getOpt(sim, 91)) {
    const ts = api.f1Start(sim);
    log(ts ? `contest F1: ${ts} especies en liza`
           : 'F1: sin especies de combate — sembrá 2+ y "Arrancar contest"');
  }
  // PP-03 — main.frm:1357-1365: después de loadrobs y FindSpecies, StartSimul
  // re-crea las formas de xObstacle escaladas al campo.
  const nObs = api.obsRegen(sim);
  if (nObs) log(`formas regeneradas: ${nObs}`);
  postFrame();
}

function saveSim() {
  const lenP = M._malloc(4);
  const p = api.save(sim, lenP);
  const len = M.HEAP32[lenP >> 2];
  M._free(lenP);
  if (!p || len <= 0) { log('guardado vacío'); return; }
  const bytes = new Uint8Array(M.HEAPU8.buffer, p, len).slice();
  api.free(p);
  self.postMessage({ t: 'saved', bytes: bytes.buffer, cycle: api.cycle(sim) },
                   [bytes.buffer]);
}

function loadSim(msg) {
  const bytes = new Uint8Array(msg.bytes);
  if (imCfg) imDrainOutbox();   // E7: lo que ya salió no se pierde
  const p = M._malloc(bytes.length);
  M.HEAPU8.set(bytes, p);
  api.load(sim, p, bytes.length);
  M._free(p);
  imRebind();
  // RV-40: el archivo no trae el ADN de las especies; lo que la sesión no
  // conoce por nombre se le pide a la página (presets y Bestiary).
  const left = dnaResolve();
  if (left.length) self.postMessage({ t: 'dna-missing', names: left });
  // E7: LoadSimulation borra los teleporters Internet (quirk replicado en el
  // core). Cargar desde el menú (loadsim_Click con path = "",
  // MDIForm1.frm:2105-2148) NO vuelve a llamar a F1Internet_Click: el modo
  // queda encendido SIN puerto hasta desconectar y conectar. Lo que había
  // en el inbox queda retenido para el próximo puerto.
  if (imCfg) {
    imHoldInbox();
    log('Internet Mode sigue conectado sin puerto: LoadSimulation borró el ' +
        'teleporter Internet — desconectá y conectá para recrearlo');
    imState();
  }
  running = false;
  focusBot = 0;  // los slots de bot cambian al cargar
  speciesVersion = -1;
  gdDrop();
  visPrime();
  log(`sim cargada (${bytes.length} bytes), ciclo ${api.cycle(sim)}, ` +
      `${api.totalRobots(sim)} bots`);
  // E6 — HDRoutines.bas:1482-1519: el archivo dice qué charts estaban
  // visibles y el original los reabre uno a uno al cargar.
  const restore = [];
  for (let g = 1; g <= 18; g++) if (api.graphGet(sim, g, 0)) restore.push(g);
  // RV-41: NewGraph sobre un chart ya abierto no lo recrea pero sí lo
  // alimenta (main.frm:2183-2198); los que no estaban los abre la página.
  for (const g of restore) if (graphOpen.has(g)) feedGraph(g);
  if (restore.length) self.postMessage({ t: 'graphs-restore', list: restore });
  postFrame();
}

self.onmessage = (e) => {
  const msg = e.data;
  switch (msg.t) {
    case 'reset':
      running = false;
      focusBot = 0;
      // E7: StartNew_Click hace `If InternetMode Then F1Internet_Click`
      // (OptionsForm.frm:4802) — el toggle, con el modo encendido, lo APAGA.
      if (imCfg) imDisable('sim nueva (OptionsForm.frm:4802)');
      // PP-03: para llegar a "Start New" el original activa el diálogo de
      // opciones, y con la sim visible eso corre ObsRepop
      // (OptionsForm.frm:4546): las formas de ahora son las de la sim
      // nueva y de sus rondas. La ronda nueva no pasa por aquí.
      if (sim) api.obsRepop(sim);
      resetSim(msg);
      break;
    // ---- E7: Internet Mode ----
    case 'im':
      if (msg.on) {
        if (imCfg) imDisable('reconexión');
        imEnable({ name: msg.name || '', kind: msg.kind, url: msg.url || '',
                   room: msg.room || 'publica' });
        if (!imCfg) self.postMessage({ t: 'im-off' });
      } else {
        imDisable('');
      }
      break;
    case 'im-name':
      imName = String(msg.name || '');
      imRebind();
      if (imCfg) { imCfg.name = imName; ImNet.setIdentity(imName, simStartOf()); }
      imState();
      break;
    case 'select':
      focusBot = msg.n | 0;
      if (msg.seq !== undefined) selSeq = msg.seq | 0;
      if (sim) api.setFocus(sim, focusBot);  // E5: robfocus vive en el core
      postFrame();  // con la sim pausada el foco tiene que verse igual
      break;
    // ---- E5: modos de juego ----
    case 'f1start': {
      const ts = api.f1Start(sim);
      log(ts ? `contest F1: ${ts} especies en liza`
             : 'contest F1 no activo (¿opción F1 apagada?)');
      postFrame();
      break;
    }
    case 'pb':
      if (sim) api.pbOn(sim, msg.on ? 1 : 0);
      break;
    case 'pb-mouse':
      if (sim) api.pbMouse(sim, +msg.x, +msg.y);
      break;
    case 'pb-keys':
      if (sim) {
        api.pbClearKeys(sim);
        for (const k of msg.keys)
          api.pbAddKey(sim, k.memloc | 0, k.value | 0, k.invert ? 1 : 0);
      }
      break;
    case 'pb-key':
      if (sim) api.pbKeyActive(sim, msg.idx | 0, msg.active ? 1 : 0);
      break;
    case 'bot-text': {
      const n = msg.n | 0;
      const p = sim ? api.botText(sim, n) : 0;
      let text = '';
      if (p) { text = M.UTF8ToString(p); api.free(p); }
      self.postMessage({ t: 'bot-text', n, text });
      break;
    }
    case 'run':
      running = !!msg.running;
      if (running) { tickCount = 0; tpsT = performance.now(); loop(); }
      break;
    case 'speed':
      speed = msg.n | 0;
      if (running && speed === 0) loop();  // el modo máx se auto-agenda
      break;
    case 'step':
      runTicks(1);
      postFrame();
      break;
    case 'seed-species':
      lintSpecies(msg.sp);
      seedSpecies(msg.sp);
      visPrime();  // E6.5: sembrar no es nacer
      postFrame();
      break;
    case 'dna-lib': {             // RV-40: lo que la página resolvió por nombre
      for (const e of msg.entries || []) dnaLib.set(String(e.name), String(e.dna));
      const left = dnaResolve();
      const got = (msg.entries || []).length;
      if (got) log(`ADN por nombre: ${got} especie(s) de la biblioteca de la página`);
      if (left.length)
        log(`sin ADN (como el .txt ausente del original): ${left.join(', ')}`);
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
    case 'getopt':                // solo lectura (smokes)
      if (sim) self.postMessage({ t: 'opt', id: msg.id | 0,
                                  v: api.getOpt(sim, msg.id | 0) });
      break;
    case 'setcost':
      // E4: Costs(i) en vivo, como el CostsForm del original. PP-03: el
      // CostsForm solo se abre desde OptionsForm (OptionsForm.frm:2990), que
      // al activarse corrió ObsRepop; el eye designer (nocap) no.
      if (!sim) break;
      if (!msg.nocap) api.obsRepop(sim);
      api.setCost(sim, msg.i | 0, +msg.v);
      if (!msg.nocap) api.optionsOk(sim);   // RV-32 (OKButton_Click)
      break;
    case 'save':
      saveSim();
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
      tpDefaultWidth = 300;   // TeleportForm.frm:378 (el form se abrió)
      const i = api.addTeleporter(sim, 0, 0, 300, 0, 1, 1, 1, 10, 10);
      if (i > 0) api.tpSet(sim, i, 6, 1);                // heterótrofos
      log(i > 0 ? `teleporter local #${i} creado`
                : 'tope de teleporters (10) alcanzado');
      postFrame();
      break;
    }
    // ---- E3: menú Objects (shapes / mazes / teleporters) ----
    case 'shape': {
      const before = api.numObstacles(sim);
      const i = api.makeShape(sim, +msg.dw, +msg.dh);
      recolorObstacles(before);
      log(i > 0 ? `forma #${i} creada` : 'tope de formas (1000) alcanzado');
      postFrame();
      break;
    }
    case 'shapes-add10': {
      const before = api.numObstacles(sim);
      api.addRandObs(sim, 10, +msg.dw, +msg.dh);
      log(`+${recolorObstacles(before)} formas aleatorias ` +
          `(${api.numObstacles(sim)} en total)`);
      postFrame();
      break;
    }
    case 'shapes-del10':
      api.delTenObs(sim);
      log(`borradas 10 al azar; quedan ${api.numObstacles(sim)} formas`);
      postFrame();
      break;
    case 'shape-del':
      api.delObstacle(sim, msg.n | 0);
      postFrame();
      break;
    case 'shapes-clear':
      api.delAllObs(sim);
      log('todas las formas borradas');
      postFrame();
      break;
    case 'maze': {
      const before = api.numObstacles(sim);
      const cw = msg.corridor | 0, wt = msg.wall | 0;
      let n = 0;
      switch (msg.kind) {
        case 'h':       n = api.mazeH(sim, cw, wt); break;
        case 'v':       n = api.mazeV(sim, cw, wt); break;
        case 'spiral':  n = api.mazeSpiral(sim, cw, wt); break;
        case 'checker': n = api.mazeChecker(sim, cw); break;
        case 'polar':   n = api.mazePolar(sim); break;
        case 'trash':   n = api.mazeTrash(sim); break;
      }
      recolorObstacles(before);
      // DrawPolarIceMaze enciende la deriva (Obstacles.bas:123-125): la
      // página relee los ids 83/84/85 para que el panel lo refleje.
      if (msg.kind === 'polar')
        self.postMessage({ t: 'opts', vals: { 83: api.getOpt(sim, 83),
                                              84: api.getOpt(sim, 84),
                                              85: api.getOpt(sim, 85) } });
      log(`maze ${msg.kind}: +${n} formas`);
      postFrame();
      break;
    }
    case 'tp-del':
      api.delTeleporter(sim, msg.n | 0);
      postFrame();
      break;
    case 'tp-clear':
      api.delAllTps(sim);
      log('todos los teleporters borrados');
      postFrame();
      break;
    // ---- E6: registro y analisis ----
    case 'graph-open':
      if (sim) openGraph(msg.n | 0);
      break;
    case 'graph-close':
      closeGraph(msg.n | 0);
      break;
    case 'graph-update':          // boton "Update Now" (grafico.frm:4147)
      if (sim) feedGraph(msg.n | 0);
      break;
    case 'graph-query':
      if (sim) {
        api.graphSetQuery(sim, msg.which | 0, msg.q || '');
        self.postMessage({ t: 'graph-query', which: msg.which | 0,
                           q: takeStr(api.graphGetQuery(sim, msg.which | 0)) });
      }
      break;
    case 'graph-save-flag':       // chk_GDsave (grafico.frm:3868)
      if (sim) api.graphSet(sim, msg.n | 0, 1, msg.on ? 1 : 0);
      break;
    case 'graph-pos':             // graphleft/graphtop (grafico.frm:3999-4000)
      if (sim) {
        api.graphSet(sim, msg.n | 0, 2, msg.left | 0);
        api.graphSet(sim, msg.n | 0, 3, msg.top | 0);
      }
      break;
    case 'graph-filecounter':     // grafico.frm:4085 (+1 por .gsave escrito)
      if (sim) {
        const c = api.graphGet(sim, msg.n | 0, 4) + 1;
        api.graphSet(sim, msg.n | 0, 4, c);
        self.postMessage({ t: 'graph-filecounter', n: msg.n | 0, c });
      }
      break;
    case 'snapshot': {            // Database.bas:19 Snapshot (los vivos)
      const r = api.snapRun(sim, msg.withMut ? 1 : 0);
      self.postMessage({ t: 'snapshot-done', records: r,
                         snp: takeStr(api.snapTake(sim, 0)),
                         mut: msg.withMut ? takeStr(api.snapTake(sim, 1)) : '' });
      break;
    }
    case 'dead-take':             // Autosave\DeadRobots.snp del original
      self.postMessage({ t: 'dead-data', records: api.deadRecords(sim),
                         snp: takeStr(api.deadTake(sim, 0)),
                         mut: takeStr(api.deadTake(sim, 1)) });
      if (msg.drain) api.deadDrain(sim);
      break;
    case 'dead-reset':
      api.deadReset(sim);
      log('registro de muertos reiniciado');
      break;
    case 'findbest': {            // MDIForm1.frm:1398 — robfocus = fittest
      const n = api.fittest(sim);
      focusBot = n;
      self.postMessage({ t: 'focus', n });
      log(n ? `Find Best: bot #${n} (${takeStr(api.botName(sim, n))})`
            : 'Find Best: sin candidatos (fittest ignora vegetales)');
      postFrame();
      break;
    }
    case 'family': {              // parentele.frm: score tipos 0/1 y 2/3
      // Sin clearHighlight previo: el original ACUMULA (Command1 solo pone
      // highlight; el unico borrado es `unfocus`, main.frm:2155, que aqui es
      // el boton "Limpiar"). Es el mismo flag que usa el Player Bot para
      // elegir a quien pilotar — tambien en el original.
      const n = msg.n | 0, maxrec = msg.maxrec | 0 || 1000;
      const total = api.offspring(sim, n, maxrec);
      const hl = api.highlightFam(sim, n, maxrec);
      let lines = null;
      if (msg.lines) {
        ensure(scratch.fam, 4096 * 7);
        const c = api.familyLines(sim, n, scratch.fam.p, 4096);
        if (c >= 4096) log('philogeny: arbol recortado a 4096 enlaces');
        lines = Array.from(heapView(scratch.fam.p, Math.max(c, 1) * 7)
                             .subarray(0, c * 7));
      }
      self.postMessage({ t: 'family', n, total, highlighted: hl, lines });
      postFrame();
      break;
    }
    case 'clear-highlight':
      api.clearHighlight(sim);
      self.postMessage({ t: 'family', n: 0, total: 0, highlighted: 0,
                         lines: [] });
      postFrame();
      break;
    case 'console':               // Consoleform.openconsole / endconsole
      if (sim) api.consoleOpen(sim, msg.n | 0, msg.on ? 1 : 0);
      if (msg.on && sim)
        self.postMessage({ t: 'console-open', n: msg.n | 0,
                           absnum: api.botAbsnum(sim, msg.n | 0),
                           name: takeStr(api.botName(sim, msg.n | 0)),
                           genenum: api.botGenenum(sim, msg.n | 0) });
      break;
    case 'console-cmd':
      if (sim) consoleCmd(msg.n | 0, msg.line || '');
      break;
    case 'genes':
      if (sim) sendGenes(msg.n | 0);
      break;
    case 'activ':                 // ActivForm abierta/cerrada
      activOn = !!msg.on;
      if (activOn && sim && focusBot) sendGenes(focusBot);
      break;
    // ---- E6.5: vista enriquecida ----
    case 'view':
      rich = !!msg.rich;
      speciesVersion = -1;
      visPrime();
      if (!rich) { gdOn = false; if (sim) api.gendistRef(sim, 0); }
      postFrame();
      break;
    case 'gendist':
      if (!sim) break;
      api.gendistRef(sim, msg.n | 0);
      gdOn = (msg.n | 0) > 0;
      gdRoundDone = false;
      if (gdOn) gdPump(); else postFrame();
      break;
    case 'redraw':
      postFrame();
      break;
    // ---- E8: extras ----
    case 'monitor':
      monitor.on = !!msg.on;
      if (Array.isArray(msg.mem))
        for (let c = 0; c < 3; c++) monitor.mem[c] = msg.mem[c] | 0;
      postFrame();
      break;
    case 'skins':
      skinsOn = !!msg.on;
      postFrame();
      break;
    case 'eye-read': {            // showEyeDesign_Click (MDIForm1.frm:1635-1643)
      const n = msg.n | 0;
      const dir = [], wth = [];
      for (let i = 0; i < 9; i++) {
        dir.push(sim ? api.botMem(sim, n, i + EYE1DIR) : 0);
        wth.push(sim ? api.botMem(sim, n, i + EYE1WIDTH) : 0);
      }
      self.postMessage({ t: 'eye-vals', n, dir, wth });
      break;
    }
    case 'sysvar':
      self.postMessage({ t: 'sysvar', id: msg.id,
                         v: sim ? api.sysvarTok0(sim, String(msg.name || '')) : 0 });
      break;
    case 'setmem':
      if (sim) api.botSetMem(sim, msg.n | 0, msg.addr | 0, msg.v | 0);
      if (!running) postFrame();   // la rejilla de visión con la sim en pausa
      break;
    case 'ack':
      recycleFrameBuffer(msg.buf);
      canPost = true;
      if (wantFrame) postFrame();
      else if (running && speed > 0) loop();
      break;
  }
};

// ---- Arranque -------------------------------------------------------------
createDbCore({ locateFile: (f) => '../build-wasm/' + f }).then((Module) => {
  M = Module;
  bindApi();
  self.postMessage({ t: 'ready' });
}).catch((err) => {
  self.postMessage({ t: 'error', msg: String(err) });
});
