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
    decidido por el host, Q01) y `db_sim_seed_species` — la siembra de
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

Estado verificado: 143 casos / 2962 aserciones en verde (en los tres modos).

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

### Página web (M10)

`web/index.html` carga `../build-wasm/dbcore.js`, siembra especies desde
texto de ADN y corre el tick en un loop de `requestAnimationFrame`,
dibujando bots/shots/ties/obstáculos/teleporters en Canvas 2D. Controles:
iniciar/pausar, paso, velocidad (ticks/frame), seed, sembrar especie
(presets Animal/Alga Minimalis o ADN propio, con color a elección),
guardar/cargar sim (formato binario de VB6 como archivo `.dbsim`) y crear
un teleporter local. Servir desde `port/` (el navegador no carga WASM
desde `file://`):

```
cd port && python -m http.server 8000
# → http://localhost:8000/web/
```

Cualquier servidor estático sirve (`npx http-server`, etc.); el MIME
`application/wasm` es opcional (Emscripten degrada a instanciación por
ArrayBuffer si falta).

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
