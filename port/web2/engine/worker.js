// @ts-check
// Web Worker de sim de la interfaz nueva (E1 del PLAN de web2; decisión C3).
//
// Entrada de un worker CLÁSICO (Vite lo empaqueta con `worker.format:
// 'iife'`): la lógica vive en engine/sim.js (sin DOM ni `self`) y este
// archivo solo la conecta al worker. La sim entera (dbcore.wasm, el handle,
// los ticks y los volcados) vive acá; el hilo de la página queda solo con UI
// y render. Regla 4 del brief intacta: el worker NUNCA recalcula física ni
// RNG — solo llama a db_sim_* y empaqueta lo que el core vuelca.
//
// Arranque (C3/C4/C10): el primer mensaje es {t:'init', base, v}.
//   base  URL ABSOLUTA (con esquema: https:, http:, file:…) y con barra
//         final de la carpeta de dbcore.js/dbcore.wasm; p. ej.
//         `new URL('./build-wasm/', document.baseURI).href`. Absoluta porque
//         importScripts y el locateFile de Emscripten resuelven las rutas
//         relativas contra la URL del script del WORKER (Vite lo deja en
//         assets/), no contra la página (C10); con barra final porque el
//         worker concatena `base + 'dbcore.js'`. Si no cumple, el worker
//         publica {t:'error', clave:'init-base', params:{base}, msg} y no
//         carga nada.
//   v     id de build para el cache busting (C4; vacío = sin `?v=`).
// El worker hace importScripts(base + 'dbcore.js?v=…'), createDbCore con
// locateFile hacia la misma base, y publica {t:'ready'}. Los mensajes que
// lleguen antes del init o antes de que cargue el wasm se encolan y se
// procesan en orden después del 'ready' (en la clásica, port/web/worker.js,
// la página espera el 'ready' antes de mandar nada: un mensaje temprano allí
// fallaría con la API sin enlazar).
//
// Fallos (dos casos distintos):
//   - Carga (init inválido, importScripts o createDbCore): {t:'error',
//     clave:'init-base'|'carga', params, msg} y la cola se descarta. Un
//     worker con el init fallido queda inutilizable (solo acepta un init):
//     la página tiene que terminarlo y crear otro worker.
//   - Un mensaje que hace fallar a la sim (excepción de sim.handle) NO es un
//     fallo de carga: se re-lanza en diferido (como cualquier excepción sin
//     atrapar de un worker, llega a worker.onerror de la página) y el resto
//     de la cola se sigue procesando.
//
// Indicadores opcionales de la nueva (la clásica nunca los manda, así que
// con ella todo sigue igual: paridad web/ ↔ engine/):
//   reset.limpio (C15)  la sim nueva no hereda NADA de la anterior: el
//     resultado es el de un worker recién creado con la misma secuencia de
//     mensajes. Sin él, "Start New" arrastra lo que el original arrastraba
//     dentro del mismo proceso: el Player Bot, el registro de muertos y los
//     globales de E6/evo (ModeChangeCycles, strGraphQuery, graphfilecounter…;
//     db_sim_startnew_carry, RV-42..RV-44), el array de formas y los índices
//     del compactador (db_sim_obs_carry) y xObstacle (ObsRepop de la sim
//     anterior → la sim nueva regenera sus formas, PP-03). Con `limpio`: nada
//     de eso (xObstacle se vacía con db_sim_obs_repop sobre la sim recién
//     creada), y el estado de orquestación vuelve al inicial: topes del Canal
//     (f1-cap, f1-popcap) y contadores del contest, ancho por defecto de los
//     teleporters, charts abiertos (su graphvisible va en el .dbsim: la
//     página los vuelve a abrir si quiere), el apodo IM (queda vacío) y el
//     Timer de AssignSkin (se toma del reloj en ese momento, sin la tabla de
//     la sesión). Lo único que depende del reloj es strSimStart (la fecha de
//     inicio) y ese Timer: con la misma fecha, mismo escenario y misma semilla
//     dan el mismo .dbsim byte a byte en cualquier worker (lo prueba
//     test/reproducible.test.js).
//   reset.semillaColores (C15)  los colores de las formas nuevas (shape,
//     shapes-add10, maze) salen de un LCG sembrado con este valor en vez de
//     Math.random, hasta el próximo reset. Con `limpio` y sin él, el LCG se
//     siembra con `seed`. Sin ninguno de los dos, Math.random como siempre.
//   save.req / save.id  correlación: la respuesta es SIEMPRE saved (con el
//     mismo req/id) o {t:'save-error', req?, id?, clave:'save-empty'}. Sin
//     correlación, un volcado vacío solo deja un log, como la clásica.
//   bot-text.req / bot-text.id  se devuelven en la respuesta bot-text.
//   getopt.req  se devuelve en la respuesta opt (`id` ya es el de la opción).
//   {t:'ciclo', req?, id?} → {t:'ciclo', req?, id?, cycle}: el ciclo de la
//     sim en ese punto de la cola (-1 sin sim). Con la sim en pausa, lo que
//     llegue después se aplica en ese ciclo: así un cambio en caliente queda
//     registrado en el ciclo exacto (decisión 13).
//   load.req / load.id  tras cargar contesta {t:'loaded', req?, id?, cycle,
//     bots, missing[]} (missing = especies sin ADN, lo mismo que el
//     dna-missing que va antes). Sin correlación, como la clásica.
//   {t:'muestreo', cada?, grupos?, linaje?, dominante?, bins?, vegMode?, req?}
//     (N2, decisiones 7-9) muestreo automático de métricas con los exports
//     de SOLO LECTURA de E2 (no escribe en el Sim ni consume su RNG: lo
//     prueba test/muestreo_worker.test.js). cada = ciclos entre
//     muestras (por defecto 100; 0 = apagar); publica una muestra en cada
//     ciclo múltiplo de `cada` y otra enseguida si la sim ya tuvo su primer
//     ciclo (el punto de partida). grupos ⊆ poblacion, evolucion, genetica,
//     comportamiento, energia, entorno (sin lista, los seis). 'genetica'
//     suma los 9 histogramas (bins, por defecto 20; vegMode 0 todos, 1 sin
//     vegetales, 2 solo vegetales). 'comportamiento' enciende el acumulador
//     de db_sim_behavior_*, que exige db_sim_vis_observe tras CADA tick
//     aunque la vista sea la clásica: es el grupo que más cuesta (ver
//     engine/sim.js). linaje = true: db_sim_dump_lineage tras cada tick
//     para juntar los nacidos entre muestras. dominante = k: el ADN
//     dominante de cada especie cada k muestras (el texto solo cuando su
//     hash cambió). Es estado de orquestación, como la vista: sigue tras
//     reset (también `limpio`), carga y ronda nueva. Cada muestra lleva el
//     `req` del último muestreo (la página descarta las de una sim vieja).
//   {t:'linaje', req?}  → {t:'linaje', req?, ciclo, filas, origen, nombres}
//   {t:'dominante', req?} → {t:'dominante', req?, ciclo, especies[]} (con el ADN)
//     El pedido suelto no cambia qué textos manda la muestra siguiente
//     (el «solo cuando cambió» es entre muestras).
//   Sin importScripts (vite dev sirve el worker como MÓDULO, donde
//     importScripts no existe o lanza): dbcore.js se pide con fetch y se
//     evalúa como cuerpo de una función que devuelve createDbCore. El
//     build (worker clásico, C3) y la clásica siguen con importScripts.
//
// Protocolo (página → worker):
//   {t:'init', base, v}                    primero: dónde está el wasm (C3)
//   {t:'reset', seed, options, species[], limpio?, semillaColores?}
//                                          nueva sim + siembra inicial
//   {t:'run', running}                     arrancar/pausar el loop de ticks
//   {t:'speed', n}                         n ticks por frame; 0 = máx
//                                          (corre a fondo en rebanadas ~12ms)
//   {t:'step'}                             un tick suelto
//   {t:'seed-species', sp}                 sembrar especie del formulario
//                                          → {t:'lint', name, issues[]}
//                                          (tokens del ADN que valen 0)
//   {t:'lint-dna', dna, req?, id?}         N3.3 (nueva): lint del editor de ADN
//                                          → {t:'lint-dna', req?, id?, issues[]}
//                                          (db_dna_lint, sin sembrar ni tocar
//                                          la sim; anda también sin sim)
//   {t:'trace-dna', dna, mem?, seed?, req?, id?}  PLAN-EDITOR E1: traza de un
//                                          gen para el visor de pila → {t:'trace-dna',
//                                          req?, id?, tsv} (db_dna_trace; mem = 1001
//                                          enteros de la memoria de ejemplo o ausente;
//                                          anda sin sim y no la toca)
//   {t:'dna-lib', entries:[{name,dna}]}    RV-40: ADN por nombre de especie
//   {t:'setopt', id, v, nocap?}            opción E1 en vivo (tabla de ids
//                                          en wasm/dbcore_api.cpp)
//   {t:'getopt', id, req?}                 → {t:'opt', id, v, req?} (solo lectura)
//   {t:'setbase', vals, nocap?}            C12: opciones 'base' en vivo, con
//                                          los exports del reset:
//                                          vals = {minVegs?, maxPopulation?,
//                                          repopAmount?, repopCooldown?,
//                                          maxEnergy?, startChlr?,
//                                          mutations?}; fieldW/fieldH no
//                                          son vivos (se ignoran con un
//                                          log). Pasa por el diálogo de
//                                          opciones como setopt (salvo nocap)
//   {t:'setcost', i, v, nocap?}            E4: Costs(i) en vivo (índices de
//                                          SimOptions.bas:2-39; 51..62 =
//                                          costes dinámicos)
//   {t:'save', req?, id?}                  → {t:'saved', bytes, cycle, req?, id?}
//                                          (o save-error, ver arriba)
//   {t:'load', bytes, req?, id?}           cargar sim binaria (transferido)
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
//   {t:'f1-cap', cycles, mode?}            Canal: tope de ciclos por ronda ('pop' | 'nrg')
//   {t:'f1-popcap', n}                     Canal: tope de bots por especie (0 = sin tope)
//   {t:'pb', on, seguirFoco?}              seguirFoco (N4.1, opcional de la
//                                          nueva): con el modo encendido, si
//                                          el core mueve robfocus (muere el
//                                          bot controlado y KillRobot pasa el
//                                          foco al último resaltado vivo), el
//                                          foco del frame lo sigue y avisa
//                                          con {t:'pb-focus'}. Sin él, el
//                                          foco se suelta como en la clásica
//   {t:'pb-mouse', x, y}                   E5: Player Bot Mode (paso 13)
//   {t:'pb-keys', keys:[{memloc,value,invert}]} · {t:'pb-key', idx, active}
//   {t:'select', n, seq?}                  bot con foco (0 = ninguno); su
//                                          volcado de ojos/inspector viaja
//                                          en cada frame (etapa E2); seq
//                                          vuelve en stats.selSeq (E6.5)
//   {t:'bot-text', n, req?, id?}           → {t:'bot-text', n, text, req?, id?}
//                                          con db_sim_bot_text (inspector)
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
//   {t:'activ', on}                        E6: ActivForm abierta/cerrada
//   {t:'view', rich}                       E6.5: vista enriquecida on/off
//   {t:'gendist', n}                       E6.5: lente de distancia genética
//                                          al bot n (0 = apagada)
//   {t:'redraw'}                           E6.5: frame fresco sin tick
//                                          (cámara y efectos con la sim en
//                                          pausa)
//   {t:'im', on, name, kind, url, room}    E7: Internet Mode (F1Internet_Click
//                                          + el cliente IM de engine/imnet.js);
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
//   {t:'ciclo', req?, id?}                 → {t:'ciclo', req?, id?, cycle} (nueva)
//   {t:'sysvar', id, name}                 E8: SysvarTok sin bot →
//                                          {t:'sysvar', id, v}
//   {t:'ack', buf}                         devuelve el búfer del último frame
//
// Protocolo (worker → página):
//   {t:'ready'} · {t:'error', clave, params, msg} (ver Fallos) · {t:'log', msg} ·
//   {t:'saved', bytes, cycle, req?, id?} · {t:'save-error', req?, id?, clave} ·
//   {t:'loaded', req?, id?, cycle, bots, missing[]} (solo con correlación) ·
//   {t:'stopped'}                          E5: el core pidió parar la sim
//                                          (Form1.Active = False del original)
//   {t:'f1-note', kind}                    contest: 'single' | 'many' | 'cap'
//   {t:'f1-started', n}                    respuesta a f1start (nº especies)
//   {t:'f1-over', winner, f1, cycles}      E5: contest terminado (E10: marcador y ciclos) ·
//   {t:'bot-text', n, text} · {t:'lint', name, issues[]} · {t:'opt', id, v} ·
//   {t:'lint-dna', req?, id?, issues[]}    N3.3: issues = [{kind, token, count,
//                                          line, hint}] como las de 'lint'
//                                          (line: primera línea, base 1; 0 =
//                                          del archivo entero)
//   {t:'trace-dna', req?, id?, tsv}        PLAN-EDITOR E1: el TSV de la traza tal
//                                          cual (formato en PLAN-EDITOR.md, sin
//                                          cabecera; lo parsea engine/pila.js)
//   {t:'dna-missing', names[]}             RV-40: especies cargadas sin ADN
//   {t:'opts', vals:{id: v}}               opciones que cambió el core (E3:
//                                          polar ice enciende la deriva) —
//                                          la página actualiza su panel
//   {t:'graph-data', n, series:[{name,color,value}], cycle, interval} ·
//   {t:'graph-query', which, q} · {t:'graph-filecounter', n, c} ·
//   {t:'graphs-restore', list[]} ·
//   {t:'snapshot-done', records, snp, mut} · {t:'dead-data', records, snp, mut} ·
//   {t:'focus', n} · {t:'family', n, total, highlighted, lines} ·
//   {t:'pb-focus', n, prev}                N4.1 (solo con seguirFoco): el foco
//                                          pasó de prev a n (0 = nadie quedó
//                                          controlado), antes del frame
//   {t:'console-open', n, absnum, name, genenum} · {t:'console-out', n, text} ·
//   {t:'genes', n, ga[]} · {t:'running', running}   (etapa E6)
//   {t:'eye-vals', n, dir[9], wth[9]} · {t:'sysvar', id, v}   (etapa E8)
//   {t:'frame', buf, stats:{cycle,bots,vegs,tps,costx,f1,dead,selSeq}}
//   {t:'species', names[]}                 E6.5: tabla de especies de la
//                                          vista (antes del frame que la usa)
//   {t:'gendist-off'}                      E6.5: la referencia murió o la sim
//                                          cambió (reset, ronda nueva, carga)
//   {t:'im-state', st}                     E7: estado del cliente IM (pares,
//                                          censos, InternetSpecies, colas) —
//                                          a lo sumo 4 por segundo
//   {t:'im-log', lines[]}                  E7: salidas/llegadas en tandas
//   {t:'im-off'}                           E7: Internet Mode quedó apagado
//   {t:'muestra', req?, ciclo, cada, grupos[], metrics, especies[],
//     histogramas, comportamiento, linaje, dominante}   N2 (solo con muestreo):
//     metrics     Float32Array(56) de db_sim_metrics (columnas: METRICAS de
//                 engine/metricas.js)
//     especies    [{nombre, indice, stats: Float32Array(27)}] por especie
//                 viva (db_sim_species_stats; CAMPOS_ESPECIE). El NOMBRE es
//                 la clave: el índice de la tabla de la vista se reinicia
//                 tras una carga. Sin la fila «Corpse».
//     histogramas null | {bins, vegMode, n: Int32Array(9), datos:
//                 Float32Array(9 × (bins+2))}: kind k (HISTOGRAMAS) en
//                 datos[k·(bins+2) …] = [mín, máx, bins…]; n[k] = bots
//     comportamiento null | [{nombre, indice, datos: Float32Array(26)}] lo
//                 acumulado desde la muestra anterior (CAMPOS_COMPORTAMIENTO)
//     linaje      null | {filas, nacidos, origen: Int32Array, nombres[]}:
//                 filas = db_sim_dump_lineage de ahora (12 int32/bot,
//                 CAMPOS_LINAJE), nacidos = filas de los AbsNum vistos por
//                 primera vez desde la muestra anterior (aunque ya no
//                 existan), origen = db_sim_species_origin (5 int32/especie),
//                 nombres = tabla de la vista por índice
//     dominante   null | [{nombre, indice, slot, abs, copias, adnLen, hash, adn?}]
//     Los typed arrays viajan transferidos.
//
// El frame es UN solo ArrayBuffer transferible (zero-copy) con ping-pong:
// la página lo devuelve con 'ack' al terminar de dibujar y el worker lo
// reutiliza — sin basura por frame y nunca más de un frame en vuelo (el
// backpressure sale solo: con speed>0 el ritmo lo marca el rAF de la
// página; con speed=0 el worker corre a fondo y publica cuando puede).
//
// Layout del frame (Float32Array): ver engine/protocolo.js (constantes H,
// HEADER, REG y seccionesFrame). Resumen:
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

