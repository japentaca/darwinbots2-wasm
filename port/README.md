# port/ — Darwinbots 2.48.32 en C++ → WASM

Port del motor conforme a la especificación de `../spec/` (el fuente VB6 es la
spec; `70-CASOS-DORADOS.md` es la suite de verdad). Arquitectura fijada en
`PLAN.md`: core C++ puro sin dependencias de render, compilado a WASM vía
Emscripten; presentación web separada.

## Estado

- **Milestone 1 (sustrato numérico)**: helpers VB6 (redondeo bancario, LCG,
  gasdev, stacks, mod32000, handlers numéricos/lógicos de la VM, bitwise) con
  los casos dorados §1 (S-01..S-07), §2 (N-01..N-19) y R-01..R-03.
- **Milestone 2 (VM y cargador)**: `ExecuteDNA` completo y cargador de texto;
  casos §3 (V-01..V-14).
- **Milestone 3 (memoria y ciclo)**: tabla completa de sysvars (255 entradas
  extraídas de `LoadSysVars`, `sysvars.hpp`), esqueleto del tick
  (`master.hpp`: pasos 10/12/14/15/16/17 de `10-CICLO.md §2`; `robots.hpp`:
  las 7 pasadas de `UpdateBots`) y los subsistemas que la memoria del bot
  necesita (`senses/ties/shots/physics.hpp`). Casos §4 (M-01..M-12).
- **Milestone 4 (física y visión)**: `Physics.bas` completo (`Repel3` con su
  respuesta de impulso, `TieHooke`/`TieTorque` con sus `[PROBABLE BUG]`,
  `bordercolls` + `ReSpawn`/`ListCells`, arrastre/gravedad de pondmode), la
  rejilla de buckets de `Quads.bas` (`buckets.hpp`), la visión completa
  (`vision.hpp`: 9 ojos apuntables, oclusión por formas rota, ojo panorámico
  por anchura negativa) y el swept-sphere de shots con compactación fiel
  (re-apuntado de `virusshot`). Casos §5 (F-01..F-15) y R-05..R-07.
  Los stubs de M3 reemplazados dejaron sus contadores de `SimDiag` a 0
  (asertado en tests); quedan como stubs registrados: `CompareShapes`
  (visión DE formas, solo con `shapesAreVisable`), `DoObstacleCollisions` y
  `DoShotObstacleCollisions` (solo con `numObstacles > 0`), y las capas
  B3b/B5/B6/B7 ya registradas.
  Dos sitios de error con decisión de port: `TieTorque` con `j > 10`
  (error 9, registra y no escribe) y `GravityForces` con `PhysMoving = 0`
  (error 11, registra y no cobra).
- **Milestone 5 (formatos ida-y-vuelta)**: `formats.hpp` — E/S sobre búferes
  en memoria (el core WASM no toca disco; la fidelidad es la del formato de
  bytes/texto). Bot de texto completo (`SalvarobText` con el gen epigenético
  autodestructivo, `DetokenizeDNA` literal con comentarios de gen y `VOID`,
  `Hash` ByRef que muta el acumulador como el original, `SaveRobHeader` con
  cap 2e9) y registro binario de bot campo a campo
  (`SaveRobotBody`/`LoadRobotBody` con `FileContinue`/centinela 254×3,
  `sint` = Mod 32000 sin clamp, solo 50 vars, `mem()` crudo, campos muertos
  de ties, escape Int→Long de `LastMutDetail`, relleno de ancestros,
  `String * 50` del tag). El cargador de texto ganó los metadatos
  `'#`/`/#` (`getvals`: generation/mutations/tag/hash con reset
  anti-manipulación) y `delgene` es real (P3 ejecuta el gen epigenético
  autodestructivo; `GeneEnd`/`genepos`/`DeleteSpecificGene` en `dna.hpp`).
  Casos §7 (FM-01..FM-07). Decisiones de port documentadas en la cabecera de
  `formats.hpp`: B8-1 (SaveSimulation recursivo → sin reintento; formato de
  sim completo pendiente para los milestones de mundo), suma de
  `SaveRobHeader` en 64 bits (el Long del original desbordaba antes del
  cap), umbral de skip de `LastMutDetail` con contador 0 (error 11 →
  infinito). El sidecar `.mrate`, `SaveSimulation`/`LoadSimulation` y
  `SaveOrganism`/`LoadOrganism` quedan para milestones posteriores (ningún
  caso dorado §7 los exige).

- **Milestone 6 (catálogo de bugs §9)**: los `[PROBABLE BUG]` como
  aserciones — B-01..B-28 + B-30 (B-29/B-31..B-35 quedan para el milestone
  de mutaciones; B-36/B-37 para el de mundo). Transcripciones arrastradas:
  visión de formas completa (`CompareShapes`/`SegmentSegmentIntersect`/
  `lookoccurrShape` en `vision.hpp`/`senses.hpp`), matanza por presión de
  memoria (`MemoryPressureKill` en `master.hpp`), alimentación de shots
  (`releasenrg`/`takenrg`/`releasebod`/`defacate` — cierra B3a),
  `MakeStuff` real (`storevenom`/`storepoison`/`makeshell`/`makeslime`),
  capa de virus B3b completa (`MakeVirus`/`copygene`/`addgene` +
  `MakeSpace`/`NewSubSpecies`/`logmutation`) y `bodyfix` configurable en
  SimOpts. Fidelidad: `nbody` de `Reproduce` en aritmética Single estricta
  (B-30). Contadores de stub cerrados y asertados a 0:
  `shapes_vision_stub`, `shot_feed_stub`, `makevirus_stub`.

