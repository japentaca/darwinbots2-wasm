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

Estado verificado: 143 casos / 2962 aserciones en verde.

## Build (nativo)

```
cmake -S port -B port/build -G Ninja
cmake --build port/build
port/build/dbtests
```

Toolchain actual: g++ (MSYS2 ucrt64). Pendiente: instalar clang y emsdk para
verificar el build WASM (misma familia de compilador que Emscripten minimiza
divergencias; decisión Q07: IEEE 754 estricto por operación, determinismo bit a
bit del port consigo mismo).

## Reglas

- Los fuentes VB6 (`../Darwinbots2/`) son read-only.
- Toda conversión float→int marcada por la spec pasa por `vb_round64`/`vb_clng`
  (redondeo bancario centralizado, salvaguarda 3).
- Los sitios de error 6/9/11 del original llevan comportamiento explícito
  documentado por sitio + registro en `VmDiag` (10-CICLO.md §14).
- Nada de `-ffast-math`; sin FMA implícita (`-ffp-contract=off`).
