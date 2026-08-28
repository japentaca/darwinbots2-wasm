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
//   {t:'select', n}                        bot con foco (0 = ninguno); su
//                                          volcado de ojos/inspector viaja
//                                          en cada frame (etapa E2)
//   {t:'bot-text', n}                      → {t:'bot-text', n, text} con
//                                          db_sim_bot_text (inspector)
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
//   {t:'frame', buf, stats:{cycle,bots,vegs,tps,costx}}
//
// El frame es UN solo ArrayBuffer transferible (zero-copy) con ping-pong:
// la página lo devuelve con 'ack' al terminar de dibujar y el worker lo
// reutiliza — sin basura por frame y nunca más de un frame en vuelo (el
// backpressure sale solo: con speed>0 el ritmo lo marca el rAF de la
// página; con speed=0 el worker corre a fondo y publica cuando puede).
//
// Layout del frame (Float32Array):
//   [0..7]  header: fieldW, fieldH, nBots, nShots, nTies, nObs, nTps, focus
//           (focus = índice del bot seleccionado con volcado válido; 0 = no)
//   después: bots nBots×20, shots nShots×9, ties nTies×5,
//            obstáculos nObs×5, teleporters nTps×7
//           y, si focus > 0, el bloque de foco: 44 floats de
//           db_sim_dump_focus (inspector + 9 ojos, etapa E2)
//   (mismos registros que db_sim_dump_* — ver wasm/dbcore_api.cpp)

importScripts('../build-wasm/dbcore.js');

let M = null;   // Module de Emscripten
let api = {};   // cwraps
let sim = 0;    // handle

let running = false;
let speed = 4;          // ticks por frame; 0 = máx
let canPost = true;     // el frame anterior ya fue devuelto con 'ack'
let wantFrame = false;  // hay estado nuevo pendiente de publicar
let focusBot = 0;       // robfocus (E2): 0 = sin selección

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
    save:          C('db_sim_save', 'number', ['number', 'number']),
    load:          C('db_sim_load', null, ['number', 'number', 'number']),
    free:          C('db_free', null, ['number']),
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
                  obs: {p:0, cap:0}, tps: {p:0, cap:0}, focus: {p:0, cap:0} };

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

  const nB = maxB > 0 ? api.dumpBots(sim, scratch.bots.p, maxB) : 0;
  const nS = shotCap > 0 ? api.dumpShots(sim, scratch.shots.p, shotCap) : 0;
  const nT = tieCap > 0 ? api.dumpTies(sim, scratch.ties.p, tieCap) : 0;
  const nO = obsCap > 0 ? api.dumpObstacles(sim, scratch.obs.p, obsCap) : 0;
  const nP = tpCap > 0 ? api.dumpTeleporters(sim, scratch.tps.p, tpCap) : 0;
  // Foco (E2): si el bot murió, dumpFocus devuelve 0 y el foco se apaga.
  const nF = focusBot > 0 ? api.dumpFocus(sim, focusBot, scratch.focus.p) : 0;
  if (!nF) focusBot = 0;

  const total = 8 + nB * 20 + nS * 9 + nT * 5 + nO * 5 + nP * 7 + nF * 44;
  const buf = takeFrameBuffer(total);
  const v = new Float32Array(buf);
  v[0] = api.fieldW(sim);
  v[1] = api.fieldH(sim);
  v[2] = nB; v[3] = nS; v[4] = nT; v[5] = nO; v[6] = nP;
  v[7] = nF ? focusBot : 0;

  let off = 8;
  if (nB) { v.set(heapView(scratch.bots.p, nB * 20), off); off += nB * 20; }
  if (nS) { v.set(heapView(scratch.shots.p, nS * 9), off); off += nS * 9; }
  if (nT) { v.set(heapView(scratch.ties.p, nT * 5), off); off += nT * 5; }
  if (nO) { v.set(heapView(scratch.obs.p, nO * 5), off); off += nO * 5; }
  if (nP) { v.set(heapView(scratch.tps.p, nP * 7), off); off += nP * 7; }
  if (nF) { v.set(heapView(scratch.focus.p, 44), off); off += 44; }
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
             f1: f1Stats() },              // E5: estado del contest (o null)
  }, [buf]);
}