- **Milestone 7 (mutaciones y reproducción sexual, B6)**: `mutations.hpp` —
  `NeoMutations.bas` completo: dispatcher `mutate` (auto-especiación,
  clamps, `mutatecolors`, re-publicación de mem(336/339) **sin**
  `makeoccurrlist` — B-35), los 11 operadores (agendas geométricas de
  Point/Point2, suelos anti-freeze que reescriben `mutarray` — B-31,
  `Insertion` con 2 mutaciones/token — B-33, `Amplification` desde t=2 —
  B-34, Minor = MajorDeletion — B-32, `Translocation`/`Amplification` con
  sus bucles de inserción "still bugy" como sitios de error 9 registrados en
  `err9_mutation_insert`), `ChangeDNA`/`ChangeDNA2` (sondeo del Max legal
  con Parse bajo `ismutating`), `DNAtoInt`/`calc_dnamatrix` (Q16) y las
  tablas `sysvarIN`(164)/`sysvarOUT`(98) extraídas mecánicamente de
  `LoadSysVars` (`sysvars.hpp`). En `robots.hpp`: la sección de crossover
  completa (`simplematch`/`GeneticDistance`/`DoGeneticDistance`/`crossover`
  con el sitio de error 9 `err9_simplematch`) y `SexReproduce` entero
  (loterías 1/10 vs 1/11 — R-10, umbral 0.6, esperma de un solo uso);
  `Reproduce` ganó la herencia restante (Mutables/Skin/color/tag/…, ADN
  desde el índice 1), el régimen Delta2/mrepro (×2-4 con `mrepro`) y el
  epireset. `sharechloroplasts` real en `ties.hpp` (umbral 0.25 de
  `DoGeneticDistance`); paso 4 del tick (oscilación de `MutCurrMult`) en
  `master.hpp`; `EraseUnit` = (−1,−1) fiel en `MakeSpace`. Semántica VB6
  replicada con cuidado: `1/Single` y `Byte/100` dividen en Double,
  `Long + Single` promociona a Double, e `IIf`/`And`/`Choose` evalúan todos
  sus operandos (la moneda de valores del crossover se consume POR token).
  Dos erratas de spec corregidas contra el fuente (R-11/B6-1: el hijo de
  padres alineados NO pierde su primer token — `Robots.bas:633` relee
  `upperbound`; el consumo de RNG del crossover es por token). Casos B-29,
  B-31..B-35, R-09..R-11. Contadores cerrados y asertados a 0:
  `mutate_stub`, `sexrepro_stub`, `makestuff_stub`.

- **Milestone 8 (mundo, B7 + formatos de sim, B8)**: cierra todos los stubs
  restantes. `vegs.hpp` — economía vegetal completa (`feedvegs` con el sol
  en banda móvil, deriva `SunOnRnd` 2 RNG/ciclo + 1 condicional, umbrales
  de energía con los 3 modos, reloj día/noche, impuesto por edad también
  fuera de banda; `feedveg2` con su moneda de orden; `checkvegstatus` con
  el nick de subespecie). `aggiungirob`/`VegsRepopulate` en `master.hpp`
  (coordenadas del llamador descartadas — B7-1; 12 extracciones por vegetal
  — R-08; `cooldown` con deuda — B-37); `altzheimer` real y `HandleWaste`
  completo en `robots.hpp` (cierra `handlewaste_stub`). Sección
  `Teleport.bas` en `robots.hpp`: `CheckTeleporters` en P0a
  (Out/Internet serializan el organismo al `outbox` en memoria y lo matan;
  B7-2: el puerto Internet solo expulsa con `PollCountDown <= 0`; local =
  2 RNG + `ReSpawn`), `DriftTeleporter`/`MoveTeleporter` (B-36: un solo
  eje de drift acumula velocidad que nunca aplica), `TeleportInBots`
  (sondeo del `inbox`, gate de 45 especies) y el paso 18 del tick.
  `Obstacles.bas` completo en `physics.hpp`/`shots.hpp`:
  `DoObstacleCollisions` (P1) y `DoShotObstacleCollisions` (cierra
  `obstacle_collision_stub`), `MoveObstacles`/`DriftObstacles` (el "tope"
  invertido del fuente que AMPLIFICA se replica tal cual). Formatos de
  nivel sim en `formats.hpp`: `SaveOrganism`/`LoadOrganism` (`.dbo`, con
  `AddSpecieFromFile`, `PlaceOrganism` y el remapeo de ties por
  `oldBotNum`), `SaveSimulation`/`LoadSimulation` campo a campo (capas
  históricas, presets de carga, `RemapAllTies`/`RemapAllShots`; quirks:
  los teleporters Internet se borran al cargar, `DisableMutations` nunca
  sobrevive una carga, `BadWastelevel` 0→400) y el sidecar `.mrate`
  (`Save_mrates`/`Load_mrates`: solo los operadores 0..10 viajan). Sitio
  de error 9 nuevo con decisión de port: `err9_load_organism` (cnum > 51).
  Casos R-08, B-36, B-37 y **R-12** (el meta-caso del orden global de RNG
  del tick: intérprete → feedveg2 → drift de formas → drift de teleporter
  → repoblación → sol, con secuencia inyectada exacta y stubs asertados a
  0). Ya no queda ningún stub abierto: los contadores de `SimDiag` que
  sobreviven son los sitios de error 9/11 con decisión de port.

- **Milestone 9 (build WASM, decisión Q07)**: la suite completa compilada y
  verificada en **tres modos**: g++ nativo, clang nativo y **WASM vía
  Emscripten corriendo bajo node** — 143 casos / 2962 aserciones en verde
  idéntico en los tres (ninguna divergencia numérica, tampoco en los casos
  [FP·Q07] de §10.1). Q07 queda verificada: determinismo del port consigo
  mismo con IEEE 754 estricto por operación. Presets de CMake
  (`CMakePresets.json`: `native-gcc` / `native-clang` / `wasm`) y semilla de
  M10: `wasm/dbcore_api.cpp` → `dbcore.js`/`dbcore.wasm` (MODULARIZE,
  `createDbCore`) con exports mínimos `db_sim_create/destroy/randomize`,
  `db_sim_insert_founder`, `db_sim_tick` y `db_sim_dump_bots` (8 floats por
  bot para render), verificados con un smoke test bajo node. Bajo Emscripten
  se compila con `-fexceptions` (el default de emcc desactiva excepciones y
  el core las usa) y la suite linkea con `-sSTACK_SIZE=8MB`,
  `-sALLOW_MEMORY_GROWTH` y `-sEXIT_RUNTIME=1` (código de salida real para
  CTest/CI).