import { crearSim } from './sim.js';

/** @type {any} */
const ambito = globalThis;

/** @type {{ handle: (msg: any) => void } | null} */
let sim = null;
/** @type {any[] | null} cola de mensajes previos al 'ready' (null = descartar) */
let cola = [];
let iniciado = false;

/**
 * @param {any} msg
 * @param {Transferable[]} [transfer]
 */
function post(msg, transfer) {
  ambito.postMessage(msg, transfer);
}

/**
 * true si `base` es una URL absoluta con barra final.
 * @param {string} base
 */
function baseValida(base) {
  if (!base.endsWith('/')) return false;
  try {
    new URL(base); // sin base: solo acepta URLs con esquema
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * Un mensaje a la sim; su excepción se re-lanza en diferido para que llegue a
 * worker.onerror como una normal, sin cortar la cola ni contar como fallo de
 * carga.
 * @param {any} m
 */
function atender(m) {
  try {
    /** @type {any} */ (sim).handle(m);
  } catch (err) {
    setTimeout(() => {
      throw err;
    });
  }
}

/**
 * @param {string} base
 * @param {string} [v]
 */
function arrancar(base, v) {
  if (!baseValida(base)) {
    fallar('init-base', { base }, `init.base must be an absolute URL ending in '/': ${base}`);
    return;
  }
  const q = v ? `?v=${encodeURIComponent(v)}` : '';
  const url = `${base}dbcore.js${q}`;
  cargarScript(url).then(
    () =>
      ambito.createDbCore({ locateFile: (/** @type {string} */ f) => `${base}${f}${q}` }).then(
        (/** @type {any} */ Module) => {
          sim = crearSim({ Module, post });
          post({ t: 'ready' });
          vaciarCola();
        },
        (/** @type {unknown} */ err) => fallar('carga', {}, String(err)),
      ),
    (/** @type {unknown} */ err) => fallar('carga', {}, String(err)),
  );
}

/**
 * Carga dbcore.js (script clásico MODULARIZE que define `createDbCore`). En
 * un worker clásico, con importScripts (como la clásica). En un worker
 * módulo (vite dev) importScripts no existe o lanza un TypeError: entonces
 * fetch y el texto como cuerpo de una función que devuelve createDbCore
 * (queda en globalThis, como con importScripts). Un fallo de red de
 * importScripts no se reintenta con fetch.
 * @param {string} url
 * @returns {Promise<void>}
 */
function cargarScript(url) {
  if (typeof ambito.importScripts === 'function') {
    try {
      ambito.importScripts(url);
      return Promise.resolve();
    } catch (err) {
      if (!esWorkerModulo(err)) return Promise.reject(err);
    }
  }
  return fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`${url}: ${r.status}`);
      return r.text();
    })
    .then((texto) => {
      // Como función (no ve las variables de este módulo): el `var
      // createDbCore` del script queda local y se devuelve.
      const crear = new Function(`${texto}\n;return createDbCore;`)();
      if (typeof crear !== 'function') throw new Error('dbcore.js did not define createDbCore');
      ambito.createDbCore = crear;
    });
}

/**
 * El error de importScripts en un worker módulo («Module scripts don't
 * support importScripts()»): un TypeError, a diferencia del NetworkError de
 * un script que no se pudo bajar.
 * @param {unknown} err
 */
function esWorkerModulo(err) {
  return err instanceof TypeError;
}

// Separado de la carga: una excepción de un mensaje no es un fallo de carga.
function vaciarCola() {
  const pendientes = cola || [];
  cola = null;
  for (const m of pendientes) atender(m);
}

/**
 * Fallo de carga: se publica y la cola se descarta.
 * @param {string} clave
 * @param {Record<string, any>} params
 * @param {string} msg  detalle técnico (para el registro)
 */
function fallar(clave, params, msg) {
  cola = null;
  post({ t: 'error', clave, params, msg });
}

/** @param {MessageEvent} e */
ambito.onmessage = (e) => {
  const msg = e.data;
  if (msg && msg.t === 'init') {
    if (iniciado) return; // un solo init por worker
    iniciado = true;
    arrancar(String(msg.base || ''), msg.v ? String(msg.v) : '');
    return;
  }
  if (sim) atender(msg);
  else if (cola) cola.push(msg);
};