// ---- E5: eventos del tick y rondas ----------------------------------------
let lastReset = null;  // último msg 'reset': reconstruye la sim por ronda

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
function newRound() {
  if (!lastReset) return;
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
  const seed = (Math.floor(Math.random() * 2147483646) + 1);
  const wasRunning = running;
  resetSim({ ...lastReset, seed });
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
  const ts = api.f1Start(sim);
  log(`ronda nueva (seed ${seed})` +
      (ts ? ` — contest: ronda ${api.f1Contests(sim) + 1}` : ''));
  running = wasRunning;
}

// Tras cada tanda de ticks: eventos E5 del core + gate de rondas.
function checkGameState() {
  if (!sim) return;
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
    if (!stopped) newRound();
  }
}

// ---- Loop de ticks --------------------------------------------------------
function runTicks(n) {
  // El chequeo E5 corre tras CADA tick (como el loop de main.frm:2079-2081):
  // un evento de parada corta la tanda; una ronda nueva sigue en la sim
  // reconstruida.
  for (let i = 0; i < n; i++) {
    api.tick(sim);
    checkGameState();
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
function seedSpecies(sp) {
  const idx = api.addSpecies(sim, sp.dna, sp.name, sp.veg ? 1 : 0, 0,
                             sp.nrg, sp.color, sp.qty);
  const n = api.seedSpecies(sim, idx, 0);
  log(n > 0 ? `sembrados ${n} × ${sp.name}`
            : `ADN rechazado por el cargador (${sp.name})`);
  return n;
}

function resetSim(msg) {
  if (sim) api.destroy(sim);
  sim = api.create();
  const o = msg.options;
  api.setField(sim, o.fieldW, o.fieldH);
  api.setMinVegs(sim, o.minVegs);
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
  log(`sim nueva (seed ${msg.seed})`);
  for (const sp of msg.species) seedSpecies(sp);
  // E5: la ronda siguiente reconstruye con esto (species copiadas: las
  // siembras manuales posteriores tambien entran a la ronda).
  lastReset = { ...msg, species: [...msg.species] };
  // E5: con F1 activo el arranque corre FindSpecies (main.frm:1337-1340).
  if (api.getOpt(sim, 91)) {
    const ts = api.f1Start(sim);
    log(ts ? `contest F1: ${ts} especies en liza`
           : 'F1: sin especies de combate — sembrá 2+ y "Arrancar contest"');
  }
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
  const p = M._malloc(bytes.length);
  M.HEAPU8.set(bytes, p);
  api.load(sim, p, bytes.length);
  M._free(p);
  running = false;
  focusBot = 0;  // los slots de bot cambian al cargar
  log(`sim cargada (${bytes.length} bytes), ciclo ${api.cycle(sim)}, ` +
      `${api.totalRobots(sim)} bots`);
  postFrame();
}

self.onmessage = (e) => {
  const msg = e.data;
  switch (msg.t) {
    case 'reset':
      running = false;
      focusBot = 0;
      resetSim(msg);
      break;
    case 'select':
      focusBot = msg.n | 0;
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
      seedSpecies(msg.sp);
      if (lastReset) lastReset.species.push(msg.sp);  // E5: entra a las rondas
      postFrame();
      break;
    case 'setopt':
      // Cambio en vivo (el core lee las opciones cada tick; mismo efecto
      // que el diálogo de opciones del original sobre una sim corriendo).
      if (sim) api.setOpt(sim, msg.id | 0, +msg.v);
      break;
    case 'setcost':
      // E4: Costs(i) en vivo, como el CostsForm del original.
      if (sim) api.setCost(sim, msg.i | 0, +msg.v);
      break;
    case 'save':
      saveSim();
      break;
    case 'load':
      loadSim(msg);
      break;
    case 'teleporter': {
      // local: entra y sale en esta sim (2 RNG + ReSpawn); alto 3000 twips
      const i = api.addTeleporter(sim, 0, 0, 3000, 0, 1, 0, 0, 1, 100);
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