- **Milestone 10 (capa de presentación web)**: `wasm/dbcore_api.cpp`
  ampliado con la API completa hacia JS y `web/index.html` como render 2D
  en Canvas. Todo capa host: llama a funciones ya existentes del core (no
  hubo ningún cambio en `core/`; la suite quedó intacta). La API expone:

  - *Ciclo de vida*: `db_sim_create/destroy/randomize/tick` y
    `db_sim_start(seed)` — el arranque del form transcrito de `main.frm`
    (divisores de campo, `Init_Buckets`, `shotpointer = 1`, la deuda
    `cooldown = -RepopCooldown` de B-37, `totvegs = -1` del primer ciclo y,
    con seed ≠ 0, el `Rnd -1 : Randomize seed/100` de `startloaded`).
  - *Opciones*: `db_sim_set_field` (con `xDivisor`/`yDivisor` de
    `main.frm:1432-1435`), `db_sim_set_cost/get_cost` (Costs 0..70),
    `db_sim_set_minvegs/set_repop/set_maxpop/set_max_energy/
    set_mutations/set_start_chlr`.
  - *Especies y siembra*: `db_sim_add_species` (ADN en memoria + color BGR
    decidido por el host, Q01; la especie nace con las tasas de mutación de
    fábrica y `Mutations = True`, como el AddSpecie de `OptionsForm.frm`;
    hasta el 2026-10-04 nacía con la tabla vacía y sus bots solo mutaban con
    `.mrepro`) y `db_sim_seed_species` — la siembra de
    `loadrobs` (`main.frm:1517-1573`) completa: `InsertFounder` + NoChlr,
    `chloroplasts = StartChlr`, Mutables, Skin, color y
    `GenMut = DnaLen/GeneticSensitivity`. `db_sim_insert_founder` se
    conserva (compat M9).
  - *Volcados para render* (el JS solo presenta): bots (8 floats), shots
    (6), ties (5), obstáculos (5) y teleporters (7), más contadores
    (`cycle/total_robots/totvegs/…`).
  - *Formatos sobre búferes*: `db_sim_save/load` (formato binario de sim,
    con el post-carga de `startloaded`), `db_sim_save_organism/
    load_organism` (`.dbo`) y `db_sim_bot_text` (`SalvarobText`); los
    búferes malloc'd se liberan con `db_free`. El sidecar `.mrate` no se
    exporta (archivo de conveniencia de la UI original).
  - *Teleporters*: `db_sim_add_teleporter` (transcripción de
    `NewTeleporter`, `Teleport.bas:60-105`, mismo consumo de RNG y color
    `vbWhite`) y la E/S de "archivos" en memoria:
    `db_sim_tp_outbox_count/outbox_take/inbox_push` — la capa host mueve
    los registros `.dbo` entre sims (decisión M10; el core nunca toca
    disco). `db_sim_add_obstacle` completa las altas.

  Decisiones de capa host documentadas en la cabecera de
  `wasm/dbcore_api.cpp`: teleporters por búferes, `SimGUID = 0` (nadie lo
  lee en el core) y colores decididos por la página (Q01). Verificación:
  suite en verde en los tres modos + smoke test node de la API (siembra,
  300 ticks, volcados, save→load, outbox→inbox entre dos sims) + página
  probada en Chrome (ecosistema alga/animal vivo, teleporter local,
  sin errores de consola).

- **Pendientes post-plan (familia PP, `70-CASOS-DORADOS.md §15`)**: PP-01
  — un campo con un eje de menos de 4000 dejaba la rejilla de buckets en 0
  celdas y la siembra recursaba sin fin (`EnsureBuckets`); ahora hay al menos
  1 celda por eje y se registra en `SimDiag::err9_bucket_field` (en el
  original era un error 9 inalcanzable desde su UI). Smoke:
  `node tools/pp/smoke_campo.mjs`. PP-03 (capa host) — la sim y la ronda
  nueva re-crean las formas guardadas en `xObstacle` (capturadas en "Reset"
  (sim nueva) y al cambiar opciones del panel), escaladas al campo, como
  `StartSimul` (`main.frm:1357-1365`); el compactor sobrevive y la ronda
  hereda las opciones. Smoke: `node tools/pp/smoke_formas.mjs`.

Estado verificado (2026-10-06): 273 casos / 4153 aserciones en verde (en los tres modos; incluye los tests de la revisión contra VB6, pilotos 1-14), con el plan de extensiones completo (E1..E8 y E6.5), PP-01/PP-03 y los añadidos de host del 2026-09-25/26: Inventario, Laboratorio, ajustes F1, Contest, Canal de TV e interfaz en inglés; después, E10 (ligas) y E11 (torneos unificados: Contest, Canal y Ligas en una sola ventana) (ver `spec/PROGRESO.md`), y 35 bugs del original corregidos (ver [Bugs del original corregidos](#bugs-del-original-corregidos-2026-09-29)).

## Build

Con presets (CMake ≥ 3.25; correr desde `port/`):

```
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
```

El preset `wasm` requiere la variable de entorno `EMSDK` apuntando a la raíz
del emsdk (p. ej. `EMSDK=C:/Users/<usuario>/emsdk`); toma el toolchain de
`$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake`.
Equivalente sin presets: `emcmake cmake -S port -B port/build-wasm -G Ninja`.
`ctest --test-dir port/build-wasm` también funciona (el toolchain registra
node como emulador).

El preset `wasm` produce además `build-wasm/dbcore.js` + `dbcore.wasm`: el
core como biblioteca WASM con la API de `wasm/dbcore_api.cpp` (M10).

### Página web (M10 + extensión Rendimiento)

La sim corre entera en un **Web Worker** (`web/worker.js`): el worker carga
`../build-wasm/dbcore.js`, posee el handle de sim, ejecuta los ticks y
empaqueta cada frame como **un solo `ArrayBuffer` transferible** (header de
contadores + registros de bots 8f / shots 6f / ties 5f / obstáculos 5f /
teleporters 7f, mismo layout que `db_sim_dump_*`). `web/index.html` queda
solo con UI y render Canvas 2D: dibuja el frame recibido y devuelve el búfer
con un `ack` (ping-pong: cero basura por frame y nunca más de un frame en
vuelo, así el backpressure sale solo). El protocolo de mensajes está
documentado en la cabecera de `worker.js`. La página nunca se bloquea
aunque el tick sea pesado.

Controles: iniciar/pausar, paso, velocidad (ticks/frame **o "máx"**: el
worker corre a fondo en rebanadas de ~12 ms y publica frames cuando la
página puede), seed, sembrar especie (presets Animal/Alga Minimalis o ADN
propio, con color a elección), guardar/cargar sim (formato binario de VB6
como archivo `.dbsim`) y crear un teleporter local. La barra de stats
muestra ticks/s, fps y el costo de `draw()`.

El selector de especies incluye además el **Bestiary del foro oficial**:
`web/bots/bots.json` indexa los bots bajados de forum.darwinbots.com
(569 de sus sub-boards, agrupados por sub-board: F1/F2/F3,
Short, Multi-Bots, Veggies, …), cada uno validado sembrándolo con el
propio `dbcore.wasm`. Los de Veggies se siembran como vegetales. El
archivador que los baja/valida/publica vive en `tools/bestiary/` (ver su
README); si `bots.json` no está, la página funciona igual con los dos
presets de siempre.
Desde el 2026-10-02 incluye también 115 bots del resto del foro y del wiki
(`tools/bestiary/extra/`, categorías «Forum bots» y «Wiki bots», o la de
liga/tipo cuando el autor la declara): 684 bots en total (569 + 115).

Los bots del Bestiary no van al `<select>`: se eligen desde el
**Inventario** (botón "📚 Inventory…", `web/inventory.js`), una ventana
flotante con búsqueda, filtros y agrupación (foro, arquetipo, capacidad,
tag, tamaño, favoritos), ficha por bot, tags libres, favoritos, notas,
selecciones con nombre y siembra en lote (un color por especie). El
**perfil genético** de cada bot (`web/bots/profiles.json`) lo genera
offline `tools/bestiary/analyze_bots.js`: siembra el bot con el core y
recorre su ADN ya parseado (`db_sim_bot_text`) gen por gen, anotando qué
sysvars escribe y lee y el tipo de disparo, lo que da 30 capacidades
(caza, veneno, caparazón, fotosíntesis, lazos, reproducción sexual, …) y
un arquetipo (depredador, multicelular, vegetal, defensivo, pasivo). Lo del
usuario vive en IndexedDB (`darwinbots-inventario`), identificado por
un hash del ADN canónico, así que sobrevive a una nueva corrida del
archivador; se respalda con Export/Import (JSON).

El **Laboratorio de híbridos** (botón 🧬, o "🧬 Lab" en la ficha y
en la selección del Inventario, `web/lab.js`) arma un ADN nuevo con genes
de distintos bots: se buscan por capacidad en todo el Bestiary (o se
recorren los de un bot), se ordenan y se siembran, se llevan al formulario
o se guardan en IndexedDB. Los genes vienen de `web/bots/genes.json`, el
texto de cada gen tal como lo dejó el core (verificado con una ida y
vuelta por el core para los 684 bots). El Laboratorio avisa de lo que se
rompe al mezclar: un gen que lee memoria propia que en su bot escribía otro
gen ("+ gen N" lo agrega), dos bots que usan la misma dirección propia (por
defecto se remapea la del segundo a una libre, empezando por 971-990) y los
números de gen literales en `.delgene`/`.mkvirus`. Una sim guardada que
sembró un híbrido recupera su ADN por nombre (RV-40) desde los guardados.

### Registro y análisis (etapa E6)

El menú "Recording" y el aparato de gráficas del original, en el panel
"Recording and analysis":

- **Gráficas** (`grafico.frm` + `main.frm` NewGraph/FeedGraph/CalcStats): las
  18 series de `Globals.bas:127-151`, cada una en su ventana flotante con
  leyenda, "Update Now", "Reset" y el volcado `.gsave`. El loop del worker
  alimenta cada `chartingInterval` ciclos y solo los charts abiertos, como
  `main.frm:2098-2107`; `graphvisible`/`graphleft`/`graphtop`/`graphsave`/
  `graphfilecounter` viven en el core y los persiste el formato de sim, así
  que al cargar un `.dbsim` se reabren los gráficos que estaban visibles.
  Los tres personalizables aceptan la misma consulta en notación polaca
  inversa del original (`pop avgmut avgage avgsons avgnrg avglen avgcond
  simnrg specidiv maxgd simpgenetic` + `add sub mult div pow`).
- **Snapshots** (`Database.bas`, en el core como `database.hpp`): "Snapshot
  of the living" descarga el `.snp` y el `_Mutations.txt`; "Snapshot of the
  dead" (`DeadRobotSnp`/`SnpExcludeVegs`) acumula un registro por muerte
  desde `KillRobot` y se descarga cuando se quiera.
- **Menú Robot**: "Find Best" (`fittest`), la consola por bot de
  `console.frm` con todos sus comandos (`printeye`/`printtouch`/`printtaste`/
  `printmem`/`set`/`energy`/`cycle`/`play`/`pause`/`execrob`/`showdna`/
  `debug`/`help`) y la philogeny de `parentele.frm` (descendencia total,
  familia resaltada y el árbol de parentesco de `score` tipo 3). Las barras
  de activación de genes de `ActivForm.frm` se pueblan con el `ga()` del bot
  con foco, ciclo a ciclo.

Decisión de capa host documentada en `Chart.redraw` (`web/index.html`): la
contabilidad del chart (búfer circular, poda de series, `maxy`, `.gsave`)
corre en cada punto como en el fuente, pero el **pintado** se coalesce en el
`requestAnimationFrame`. En VB6 el chart se repintaba en el mismo hilo del
loop y no podía atrasarse; aquí la sim vive en un worker y publicaría puntos
más rápido de lo que el hilo de la página dibuja.

### Vista enriquecida (etapa E6.5)

**No es superficie del original**: es una segunda forma de mirar la misma
sim, con ideas visuales de otro simulador derivado de DarwinBots (sin código
portado). El selector "View" de la barra alterna entre **Classic** (el
render de `main.frm` de siempre, idéntico píxel a píxel) y **Enriched**:

- **forma**: hexágono = vegetal, círculo con nariz al rumbo = animal, ties
  gruesas = multibot; **tono** = color de la especie; **brillo** = nrg (log).
- **anillo de acción**: lo que el bot hizo desde el último frame (disparo con
  el color de su tipo de shot, reproducción, tie nueva, venom/poison,
  shell/slime, body, gana nrg). Como los comandos de `mem` se consumen dentro
  del ciclo, la acción se define por su **efecto observable**: el wasm
  compara cada tick con el anterior (`db_sim_vis_observe`, 0,3 % del tick con
  2000 bots).
- **morfología con zoom**: borde = shell, halo = slime, púas = venom/poison,
  tinte verde = cloroplastos, ojos (llenos si ven), estados.
- **eventos**: nacimiento con línea a la madre, muerte que se encoge y apaga,
  salida por teleporter.
- **"Color by"**: especie, nrg, body, generación, mutaciones, edad, longitud
  del ADN y distancia genética al bot seleccionado (`DoGeneticDistance` en
  rebanadas de 3 ms, ≤ 1 vuelta/s).
- **inspección**: rueda = zoom, arrastrar = paneo, "follow" en el inspector,
  rastro del bot con foco y tooltip. La cámara sirve también a la vista
  original y arranca en zoom 1 (el encuadre de siempre).

Nada de esto escribe en la sim ni consume RNG: un `.dbsim` sale byte a byte
igual con la vista encendida o apagada. Coste medido con ~2150 bots y ~4300
shots: `draw()` ≈ 4 ms (mediana) con cualquier lente, contra ≈ 7 ms de la
vista original con sus 4 toggles.

Medido en esta máquina (Chrome, campo 32000², velocidad máx): con ~2000
bots el `draw()` de Canvas 2D cuesta ~4 ms/frame mientras el tick del core
cuesta ~160 ms — el cuello es la sim, no el render, así que **WebGL no
hace falta** (queda como opción futura si alguna vez el render domina).

Servir desde `port/` (el navegador no carga WASM desde `file://`):

```
cd port && python -m http.server 8000
# → http://localhost:8000/web/
```

Cualquier servidor estático sirve (`npx http-server`, etc.); el MIME
`application/wasm` es opcional (Emscripten degrada a instanciación por
ArrayBuffer si falta).

### Internet Mode (etapa E7)

El original nunca habló con la red: el menú Internet creaba un teleporter
Internet y lanzaba un programa aparte, `DarwinbotsIM.exe`, que movía los
`.dbo` entre las carpetas inbound/outbound y un servidor
(`MDIForm1.frm:1259-1380`). El port conserva esa forma: el core solo llena
y vacía los buzones del teleporter y un **cliente IM** (`web/imnet.js`,
dentro del worker) mueve los organismos entre sims. Panel "Internet Mode"
de la página:

- **Apodo** (`IntOpts.IName`): viaja como `LastOwner` en cada organismo que
  sale; vacío, el toggle sortea "Newbie N" con el RNG de la sim, como el
  original.
- **Transporte**: *Tabs of this browser* (`BroadcastChannel`, sin
  servidor: sirve también en la demo de Pages) o *WebSocket relay*.
- **Sala**: sims que se ven entre sí. El destino de cada organismo lo sortea
  el emisor entre los pares vivos; sin pares espera en cola, y lo que no se
  confirma en 8 s se re-sortea (un par que se cae no se lleva organismos).
- Cada 200 ciclos sale el censo de `writeIMdata` (`main.frm:3126`); los
  censos de los pares se listan en el panel y llenan `InternetSpecies`, que
  el color de serie de los gráficos consulta (en el original la lista nunca
  se llenaba).

Relay (Node ≥ 22, sin dependencias) — sirve además la página, así que
reemplaza al `http.server`:

```
cd port && node tools/imrelay/relay.mjs          # ws://localhost:8060/im
# → http://localhost:8060/web/  (el panel propone ese relay solo)
node tools/imrelay/relay.mjs --port 9000 --host 127.0.0.1 --no-static
```

Smoke test (dos `worker.js` reales en `worker_threads`, por
`BroadcastChannel` y por el relay; necesita `build-wasm/dbcore.js`):

```
cd port && node tools/imrelay/smoke_im.mjs
```

La etapa abrió el core en dos puntos, con casos dorados (familia E7 de
`spec/70-CASOS-DORADOS.md §14`): el tick pasa los globales de proceso
(`Sim::fmt`: apodo, sunbelt, SaveWithoutMutations) a los teleporters, y
`RemoveExtinctSpecies` poda el registro de especies en P6 (sin ella, tras 46
especies llegadas y extinguidas, el gate de `TeleportInBots` cerraba la
entrada para siempre); de paso, el alta de especies de `UpdateCounters` es
ahora el `AddSpecie` completo del original.

Semántica de las transiciones (del fuente): una **sim nueva apaga** Internet
Mode (`StartNew_Click` llama al toggle, `OptionsForm.frm:4802`); una **ronda
nueva** (F1/restart) lo conserva y los teleporters pasan tal cual al handle
nuevo; **cargar** una sim borra el puerto (`LoadSimulation`) y el modo queda
encendido sin puerto hasta reconectar. Nada se pierde en el camino: lo que
espera salir sigue en la cola del cliente y lo recibido y no cargado queda
retenido para el próximo puerto.

### Extras (etapa E8)

Capa host pura (el core no cambia; `spec/PLAN-EXTENSIONES.md §E8`):

- **Skins** (toggle "skins", arranca activado como `dispskin`): la
  polilínea de `DrawRobSkin` con su caché `oaim`/`OSkin` (en el wasm,
  `db_sim_dump_skins`) y la skin de cada especie generada por `AssignSkin`
  (`db_sim_species_assign_skin`, determinista por nombre + ADN salvo el
  `Randomize` del reloj). Con las skins a la vista el cuerpo del bot se
  pinta hueco, como el original.
- **Monitor RGB** (grupo "View menu (extras)" → "Settings for RGB Memory
  Monitor..." y toggle "monitor RGB"): el paso 23 del tick corre en el
  worker tras cada tick (`db_sim_monitor_capture`) y `DrawMonitor` en la
  página, con su aritmética de `Integer` (un rango `ceil − floor` mayor que
  32767 no dibuja nada, como el error 6 del original). Presets `.mtrp`.
- **Imagen de fondo**: "Import/Remove Background Picture"; tamaño natural
  en la esquina del canvas, fija a la ventana.
- **Eye designer** (menú Robot → "Go to eye designer..."): los 18 campos
  `.eye*dir`/`.eye*width` del bot con foco, "Write DNA ..." y los tres
  botones de "Ease of Access".

El frame del worker pasa a **13 floats de cabecera** (`extras`: bit0
monitor, bit1 skins) con los bloques nuevos al final. Smoke test (API
directa + `worker.js` real):

```
cd port && node tools/e8/smoke_e8.mjs
```

### Ajustes F1 (después del plan)

Capa host, añadida el 2026-09-26 (`spec/PLAN-EXTENSIONES.md` §"Añadidos
fuera del plan"):

- **Ajustes F1** (botón "F1 settings (the original's btnSetF1)" del panel
  de opciones): replica `btnSetF1_Click` (`OptionsForm.frm:2579-2668`):
  costes de liga, física, luz, vegetales y campo 9237×6928 toroidal. El
  grupo **"Costs"** del panel los deja editables; antes llegaban siempre
  en 0 y los bots no gastaban energía. `MaxPopulation` también es
  editable, y la ronda nueva lo conserva (`db_sim_get_base(6)`). El grupo
  "Game modes" queda para el F1 manual del original: los torneos fijan
  sus valores en cada partido.

### Torneos (E10, E11 y E12, 2026-09-27; suizo, 2026-09-28)

Capa host (`spec/PLAN-EXTENSIONES.md` §E10, §E11 y §E12). Una sola ventana,
**"🏆 Tournaments"** (`web/tournament.js`), reemplaza al Contest, al Canal
de TV y a las Ligas de antes; el modelo, la base y los partidos están en
`web/league.js` y el lanzamiento de cada partido en `web/contest.js`.

- **Todo es un torneo**, guardado en IndexedDB (`darwinbots-ligas`): reglas
  del mundo (una foto del panel de opciones: preset F1, sin costes o el
  panel actual), formato, valores del partido, participantes con el ADN
  congelado al inscribirse, temporadas (el primer partido bloquea reglas,
  formato y valores) e historial con la semilla de cada partido. Al abrir
  la ventana está el **⚡ Scratch**, un torneo en memoria para el partido
  rápido; "💾 Save as tournament" lo guarda con sus partidos.
- **Formatos**: *Single match* (todos contra todos en un solo partido, hasta
  20, el Contest de antes), *King of the hill* (el ganador se queda; gana
  la temporada el primero que se retira invicto, con un tope de 3 × N
  peleas y el primero por Elo; con "Season ends: never" la colina no
  termina nunca: cada retiro suma una 👑 y la tabla la encabeza quien
  tiene más, y con retiro 0 el rey se queda hasta que le ganen),
  *Round robin* (1 o 2 vueltas, por el método del círculo) y *Step
  ladder* (la escalera del original, `populateladder`). Toda temporada
  termina con un campeón, salvo la colina sin fin.
- **World cup** (E12): 8, 16 o 32 participantes en grupos de 4 (todos
  contra todos, 1 o 2 vueltas, jornadas intercaladas entre grupos), con
  bombos por el Elo del Hall of Fame o al azar ("🎲 Draw groups" en Setup,
  o al lanzar el primer partido). Pasan los 2 primeros de cada grupo
  (desempates: duelo directo, Elo del grupo, rondas ganadas por tope,
  ciclos, orden del sorteo) a un cuadro con el cruce del Mundial (1A-2B y
  1B-2A en mitades opuestas); eliminación directa a partido único (un nulo
  se repite) y 3.er puesto opcional. Solo se guarda el reparto de los
  grupos: tablas, cuadro y campeón salen del historial. Results dibuja las
  tablas de grupo y el cuadro (con ↻ en cada cruce) y el TV mode rotula
  la fase ("GROUP C · MATCHDAY 2", "SEMI-FINAL", "FINAL").
- **Swiss system** (2026-09-28): duelos por rondas, para ligas de 16 a 32.
  Cada ronda empareja a los de igual puntaje sin repetir rival mientras se
  pueda (con vuelta atrás); ⌈log2 N⌉ + 1 rondas o las que fije "Rounds".
  Victoria 1 y bye 1 (con N impar, al de más abajo que no lo tuvo); un nulo
  se repite. Tabla por puntos, Buchholz, Elo y rondas ganadas por
  extinción: para eso cada partido guarda `capWins`, las rondas que cada uno
  ganó por el tope de ciclos (las cuenta `worker.js` y viajan en `f1Stats`).
  Solo se guarda el orden sorteado de la ronda 1 (`S.order`, al lanzar el
  primer partido); los que se inscriben después juegan desde la temporada
  siguiente. Results muestra las rondas con sus byes y ↻ en cada cruce.
  Es el mismo suizo de `torneo.mjs swiss`, que usa estas funciones.
- **Valores del partido**, con un nombre cada uno: bots por especie
  (cada participante puede tener los suyos), energía inicial, rondas
  mínimas, victorias para ganar (`Maxrounds`, opción 98) y el tope de
  ciclos por ronda con su criterio ("most bots" o "most energy", nrg +
  body×10). El tope es del host (`db_sim_f1_cap(h, mode)`, después de
  cada tick) y sirve para N especies; generaliza el "kill losing species"
  de `F1Mode.bas:333-347`. Los topes del core para duelos (99 y 100)
  quedan en 0.
- **Tope de bots por especie** ("Max bots per species", 500 por defecto;
  0 = sin tope): la especie que lo pasa pierde a sus bots con menos
  nrg + body×10 hasta quedar en el tope, así un bot que se reproduce sin
  parar no hunde la velocidad del partido. Es del host
  (`db_sim_f1_popcap(h, cap)`, después de cada tick, mensaje
  `f1-popcap`) y generaliza la poda por `MaxPop` de `F1Mode.bas:266-312`
  (que el original solo aplica a duelos), sin su patrón B-02. Las
  temporadas guardadas antes de este tope quedan en 0 para que las
  repeticiones de sus partidos den lo mismo.
- **Participantes** (Setup): búsqueda en el Bestiary, grupos del
  Inventario (favoritos, tags, selecciones), híbridos, el ADN del
  formulario y Animal Minimalis, o **🎲 Draw** N al azar de un pool. El
  selector "Entrants" elige entre la lista fija, un sorteo nuevo en cada
  temporada o el **sorteo en cada pelea** (salvo la copa, que sortea por
  temporada, y el suizo, que sortea N al lanzar el primer partido): el rey de la colina saca del pool los retadores de cada
  pelea (tope de 3 × N peleas), la escalera sortea cada aspirante cuando
  le toca entrar (hasta N) y todos contra todos y el partido único
  sortean N al lanzar el primer partido. Los sorteados quedan inscriptos
  con su ADN congelado, así que las repeticiones siguen valiendo.
- **Play**: la próxima pelea, el marcador del partido (población,
  victorias, ronda y la regla de empate del original, más de √N + N/2
  victorias, `F1Mode.bas:361-426`) y el **📺 TV mode** (también el botón
  📺 de la barra): juega la temporada entera sin intervención, con una
  cortinilla entre peleas y un rótulo sobre el campo, anuncia al campeón
  y lanza la edición siguiente con un sorteo nuevo, en bucle.
- **Results**: tabla de cada temporada (Elo con K = 32 / (N − 1), % de
  rondas por tope, ciclos promedio), enfrentamientos directos, partidos
  con **↻** (repite con las reglas, los participantes, el orden de siembra
  y la semilla de su temporada y avisa si el resultado no coincide) y el
  **Hall of Fame** de todas las temporadas.
- **Compartir**: ⬇ exporta el torneo a un JSON (versión 2) y ⬆ lo importa
  como torneo nuevo; también acepta los archivos de ligas de E10
  (versión 1).
- Smokes: `node tools/e10/smoke_liga.mjs` (tope por energía, calendarios,
  Elo, exportar e importar), `node tools/e11/smoke_torneos.mjs` (fin de
  temporada, sorteo, Hall of Fame, Scratch, migraciones),
  `node tools/e11/smoke_sorteo_pelea.mjs` (sorteo en cada pelea) y
  `node tools/e12/smoke_copa.mjs` (grupos, bombos, desempates, cuadro,
  3.er puesto, exportar e importar con los grupos) y
  `node tools/swiss/smoke_suizo.mjs` (rondas, byes, revanchas solo
  inevitables, nulos, desempate por extinción, sorteo del orden, archivo).
- **Sin navegador**: `build/dbfight.exe` corre un partido F1 con el core
  nativo y `node tools/fight/torneo.mjs koth|swiss|duel` arma el rey de la colina o un suizo para perfilar
  con las reglas de la página (ver `tools/fight/README.md`).

La interfaz de la página está en inglés desde el 2026-09-26, como el
programa original. Los comentarios del código y las claves internas
siguen en español.

### Bugs del original corregidos (2026-09-29)

Hasta aquí el port replicaba los `[PROBABLE BUG]` del catálogo
(`spec/70-CASOS-DORADOS.md §9`). Desde el 2026-09-29 se corrigen los que se
pueden corregir **sin cambiar el lenguaje del ADN**: el cargador, la VM, los
operadores y el significado de cada sysvar quedan igual, así que un bot
existente sigue cargando y ejecutando lo mismo. La única excepción, decidida
a conciencia, es el `else` tras `start` (A2-1): 9 bots de `web/bots` lo usan
(Lionfish de 2007, Zer0Bot, TRON_F1, bots de Moonfisher…) y ahora ejecutan
un cuerpo que antes nunca corría. Las estadísticas de la sim sí
cambian (energía, disparos, repoblación, consumo de RNG). Cada corrección
lleva un comentario `Corregido <id>` en el core, y su caso dorado se invirtió
para afirmar el comportamiento nuevo. Los 571 bots de `web/bots` cargan y
corren 300 ciclos sin fallos.

**Corregidos (35)**

| Área | Id | Qué cambia |
|---|---|---|
| VM | A2-1 | El `else` que sigue a un `start` corre si las condiciones del gen son falsas (antes nunca corría). La numeración de genes no cambia. |
| Ciclo | A1-1 | `Shock` convierte la energía perdida en body (antes la destruía). |
| Ciclo | A1-3 | La matanza por presión de memoria ya no llama a `KillRobot(0)` sin candidato. |
| Ciclo | A1-5 | Un bot se encola una sola vez para reproducirse; si procede la sexual, la asexual espera. |
| Sentidos | A3-1 | `refvelsx` = −`refveldx` (valía siempre 0). |
| Sentidos | A3-2 | `EraseTRefVars` borra también `trefshell`. |
| Sentidos | A3-3 | `trefnrg` se topa en ±32000 en vez de congelarse. |
| Sentidos | A3-4 | El espionaje de ojos por tie mira `tmemloc` (mem 476), no `trefaim`. |
| Sentidos | A3-5 | `Kills`/`refkills` con tope 32000 también por la vía de shots. |
| Energía | A3-7 | `strbody`/`fdbody` negativos se borran sin efecto. |
| Energía | A3-10 | `mkchlr`/`rmchlr` negativos no hacen nada (antes `rmchlr` −100 compraba 100). |
| Física | B1-1 | `TieTorque` topa `nay` con su propio signo. |
| Física | B1-2 | `TieTorque` reajusta la última tie fijada, no el slot vacío siguiente. |
| Ties | B4-1 | Una tie nueva nace en blanco (no hereda `.ang`/`.angreg` del ocupante anterior). |
| Ties | B4-2 | Compartir con topes pasa el exceso al otro lado en vez de destruirlo. |
| Visión | B2-1 | La oclusión por formas usa los lados reales y exige cruzarlos. |
| Visión | B2-3 | Dentro de una forma, `EYEF` también va a 32000. |
| Visión | B2-4 | `lastopppos` de formas se captura para el ojo con foco. |
| Visión | B2-5 | Las formas usan el mismo ancho de ojo que los bots. |
| Shots | B3-1 | Inmunidad filial por AbsNum del tirador (antes comparaba slot con AbsNum). |
| Shots | B3-2 | Un shot huérfano puede golpear al nuevo ocupante del slot del tirador; las muertes se acreditan solo al tirador real. |
| Shots | B3-4 | `newshot` y `releasenrg` no sortean números que no usan. |
| Shots | B3-5 | Gana el bot del golpe más temprano (antes el de índice más bajo o el último). |
| Shots | B3-6 | `takewaste` topa el waste en 32000 al momento. |
| Virus | B3b-1 | Disparar un virus cobra una vez (cobraba dos). |
| Virus | B3b-2 | Penetrar la slime la agota y resta de la potencia (antes la amplificaba). |
| Virus | B3b-3 | La potencia ya no se multiplica por el número de gen copiado. |
| Repro | B6-2 | Lotería vegetal 1/11 también en la sexual (era 1/10). |
| Repro | B6-4 | El body del hijo no se redondea a entero. |
| Mutaciones | B6-5 | Los suelos anti-congelación ya no reescriben las tasas heredables. |
| Mutaciones | B6-7 | `Insertion` cuenta una mutación por token (contaba dos). |
| Mutaciones | B6-9 | Una mutación en vida rehace la firma (`makeoccurrlist`). |
| Mundo | B7-1 | `VegsRepopulate` no sortea coordenadas que se descartan. |
| Mundo | B7-3 | Un teleporter con un solo eje de deriva se mueve. |
| Mundo | B7-4 | Al cargar una sim, la primera repoblación no tarda el doble. |

**Conservados**, y por qué:

- **Los ve el ADN** (cambiarlos cambiaría lo que significa un bot): el corrimiento del cero
  inicial con `def`s y su efecto en el hijo sexual (A2-2, B6-1), las
  asimetrías de pila y operadores (A2-3 a A2-7), `mkvirus` persistente
  (B3b-4), el ojo de ancho negativo (B2-2), `.shoot` múltiplo de 1000 =
  esperma (B3-3), el puerto 0 de la tie de nacimiento (B4-3), el centinela
  32000 de `fixang` (A3-8) y `hitang` sin escritor (A3-6: en la práctica es
  memoria libre con nombre).
- **Mecánica, no error**: `ReSpawn` toroidal del organismo entero (B1-4),
  corpses que colisionan (B1-5), rejilla topada al borde (B1-6), los bots que
  se reproducen el ciclo en que mueren (A1-7), la pérdida de tramos en el
  crossover (B6-3) y los tipos de cambio venom/poison y el suelo de
  `MOVECOST` (B5-2, B5-3).
- **Sin efecto observable**: `UpdateTieAngles` sobre slots vacíos (A1-6),
  `Amplification` desde t = 2 (B6-8: un centro en t = 1 siempre lo descarta
  el control de bordes), el bucle anti-espacios del cargador (A2-8).
- **Configuración**: `bodyfix = 32100` apaga la pasada anti-gigantes (B5-1);
  elegir otro umbral sería una regla nueva, no una corrección.
- **Formato de archivo**: `sint`, el centinela 254, las `vars` 51+ y los
  AbsNum importados (B8-2 a B8-6) se conservan para leer y escribir las
  sims y los `.dbo` del original.
- Ya resueltos antes: B8-1 (el guardado no se llama a sí mismo), A1-4 (sin
  busy-wait) y los sitios de error 6/9 con decisión de port.

### Toolchain verificado (Windows 11, 2026-08-26)

| Herramienta | Versión | Origen |
|---|---|---|
| g++ | 14.2.0 | MSYS2 ucrt64 (`mingw-w64-ucrt-x86_64-gcc`) |
| clang++ | 19.1.7 | MSYS2 ucrt64 (`mingw-w64-ucrt-x86_64-clang`) |
| Emscripten (emcc) | 6.0.8 | emsdk `latest` (clonado en `~/emsdk`, `emsdk install latest && emsdk activate latest`) |
| node | 24.x | sistema (el emsdk trae su propio 24.19.0) |
| CMake / Ninja | 4.0.1 / 1.13.2 | sistema |

Los tres compiladores son de la misma familia de flags GNU/Clang, así que las
salvaguardas del `CMakeLists.txt` (`-fno-fast-math`, `-ffp-contract=off`,
`-fwrapv`) aplican idénticas en los tres modos.

## Reglas

- Los fuentes VB6 (`../Darwinbots2/`) son read-only.
- Toda conversión float→int marcada por la spec pasa por `vb_round64`/`vb_clng`
  (redondeo bancario centralizado, salvaguarda 3).
- Los sitios de error 6/9/11 del original llevan comportamiento explícito
  documentado por sitio + registro en `VmDiag` (10-CICLO.md §14).
- Nada de `-ffast-math`; sin FMA implícita (`-ffp-contract=off`).
