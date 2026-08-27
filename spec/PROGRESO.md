# PROGRESO

Estado de la extracción. Se actualiza al cerrar cada documento, para sobrevivir
reinicios de contexto.

**Fuente:** DarwinBots 2.48.32 (`Darwinbots2/Iersera.vbp`), 53 327 LOC.
**Regla:** el fuente es la spec. El wiki no entra. Los fuentes son read-only.

---

## Hecho

| Documento | Estado | Nota |
|---|---|---|
| `00-INVENTARIO.md` | ✅ cerrado | Fase 0. Versión, flags de compilación, código muerto, mapa de módulos, loop localizado, RNG localizado. |
| `PLAN.md` | ✅ cerrado | Orden de lectura y bloques A/B/C. Aprobado (el Bloque A arrancó por orden del brief). |
| `10-CICLO.md` | ✅ cerrado | **A1.** Iteración secuencial in situ, sin doble búfer. `UpdateBots` = 7 pasadas. Nacimientos antes que muertes en `ReproduceAndKill`. 7 `[PROBABLE BUG]`. Q04 resuelta; Q01 y Q03 parciales. |
| `20-VM.md` + `opcodes.yaml` | ✅ cerrado | **A2.** Parser y VM completos: 77 opcodes con semántica numérica exacta. Stacks de 101 celdas que nunca fallan (overflow descarta el fondo; underflow: 0 / centinela −5 = "vacío es true"). Stores inmediatos confirmados (`CommandQueue` muerto). **`else` tras `start` es código muerto** (`DNA.bas:1178`). El tokenizador no rechaza nada (desconocido → número 0). Q12 resuelta; Q15-Q17 añadidas. |
| `21-MEMORIA.md` + `sysvars.yaml` | ✅ cerrado | **A3, cierra el Bloque A.** Mapa completo de `mem(0..1000)`: 247 direcciones con nombre + 971-990 (memoria genética sin nombre) + `mem(0)` como sumidero de venom/poison (exclusión 340). Latencia 1 ciclo para todos los sentidos; comandos consumidos en el mismo ciclo. Q15 resuelta (nada fuera de ±32000 en juego normal). `sysvarIN`/`sysvarOUT` = vocabulario de mutaciones. 10 `[PROBABLE BUG]` (refvelsx siempre 0, trefshell sin borrar, Kills sin clamp…). Q03(mem), Q11, Q14(A3), Q15 cerradas. |
| `30-FISICA.md` | ✅ cerrado | **B1.** Euler semi-implícito en dos tiempos; fricción/arrastre mutan `vel` directo; librería de vectores con clamps ByRef ocultos; masa incluye cloroplastos (1..32000); `Repel3` con efectos sensoriales inmediatos; bugs de `TieTorque` (Sgn cruzado, escritura en slot fantasma). |
| `32-VISION.md` | ✅ cerrado | **B2.** 9 ojos apuntables; alcance = f(anchura); **oclusión por formas rota dos veces** (bordes transpuestos + `Or`); `PI\36` división entera; `lastopppos` solo del ojo frontal; fórmulas de anchura distintas bots/formas. |
| `33-SHOTS.md` | ✅ cerrado | **B3a.** Ciclo de vida, swept-sphere con sesgo por índice, efectos por tipo. **Inmunidad filial rota** (slot vs AbsNum); slot tirador intocable; `.shoot` múltiplo de 1000 = esperma; 2 RNG/disparo (1 muerto). |
| `35-VIRUS.md` | ✅ cerrado | **B3b.** mkvirus→Vtimer(2×gen)→vshoot; doble cobro en `Vshoot`; potencia ∝ número de gen; slime penetrada amplifica; delgene blindado. |
| `34-TIES.md` | ✅ cerrado | **B4.** Máx 9 ties; puertos asimétricos; endurecimiento a los 19 ciclos define multibot; sharing destruye recursos en los caps; slot 10 fantasma con `.ang` heredable. Q03(Ties) cerrada. |
| `36-REPRO.md` | ✅ cerrado | **B6a.** Reproduce/SexReproduce/crossover. ~~El hijo sexual pierde su primer token~~ (corregido en M7: solo con padres asimétricos en dna(0) — ver R-11); loterías vegetales asimétricas; crossover no determinista con pérdida de tramos. |
| `40-MUTACIONES.md` | ✅ cerrado | **B6b.** 11 operadores; agenda geométrica vs Bernoulli/token; **suelos anti-freeze reescriben las tasas heredables**; Minor=Major salvo defaults; Q16 resuelta (77 comandos, DNAtoInt max 32767). |
| `50-MUNDO.md` | ✅ cerrado | **B7.** Repoblación por cloroplastos (no por vegetales); sol en banda móvil; teleporters = E/S de disco en el tick (Q10); capa torneo deslindada; Q05 resuelta (Roborder pre-buckets). |
| `60-FORMATOS.md` | ✅ cerrado | **B8.** Texto/.dbo/sim binaria; versionado FE×3 + FileContinue; solo 50 vars persistidas; `sint` = Mod 32000; gen epigenético autodestructivo; **SaveSimulation recursivo en error**; Q01 completa, Q06 y Q14 resueltas. |
| `31-ENERGIA.md` + `constants.yaml` | ✅ cerrado | **B5, cierra el Bloque B.** Libro mayor del nrg/body/waste/cloroplastos por fase del tick; **P4 anti-gigantes muerta con `bodyfix=32100`**; venom 1:1 vs poison 4:1; constants.yaml con 3 capas (compiladas/arranque/preset F1). |
| `70-CASOS-DORADOS.md` | ✅ cerrado | **Bloque C, cierra la especificación.** ~110 casos en 8 familias (suite de autores minada, numérica base, VM/flujo, memoria/ciclo, física/visión, RNG inyectado, formatos, catálogo completo de `[PROBABLE BUG]` como aserciones + 10 sitios de error con decisión de port). Hallazgo: los tests de `fRnd` de los autores fallaban probabilísticamente (S-02). Correcciones derivadas: conteo RNG de repoblación en `50-MUNDO.md §2.1` (12, no 10-11) y nota de `CubicTwipPerBody` en `constants.yaml`. Sin casos `[PENDIENTE DE BINARIO]` bloqueantes (solo 2 observaciones de confirmación, §10.1). |
| `OPEN_QUESTIONS.md` | ✅ sin abiertas | **Todas las preguntas cerradas** (2026-08-16): Q01-Q17 resueltas; Q09 = irresoluble en este entorno (ni el EXE ni el IDE de VB6 corren en el Windows 11 del proyecto — validación empírica descartada; se levantó la veda de fuentes secundarias para las preguntas de runtime: Q02 con el runtime VB de dotnet/runtime, Q17 con la corrección de flags, Q07/Q08/Q13 por análisis y decisión de port). |

> ⚠️ **CORRECCIÓN DE PREMISA (2026-08-16)** — Los flags `=0` de `Iersera.vbp:92-101` son
> casillas de "Advanced Optimizations" **sin marcar**: el EXE distribuido compila **con**
> chequeos de límites/overflow/FP (0 = default = chequear; −1 = eliminar). La premisa del
> brief y de la Fase 0 ("overflow envuelve, índices no fallan") estaba invertida. Errores
> 6/9/11 ocurren en el EXE igual que en el IDE, y con `ignoreerror` (default desde 2014)
> **truncan el resto del tick en silencio** — contrato completo en `10-CICLO.md §14`,
> corrección de origen en `00-INVENTARIO.md §1`. Documentos barridos y corregidos:
> `00-INVENTARIO`, `10-CICLO`, `20-VM`, `opcodes.yaml`, `21-MEMORIA`, `30-FISICA`,
> `PLAN`, `PROMPT-BLOQUE-C`, `OPEN_QUESTIONS`. Los `PROMPT-BLOQUE-A/A2/A3/B.md` se
> conservan sin tocar como registro histórico (contienen la premisa vieja).

## Port C++/WASM (`port/`) — arrancado 2026-08-24 por orden del usuario

| Milestone | Estado | Nota |
|---|---|---|
| M1 · Sustrato numérico | ✅ cerrado | Salvaguarda 5: casos §1 (S-01..S-07), §2 (N-01..N-19) y R-01..R-03 en verde (30 casos, 438 aserciones). Helpers: redondeo bancario, LCG VB6, gasdev, stacks, mod32000, handlers VM, bitwise. Sitios de error con decisión de port + `VmDiag` (N-07 satura a ±2·10⁹; S-05 a 16384). |
| M2 · VM y cargador | ✅ cerrado | Casos §3 (V-01..V-14) en verde. `ExecuteDNA` completo (bug del `else` canónico replicado, stores inmediatos, `CondStateIsTrue` sin consumo, 14 stores con asimetrías de pops y tie-flags), cargador de texto (Parse + 8 tablas, sombreado de privadas, corrección del cero inicial, 3 sitios de rechazo). Decisión de port V-07: solo-defs = no-op registrado. Total acumulado: 44 casos, 1539 aserciones. |
| M3 · Memoria y ciclo | ✅ cerrado | Casos §4 (M-01..M-12) en verde. Tabla completa de sysvars (255 entradas extraídas mecánicamente de `LoadSysVars` y verificadas contra `sysvars.yaml`: 247 direcciones, 8 pares de alias). Esqueleto del tick (pasos 10/12/14/15/16/17 + 7 pasadas de `UpdateBots`) y subsistemas de memoria: sentidos (touch/taste/lookoccurr con A3-1, Erase*), ties (maketie/Update_Ties con gates de M-04, trefvars con A3-2, tieportcom, memoria genética), shots (robshoot/newshot/updateshots con remapeo 340→mem(0), bloqueo por poison, esperma), Reproduce completo (epimem, tie de nacimiento, herencia del timer post-Ageing), corpses (M-12). Corrección menor a `70-CASOS-DORADOS.md` M-11: el sysvar `vshoot` es 338, no 836 (el fuente manda, `Robots.bas:59` + `DNATokenizing.bas:1045`). Colisiones bot/shot con detección simplificada y pasadas de otros milestones como stubs registrados en `SimDiag` (decisiones de port hasta F-*). Total acumulado: 56 casos, 1714 aserciones. |
| M4 · Física y visión | ✅ cerrado | Casos §5 (F-01..F-15) + R-05..R-07 en verde. `Physics.bas` completo: `Repel3` (masas invertidas en la separación, impulso 1-D, fijo = 32000, efectos sensoriales inmediatos), `TieHooke` (purga in situ, reloj, muelle con zona muerta 20), `TieTorque` (B1-1 replicado; slot fantasma con guardia de error 9), `bordercolls` + `ReSpawn`/`ListCells`, `SphereCd`/arrastre, gravedad pondmode (PhysMoving = 0 = sitio de error 11 registrado). Buckets de `Quads.bas` (`buckets.hpp`, rejilla 4000×4000 con arrays empaquetados) y visión completa (`vision.hpp`: 9 ojos apuntables, disyunción literal de 10 cláusulas, `ShapeBlocksBot` rota B2-1, ojo panorámico B2-2, `eyestrength`). `NewShotCollision` swept-sphere (sesgo `MinBotRadius`, el retorno es el ÚLTIMO robnum con raíces — documentado) y `CompactShots` fiel (re-apunta `virusshot`, destruye huérfanos, copia el hueco muerto). Stubs de M3 reemplazados (contadores `SimDiag` asertados a 0); quedan registrados: `CompareShapes` (visión DE formas), obstáculos (`numObstacles > 0`) y capas B3b/B5/B6/B7. Tres erratas de spec corregidas contra el fuente: F-07 (`angle(0,0,−10,10) = 3.926991`), F-10 (edge 0 ⇒ 32000, test `<= 0`), 32-VISION §2.4 (la división del semiancho es real, no entera; efecto panorámico intacto). Total acumulado: 75 casos, 1931 aserciones. |

| M5 · Formatos ida-y-vuelta | ✅ cerrado | Casos §7 (FM-01..FM-07) en verde. `formats.hpp`: E/S sobre búferes en memoria (decisión de M5: el core WASM no toca disco; la fidelidad es la del formato de bytes/texto). Bot de texto completo (`SalvarobText` + gen epigenético autodestructivo, `DetokenizeDNA` literal con comentarios de gen/`VOID`, `Hash` ByRef que muta el acumulador del llamador — fiel al original, clave para que el hash cuadre en la ida-y-vuelta —, `SaveRobHeader` con cap 2e9) y registro binario de bot campo a campo (`FileContinue`/centinela 254×3, `sint` Mod 32000 sin clamp B8-2, solo 50 vars B8-5, `mem()` crudo con −32768, campos muertos de ties, escape Int→Long de `LastMutDetail`, relleno de ancestros 501×3, tag `String * 50`, guardias anti-corrupción y clamps del cargador). El cargador de texto ganó `getvals` ('#generation/'#mutations/'#tag/'#hash con reset anti-manipulación) y `delgene` es real (`GeneEnd`/`genepos`/`DeleteSpecificGene`/`NmDelete` transcritos; P3 ejecuta y borra el gen epigenético — FM-03 verifica el ciclo completo guardar→cargar→autodestruir). `GiveAbsNum` ganó su guardia `AbsNum = 0` del fuente (FM-05: los bots cargados conservan AbsNum). Errata de spec corregida contra el fuente: FM-07 (la suma 1.5e9+1e9 desbordaba el `Long` del original antes del cap; caso ajustado a 2.1e9 + decisión de port para el desborde). Decisión B8-1 documentada (SaveSimulation recursivo → sin reintento en el port). `SaveSimulation`/`LoadSimulation`, `.dbo` y `.mrate` quedan para los milestones de mundo (ningún caso §7 los exige). Total acumulado: 82 casos, 2018 aserciones. |

| M6 · Catálogo de bugs (§9) | ✅ cerrado | Casos B-01..B-28 + B-30 en verde (quedan B-29/B-31..B-35 para B6 y B-36/B-37 para B7, decisión abajo). Transcripciones que el catálogo arrastró: visión de formas completa (`CompareShapes`/`SegmentSegmentIntersect`/`lookoccurrShape`, B-12/B-13/B-14, stub asertado a 0), matanza por presión de memoria (`MemoryPressureKill`, B-02), alimentación de shots (`releasenrg`/`takenrg`/`releasebod` + `defacate` — cierra B3a; B-18/B-24), `MakeStuff` real (`storevenom`/`storepoison`/`makeshell`/`makeslime`, B-26; `mem(825)` con `Int`, no `CInt`), capa de virus B3b completa (`MakeVirus`/`copygene`/`addgene` + `MakeSpace`/`NewSubSpecies`/`logmutation`, B-19/B-20/B-21) y `bodyfix` configurable (B-25). Fidelidad corregida en el port: `nbody` de `Reproduce` en aritmética Single estricta (B-30). Errata de spec corregida contra el fuente: B-30 (501/100·50 = 250.500015f, sin empate — los empates reales son 525→262 y 475→238). Contadores cerrados y asertados a 0: `shapes_vision_stub`, `shot_feed_stub`, `makevirus_stub`. Total acumulado: 111 casos, 2484 aserciones. |

| M7 · Mutaciones y reproducción sexual (B6) | ✅ cerrado | Casos B-29, B-31..B-35 y R-09..R-11 en verde. `mutations.hpp`: `NeoMutations.bas` completo — dispatcher `mutate` (con auto-especiación, clamps, `mutatecolors`, re-publicación de mem(336/339) SIN `makeoccurrlist` — B-35), los 11 operadores (agendas geométricas de Point/Point2, suelos anti-freeze que reescriben `mutarray` — B-31, Insertion con 2 mutaciones/token — B-33, Amplification desde t=2 — B-34, Minor=Major — B-32, Translocation/Amplification con sus bucles "still bugy" como sitios de error 9 registrados), `ChangeDNA`/`ChangeDNA2` (sondeo de Max con Parse bajo `ismutating`), `DNAtoInt`/`calc_dnamatrix` (Q16: 77 comandos, máximo 32767) y las tablas `sysvarIN`(164)/`sysvarOUT`(98) extraídas mecánicamente de `LoadSysVars`. `Robots.bas`: sección de crossover completa (`simplematch`/`GeneticDistance`/`DoGeneticDistance`/`crossover`) y `SexReproduce` entero; `Reproduce` ganó la herencia que faltaba (Mutables/Mutations/Skin/color/tag/SubSpecies/OldGD/GenMut/LastOwner, ADN desde el índice 1), el régimen Delta2/mrepro y el epireset; `sharechloroplasts` real (umbral 0.25); paso 4 del tick (oscilación `MutCurrMult`); `EraseUnit` = (-1,-1) fiel. Semántica VB6 afinada: `1/Single` y `Byte/100` son Double, `Long+Single` promociona a Double, IIf/And/Choose evalúan todos sus brazos. **Dos erratas de spec corregidas contra el fuente** (R-11/B6-1): (a) el hijo sexual de padres alineados NO pierde su primer token — la racha emparejada copia desde `UBound(Outdna)+1` (`Robots.bas:633`) y el bug fix recorta el (0,0); el corrimiento solo existe con padres asimétricos en dna(0); (b) la moneda de valores del crossover se consume POR TOKEN (IIf eager), no solo en pares |v|>999. Stubs cerrados y asertados a 0: `mutate_stub`, `sexrepro_stub`, `makestuff_stub`. Total acumulado: 124 casos, 2668 aserciones. |

| M8 · Mundo (B7) + formatos de sim (B8) | ✅ cerrado | Casos R-08, B-36, B-37 y R-12 en verde. **Cierra todos los stubs** (`handlewaste_stub`, `world_stub`, `obstacle_collision_stub` asertados a 0). `vegs.hpp`: `feedvegs` (sol en banda móvil con envoltura, deriva `SunOnRnd` 2 RNG/ciclo + 1 condicional, umbrales con los 3 modos, reloj día/noche, impuesto por edad también fuera de banda, la publicación de mem(218) saltada por el GoTo para el bot con cloroplastos fuera de banda), `feedveg2` (moneda de orden nrg/body; la segunda conversión ve el waste reducido) y `checkvegstatus`. `aggiungirob`/`VegsRepopulate` en `master.hpp` (B7-1: coordenadas descartadas; R-08: 12 extracciones exactas, +1 por re-tirada; B-37: `cooldown` arranca en −RepopCooldown, primera tanda al ciclo 50 vía `UpdateSim`); `altzheimer` real. Paso 5 con `TotalSimEnergyDisplayed` (lee la celda vieja) y paso 19 con la suma `Long + Single` redondeada POR iteración. Teleporters completos en `robots.hpp` (P0a + paso 18; B-36: un eje de drift no traslada; B7-2: salida Internet acoplada al sondeo; E/S de disco sustituida por `outbox`/`inbox` en memoria). `Obstacles.bas` completo (`DoObstacleCollisions`/`DoShotObstacleCollisions`/`MoveObstacles`; hallazgo: el "tope" de `DriftObstacles` está invertido y AMPLIFICA — replicado y asertado). Formatos: `.dbo` con remapeo de ties, `SaveSimulation`/`LoadSimulation` campo a campo con sus quirks (Internet borrados al cargar con tope de For cacheado; `CInt(True) = −1 < 0` ⇒ `DisableMutations` nunca sobrevive una carga; `BadWastelevel` 0→400; SimGUID ausente = capa host, era `Rnd` crudo) y `.mrate` (solo operadores 0..10). Sitio de error 9 nuevo: `err9_load_organism` (cnum > 51). Notas de transcripción: el decremento de `Chlr_Share_Delay` vive en `feedvegs` (no en `feedveg2` como anotó M7); el original lee `TmpOpts.Tides` (quirk de UI); `ReSpawn` corrige `dx − Sgn(dx)` (el respawn local cae en 7999, no 8000). R-12 cerrado: orden global intérprete → feedveg2 → formas → teleporter → repoblación → sol con secuencia inyectada exacta. Total acumulado: 143 casos, 2962 aserciones. |

| M9 · Build WASM (Q07) | ✅ cerrado | La suite entera en verde idéntico en **tres modos**: g++ 14.2 nativo, clang 19.1.7 nativo (MSYS2 ucrt64) y **WASM vía Emscripten 6.0.8 bajo node** — 143 casos / 2962 aserciones, cero divergencias numéricas (incluidos los [FP·Q07] de §10.1). **Q07 verificada**: determinismo del port consigo mismo, IEEE 754 estricto por operación. Presets de CMake reproducibles (`port/CMakePresets.json`: `native-gcc`/`native-clang`/`wasm`; el `wasm` toma el toolchain de `$EMSDK`) y `ctest` funcional en los tres. Bajo Emscripten: `-fexceptions` (el default de emcc las desactiva y el core las usa), `-sSTACK_SIZE=8MB`, `-sALLOW_MEMORY_GROWTH`, `-sEXIT_RUNTIME=1`. Semilla de M10: `port/wasm/dbcore_api.cpp` → `dbcore.js`/`dbcore.wasm` (MODULARIZE/`createDbCore`) con exports mínimos (crear/destruir sim, `Randomize`, sembrar fundador, tick, volcado de 8 floats/bot para render) verificados con smoke test bajo node (radio de body 1000 = 114.28, coherente con F-02). Toolchain documentado en `port/README.md`. |

| M10 · Capa de presentación web | ✅ cerrado | **El port está completo y usable**: `wasm/dbcore_api.cpp` ampliado con la API entera hacia JS y `port/web/index.html` como render 2D en Canvas. Todo capa host, **cero cambios en `port/core/`** (la suite quedó intacta por construcción y verificada en verde en los tres modos). API: `db_sim_start` (arranque del form transcrito de `main.frm`: divisores, `Init_Buckets`, `cooldown = -RepopCooldown` de B-37, `totvegs = -1`, y `Rnd -1 : Randomize seed/100` de `startloaded`), opciones (campo, Costs 0..70, MinVegs/repoblación, MaxEnergy, mutaciones on/off, StartChlr), especies con siembra fiel a `loadrobs` (`main.frm:1517-1573`: color/Mutables/Skin/NoChlr/StartChlr/GenMut sobre `InsertFounder`), volcados para render (bots 8f, shots 6f, ties 5f, obstáculos 5f, teleporters 7f), formatos sobre búferes (`db_sim_save/load` con post-carga de `startloaded`, `.dbo` organismo, `SalvarobText`; `.mrate` no se exporta — conveniencia de UI), altas de obstáculo/teleporter (`NewTeleporter` transcrito de `Teleport.bas:60-105`, mismo RNG) y E/S de teleporters (`outbox_take`/`inbox_push`: el host mueve los "archivos" `.dbo`). Decisiones de capa host documentadas en la cabecera del `.cpp`: búferes en vez de disco, `SimGUID = 0`, colores de especie decididos por la página (Q01). Verificación: suite 143/2962 en verde en los tres modos, smoke test node de la API (19 checks: siembra 15+5, 300 ticks con ecosistema vivo, volcados, save→load con reanudación, outbox→inbox entre dos sims) y página probada en Chrome (algas reproduciéndose + animales cazando a 60 fps, teleporter local dibujado, consola limpia). Servir: `cd port && python -m http.server 8000` → `http://localhost:8000/web/`. |

| Ext · Rendimiento | ✅ cerrada | **Extensión opcional de capa host (solo JS/HTML; cero cambios en `port/core/`, `wasm/` o CMake).** La sim corre entera en un Web Worker (`port/web/worker.js`: módulo WASM + handle + ticks + volcados) y `index.html` queda solo con UI y render. Cada frame viaja como UN `ArrayBuffer` transferible (header + secciones bots/shots/ties/obstáculos/teleporters) con ping-pong de búferes: cero basura por frame, nunca más de un frame en vuelo, backpressure natural. Velocidad nueva "máx" (rebanadas de ~12 ms a fondo, de a 1 tick por vuelta para que las sims pesadas publiquen frames igual de seguido); stats con ticks/s, fps y costo de `draw()`; los errores del worker salen al registro de la página. Verificado en Chrome: velocidad 4 = 240 ticks/s exactos a 60 fps; máx ≈ 1440 ticks/s con la demo; estrés con ~2000 bots → `draw()` ≈ 4 ms vs tick ≈ 160 ms ⇒ **WebGL no hace falta** (el cuello es la sim, no el render; documentado en `port/README.md`). Guardar→cargar y teleporter verificados vía protocolo de mensajes. |

**Decisión M6 sobre los B-* de capas no transcritas** (opción (b) del prompt,
caso a caso): B-29 y B-31..B-35 exigen los operadores de `NeoMutations.bas`
(agenda, suelos anti-freeze, Insertion/Amplification) — van con el milestone
de mutaciones (B6) junto con `SexReproduce`/crossover (R-09..R-12). B-36 y
B-37 exigen teleporters y repoblación (`Teleport.bas`/`Vegs.bas`) — van con
el milestone de mundo (B7), igual que R-08 y los formatos de nivel sim.

## Siguiente

**El port está completo**: el core entero verificado en WASM (143 casos /
2962 aserciones en verde en los tres modos, Q07 verificada, ningún stub
abierto) y la capa de presentación web funcionando (M10: API completa en
`port/wasm/dbcore_api.cpp` + render 2D en `port/web/index.html`). No hay
milestone obligatorio pendiente. Posibles extensiones, todas capa host y
opcionales, si el usuario las pide:

- **UI de sim**: inspector de bot (la API ya da `db_sim_bot_text`),
  zoom/cámara, editor de opciones completo (la UI actual expone las
  esenciales; la API llega hasta Costs 0..70), gráficas de población.
- **Modo Internet/torneo**: la E/S de teleporters entre sims ya funciona
  por búferes (`outbox`/`inbox`); faltaría solo el transporte que mueva
  los registros entre navegadores (la capa ⚙ de 50-MUNDO.md §5 quedó
  deliberadamente fuera del contrato).
- ~~**Rendimiento**~~: **cerrada 2026-08-26** (Web Worker + frame único
  transferible; WebGL medido y descartado por innecesario — ver la fila
  "Ext · Rendimiento" y el registro).
- ~~**Bestiary del foro**~~: **cerrada 2026-08-26** (545 bots del foro
  oficial bajados, validados con el core y servidos como presets en la
  página — ver el registro; el archivador reproducible vive en
  `port/tools/bestiary/`).

## Pendiente

- **Plan de extensiones aprobado por el usuario (2026-08-26)**: cubrir el resto
  de la superficie funcional del original por etapas — ver `PLAN-EXTENSIONES.md`
  (E1 escenario/física configurables ✅, E2 animaciones e inspección ✅, E3
  formas/mazes/teleporters UI, E4 costes dinámicos ⚙ **capa core**, E5 modos de
  juego, E6 registro/análisis, E7 Internet, E8 extras). Orden recomendado:
  E3 → E4 → resto. Hallazgo que lo ordena: el core ya implementa casi
  toda la configuración (toroidal incluido); el grueso es exponerla en wasm/UI.

| Etapa | Estado | Nota |
|---|---|---|
| E1 · Escenario y física configurables | ✅ cerrada | **Capa host pura** (cero cambios en `port/core/`; suite intacta y verificada: 143/2962 en verde bajo wasm). API: `db_sim_set_opt`/`db_sim_get_opt` genéricos por id estable (tabla-contrato en `wasm/dbcore_api.cpp`; solo opciones CON consumidor real en el core — TidesOf/KillDistVegs/BlockedVegs/Diffuse/makeAllShapes* fuera por muertas). Página: panel "Opciones de sim" (`web/index.html`, generado de una tabla declarativa espejo) con forma del campo (toroidal/cilindros, en vivo), tamaños del slider original (fórmula exacta de `OptionsForm.frm:4075-4099`, F1 = 9237×6928), física del medio con los presets exactos de los combos del original (`OptionsForm.frm:4406-4453`), luz/día-noche/pondmode, decay/corpses, energía (intercambio, mareas, waste tóxico) y restricciones; los campos con id aplican EN VIVO (`{t:'setopt'}` del worker) y todos se reenvían al reiniciar. Verificado: smoke node de 52 checks (ida-y-vuelta de los 46 ids + toroidal compuesto + sim de 300 ticks con E1 activo) y en Chrome (panel, reset a 16000×12000 toroidal, sim viva a ciclo 52k, consola limpia). |
| E2 · Animaciones e inspección de bots | ✅ cerrada | **Capa host pura** (cero cambios en `port/core/`; suite intacta y verificada: 143/2962 en verde en los tres modos). Los 4 toggles del menú View del original funcionando en la página (todos arrancan activados, como en `MDIForm1.frm`): **destellos de impacto** (`DrawShots` main.frm:953-971 + paleta `FlashColor` :397-404 — dump de shots ampliado 6→9 floats con `flash`+`opos`; el criterio de inclusión es el del fuente: flash sale siempre, stored no se dibuja), **rejilla de visión del bot seleccionado** (main.frm:1017-1060 — export nuevo `db_sim_dump_focus`: 8 floats de inspector + 9 ojos × [dirOffset, halfeyewidth normalizado con los While del fuente, EyeSightDistance del core (eyestrength incluido), valor visto]; la página compone hi/low/longitud con la fórmula literal, arcos cian encogidos a la distancia vista y ojo con foco `FocusEyeIndex` en rojo; la pluma invertida vbNotMergePen se aproxima con trazo sólido vs. tenue — decisión de host documentada), **vectores de movimiento** (`DrawRobAim` main.frm:758-829 — dump de bots ampliado 8→20 floats con recursos y `last*`; flechas con clamp ±1000 y puntas ±10/15 transcritas) y **gauges de recursos** (`DrawRobPer` main.frm:624-712 — 9 anillos concéntricos 0.95→0.55 con umbrales/topes del fuente, Vtimer/100 y cloroplastos 0.98). Selección por clic transcrita de `whichrob` (main.frm:1590-1614; 2 adaptaciones de host documentadas: sin el piso de 10000 twips² y radio efectivo mínimo de 6px) + inspector con `db_sim_bot_text` (mensaje `bot-text` del worker) y nrg/body/edad en vivo del bloque de foco del frame. Omitido por valor menor (punto 5 del plan): skins `DrawRobSkin` y monitor RGB `DrawMonitor`. Verificado: smoke node de 22 checks (strides nuevos, ojos vírgenes esd=1440 exacto, destellos con flash/opos en caza real, encogimiento, bot_text) y en Chrome (destellos −1 rojo/−2 blanco en el punto de impacto, abanico de 9 arcos, arcos encogidos con los 9 ojos viendo en campo denso, inspector vivo, toggles ciclados, consola limpia). |

---

## Registro

- **2026-08-15** — Fase 0 completada. Fuentes sin modificar.
- **2026-08-15** — A1 cerrado (`10-CICLO.md`). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-15** — A2 cerrado (`20-VM.md` + `opcodes.yaml`). Fuentes sin modificar.
- **2026-08-16** — A3 cerrado (`21-MEMORIA.md` + `sysvars.yaml`). **Bloque A completo.**
  Fuentes sin modificar (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-16 (post-Bloque B)** — El usuario confirma que ni el EXE ni el IDE de VB6
  corren en su máquina: se descarta la validación empírica y se admiten fuentes
  secundarias para las preguntas de runtime. Q02 resuelta (LCG de VB6, fuente:
  dotnet/runtime `VBMath.vb`); Q09 reclasificada; Q13 resuelta por análisis.
- **2026-08-16 (corrección de premisa)** — Descubierto que los flags del `.vbp` estaban
  leídos al revés: el EXE compila **con** chequeos. Barrido de corrección en 9 archivos
  de `spec/`, nueva `10-CICLO.md §14` (truncamiento de tick), Q07/Q08/Q17 cerradas bajo
  la premisa corregida. **No quedan preguntas abiertas.** Fuentes sin modificar.
- **2026-08-22** — Bloque C cerrado (`70-CASOS-DORADOS.md`). **Especificación
  completa.** Suite de los autores minada (`UnitTests/TestCommon.cls`: solo cubre
  `Common.bas`; hallazgo S-02: los tests de `fRnd` afirmaban un rango que el fuente
  viola con p ≈ 0.5/rango). Dos correcciones menores a documentos B
  (`50-MUNDO.md §2.1`, `constants.yaml`). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-24** — Port C++ arrancado (`port/`) por orden del usuario. M1 cerrado:
  sustrato numérico con casos dorados §1/§2/R-01..R-03 en verde (g++ 14 nativo,
  build estático; clang/emsdk pendientes). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-24** — M2 cerrado: VM completa (`ExecuteDNA`, flujo, stores) y
  cargador de texto, casos V-01..V-14 en verde (44 casos / 1539 aserciones
  acumuladas). Fuentes sin modificar.
- **2026-08-24** — M3 cerrado: tabla completa de sysvars, esqueleto del tick
  y casos M-01..M-12 en verde (56 casos / 1714 aserciones acumuladas).
  Hallazgo menor: la tabla de M-11 en `70-CASOS-DORADOS.md` decía `mem(836)`
  para vshoot; el sysvar es 338 (fuente manda; el test asserta sobre 338).
  Dos expectativas de test corregidas contra el fuente durante la
  transcripción: el hijo hereda el timer POST-Ageing del padre (P5 corre
  antes que P6) y el ADN de M-10 tiene 20 tokens (DnaLen = 21). Fuentes sin
  modificar (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-24** — M4 cerrado: física y visión completas (F-01..F-15 +
  R-05..R-07; 75 casos / 1931 aserciones acumuladas), stubs de M3
  reemplazados con sus contadores `SimDiag` asertados a 0. Tres erratas de
  spec corregidas contra el fuente (F-07, F-10, 32-VISION §2.4 — la
  supuesta división entera `PI \ 36` no existe en `Quads.bas`; los bucles
  reales son `> π − π/36` / `< −π/36` con división real, mismo efecto
  panorámico). Hallazgos de transcripción: el clamp ByRef de `VectorScalar`
  muerde el intermedio `V2·(e+1)·32000` de `Repel3` con bot fijo (V1f
  −0.99997, no −4.95 — semántica del fuente, asertada en F-06); `regang`
  dispara entrando con `last = −2` (el incremento corre antes del chequeo);
  `CompactShots` de M3 no re-apuntaba `virusshot` (corregido con la
  transcripción literal, R-06 lo cubre). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-25** — M6 cerrado: el catálogo de `[PROBABLE BUG]` como
  aserciones (B-01..B-28 + B-30; 111 casos / 2484 aserciones acumuladas).
  Bloques: visión de formas (B-12/13/14), bugs de ciclo/ties/shots/física
  sobre capas ya portadas (B-01..B-11, B-15..B-18, B-22..B-28) y capa de
  virus B3b completa (B-19/20/21). B3a quedó cerrada (alimentación de
  shots) y `MakeStuff` es real. Hallazgo de fidelidad: `nbody` de
  `Reproduce` debe calcularse en Single estricto (el double del port
  redondeaba 250.4999 donde el original produce 250.500015f); errata de
  B-30 corregida en la spec (los empates bancarios reales son 525→262 y
  475→238). B-29/B-31..B-35 diferidos a B6 y B-36/B-37 a B7 (registrado
  en la tabla). Fuentes sin modificar (`git diff 02b20d7 -- Darwinbots2/`
  vacío).
- **2026-08-24** — M5 cerrado: formatos ida-y-vuelta (FM-01..FM-07; 82
  casos / 2018 aserciones acumuladas). `formats.hpp` con la E/S sobre
  búferes en memoria, el registro binario de bot campo a campo y el bot de
  texto completo (gen epigenético incluido, verificado guardar→cargar→
  autodestruirse en un ciclo). Hallazgos de transcripción: `Hash` recibe el
  acumulador ByRef y lo TRIMEA en el llamador (salvarob imprime el `hold` ya
  mutado — sin replicar esa mutación el hash de la ida-y-vuelta no cuadra);
  el placeholder del contador de ancestros es el `t` sobrante del For de
  spermDNA (= spermDNAlen + 1); la guardia `AbsNum = 0` vive dentro de
  `GiveAbsNum` en el fuente (el port la tenía fuera). Errata de spec
  corregida: FM-07 (`OldMutations = 1e9` hacía desbordar el `totmut As
  Long` del original antes del cap; el caso del cap real usa 2.1e9 y la
  suma desbordada queda como decisión de port asertada). La recarga de
  FM-03 usa la vía de siembra (`InsertFounder`, body = 1000): la vía
  `RobScriptLoadSim` pelada deja body = 0 y el bot muere al final del
  primer tick — semántica del fuente, no un bug del port. Fuentes sin
  modificar (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-25** — M7 cerrado: mutaciones y reproducción sexual (B-29,
  B-31..B-35, R-09..R-11; 124 casos / 2668 aserciones acumuladas).
  `NeoMutations.bas` completo en `mutations.hpp` (11 operadores + agendas +
  ChangeDNA/ChangeDNA2 + DNAtoInt/matriz + tablas sysvarIN/OUT), crossover y
  `SexReproduce` completos en `robots.hpp`, `Reproduce` con toda la herencia
  y los regímenes Delta2/mrepro/epireset, `sharechloroplasts` real, paso 4
  del tick. Hallazgo mayor de transcripción: **el [PROBABLE BUG] B6-1 estaba
  mal derivado en la spec** — la racha emparejada del crossover copia desde
  `UBound(Outdna)+1` (`Robots.bas:633` relee upperbound) y los fantasmas de
  ambos padres siempre se emparejan, así que el hijo de padres alineados NO
  pierde su primer token (el corrimiento solo existe con padres asimétricos
  en dna(0)); además el IIf eager de VB6 consume la moneda de valores en
  cada token emparejado. R-11 reescrito y 36-REPRO corregido (§0.1, §3.3,
  §5.1). Sitios de error 9 nuevos con decisión de port:
  `err9_mutation_insert` (bucles de inserción de Amplification/Translocation
  con MakeSpace fallido) y `err9_simplematch` (reposicionamiento fuera de
  rango). Stubs `mutate_stub`/`sexrepro_stub`/`makestuff_stub` cerrados y
  asertados a 0. Fuentes sin modificar (`git diff 02b20d7 -- Darwinbots2/`
  vacío).
- **2026-08-26** — M8 cerrado: mundo (B7) + formatos de nivel sim (B8) en
  cuatro bloques — economía vegetal (R-08, B-37), teleporters y `.dbo`
  (B-36, B7-2), obstacles y `SaveSimulation`/`LoadSimulation`/`.mrate` —
  más R-12 como meta-caso de cierre (143 casos / 2962 aserciones
  acumuladas). **No queda ningún stub abierto**; el ciclo `UpdateSim` está
  completo de punta a punta. Hallazgos de transcripción: el decremento de
  `Chlr_Share_Delay` vive en `feedvegs` (Vegs.bas:219-221), no en
  `feedveg2` como anotó M7; `feedvegs` lee `TmpOpts.Tides` (la copia de la
  UI); el "tope" de `DriftObstacles` está invertido y AMPLIFICA la
  velocidad (replicado como comportamiento correcto); `ReSpawn` descuenta
  `Sgn(dx)` (el teleport local a 8000 deja el bot en 7999);
  `CInt(True) = −1 < 0` hace que `DisableMutations` nunca sobreviva una
  carga de sim; `LoadTeleporter` no repone `.exist` (solo la UI lo
  consulta). Sitio de error 9 nuevo con decisión de port:
  `err9_load_organism` (cnum > 51 desbordaba `clist(50)`). Decisiones de
  port E/S: teleporters sobre búferes `outbox`/`inbox` en memoria (la capa
  host mueve archivos); `SimGUID` ausente queda en 0 (era `Rnd` crudo,
  Q01). Fuentes sin modificar (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-26** — M9 cerrado: build WASM (decisión Q07). Instalados clang
  19.1.7 (MSYS2 ucrt64, `pacman -S mingw-w64-ucrt-x86_64-clang`) y emsdk
  `latest` (Emscripten 6.0.8, clonado en `~/emsdk`). La suite entera da
  **verde idéntico en los tres modos** — g++ 14.2 nativo, clang nativo y
  WASM bajo node (143 casos / 2962 aserciones) — sin una sola divergencia
  numérica, tampoco en los casos [FP·Q07]: Q07 verificada (determinismo
  del port consigo mismo, IEEE 754 estricto por operación). Presets
  reproducibles en `port/CMakePresets.json` (`native-gcc`/`native-clang`/
  `wasm`) con `ctest` funcional; bajo Emscripten se activan excepciones
  (`-fexceptions`, el default de emcc las desactiva y el core las usa en
  sitios de error) y la suite linkea con pila de 8 MB, memoria elástica y
  `EXIT_RUNTIME` para código de salida real. Semilla de M10:
  `port/wasm/dbcore_api.cpp` compila a `dbcore.js`/`dbcore.wasm`
  (MODULARIZE, export `createDbCore`) con la API mínima — crear/destruir
  sim, `Randomize`, sembrar fundador desde texto de ADN, tick
  (`UpdateSim` completo) y volcado de estado para render (8 floats/bot) —
  verificada con un smoke test bajo node (2 fundadores, 10 ticks, radio
  de body 1000 = 114.28 ≡ F-02). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-26** — M10 cerrado: capa de presentación web. **El port está
  completo y usable.** `port/wasm/dbcore_api.cpp` ampliado con la API
  entera hacia JS (arranque del form, opciones esenciales, especies con la
  siembra de `loadrobs` completa, volcados de bots/shots/ties/obstáculos/
  teleporters, save/load de sim y `.dbo` sobre búferes, `SalvarobText`,
  altas de obstáculo/teleporter y la E/S `outbox`/`inbox` de teleporters)
  y `port/web/index.html` como render 2D en Canvas (loop de
  `requestAnimationFrame`, iniciar/pausar/paso/velocidad/seed, siembra
  con presets Animal/Alga Minimalis o ADN propio, guardar/cargar `.dbsim`,
  teleporter local). Cero cambios en `port/core/`: la suite siguió en
  verde en los tres modos sin re-tocar nada (143/2962). Decisiones de capa
  host documentadas en la cabecera del `.cpp`: teleporters por búferes en
  memoria (el host mueve los "archivos" `.dbo`), `SimGUID = 0` (ningún
  sistema del core lo lee) y colores de especie decididos por la página
  (Q01); `.mrate` no se exporta (conveniencia de la UI original).
  Verificación: smoke test node de la API (19 checks, incl. ecosistema
  vivo a 300 ticks, save→load con reanudación y el ciclo
  outbox→inbox entre dos sims) y página verificada en Chrome servida con
  `python -m http.server` (algas reproduciéndose, animales cazando,
  teleporter dibujado, consola sin errores). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).

- **2026-08-26** — Extensión Rendimiento cerrada (capa host pura: solo
  `port/web/`; cero cambios en `port/core/`, `port/wasm/` o CMake — la
  suite 143/2962 sigue en verde por construcción). La sim corre entera en
  un Web Worker nuevo (`port/web/worker.js`): el worker carga
  `dbcore.js`, posee el handle, ejecuta los ticks y publica cada frame
  como UN `ArrayBuffer` transferible (header de contadores + secciones
  bots 8f / shots 6f / ties 5f / obstáculos 5f / teleporters 7f, el mismo
  layout que `db_sim_dump_*`); `index.html` quedó solo con UI y render
  Canvas 2D y devuelve el búfer con un `ack` (ping-pong: cero basura por
  frame, nunca más de un frame en vuelo, el rAF de la página marca el
  ritmo con velocidad N ticks/frame). Velocidad nueva "máx": el worker
  corre a fondo en rebanadas de ~12 ms (de a 1 tick por vuelta, para que
  las sims pesadas publiquen frames igual de seguido) sin bloquear jamás
  la página. Bug propio encontrado y corregido durante la verificación:
  el pool de frames asignaba `ceil(bytes·1.5)+1024` sin alinear a 4 →
  `RangeError` en `new Float32Array(buf)` con conteos de floats impares
  (aparecía al entrar el primer teleporter, +7 floats); ahora alineado y
  los errores de runtime del worker salen al registro de la página
  (`worker.onerror`). Verificado en Chrome: velocidad 4 = 240 ticks/s
  exactos a 60 fps (draw 0.1 ms); máx ≈ 1440 ticks/s con la demo;
  guardar→cargar por mensajes (1.3 MB, reanuda con los 138 bots) y
  teleporter local dibujado; consola sin errores. Medición para la
  decisión WebGL: estrés con ~2000 bots → `draw()` ≈ 4 ms/frame vs tick
  del core ≈ 160 ms ⇒ el cuello es la sim, no el render: **WebGL
  descartado por innecesario** (documentado en `port/README.md`
  §"Página web"; queda como opción futura si el render dominara alguna
  vez). Fuentes sin modificar.

- **2026-08-26** — Extensión Bestiary del foro (a pedido del usuario;
  capa host pura: `port/web/` + herramienta nueva en
  `port/tools/bestiary/`; cero cambios en `port/core/`, `port/wasm/` o
  CMake). Archivador en tres pasos: `crawl_bestiary.py` rastrea los 12
  sub-boards del Bestiary de forum.darwinbots.com (board 13: F1/F2/F3,
  Short, Multi-Bots, Veggies, Interesting behaviour, EcoSim, Mutations,
  The Starting Gate, Single store, Untagged; ~700 temas, solo bloques
  [code] de la primera página de cada tema — los adjuntos del foro no
  son visibles para invitados) y extrae 607 candidatos;
  `validate_bots.js` los valida con el core real (dbcore.wasm bajo
  node: alta de especie + siembra del fundador + al menos un gen
  cerrado en `db_sim_bot_text` + 50 ticks) — 607/607 válidos tras
  normalizar `&nbsp;`/zero-width del HTML de SMF, que el tokenizador
  convertía en genes vacíos; `publish_bots.py` publica uno por tema (el
  bloque válido más largo) → **545 bots en `port/web/bots/` +
  `bots.json`**. La página los ofrece en el selector de especies
  agrupados por sub-board (los Veggies siembran como vegetales); sin
  `bots.json` la página sigue igual que antes. Verificado en Chrome:
  545 en el selector, Callidus (F1) sembrado caza a las algas, un veggie
  del Bestiary siembra como vegetal ×15. Nota de la verificación: en un
  tab oculto el rAF no dispara y la sim se pausa sola (por diseño del
  ping-pong; no es bug). Fuentes sin modificar.

- **2026-08-26 (2)** — Bestiary ampliado con los adjuntos del foro (el
  usuario inició sesión en Chrome y la cosecha corrió como fetch dentro de
  una página del foro logueada, con pausas de cortesía; el volcado salió
  por el portapapeles — Chrome bloquea downloads desde HTTP). 146 adjuntos
  .txt nuevos fusionados con merge_atts.py; revalidación entera con el
  core: 753/753 candidatos válidos → **588 bots publicados** (antes 545;
  Veggies 9→19, y donde un tema tiene adjunto se publica esa versión
  completa en vez del bloque de código citado). Capa host pura; la página
  no cambió.
- **2026-08-26** — Plan ampliado a petición del usuario: `PLAN-EXTENSIONES.md`
  (etapas E1..E8 con el resto de la superficie del original: opciones de
  escenario con forma toroidal y tamaños, física configurable, animaciones
  de main.frm, mazes, costes dinámicos ⚙, modos de juego, gráficas,
  Internet). Inventario contra `SimOptions.bas`, `OptionsForm.frm` y los
  menús de `MDIForm1.frm`; verificado qué está ya en el core (toroidal:
  `physics.hpp:503,518`) y qué es hueco real (pasos ⚙ 3/6-9/13/22-25).
  Fuentes sin modificar.
- **2026-08-26 (E1)** — Etapa E1 cerrada: opciones de escenario y física del
  original expuestas de punta a punta (API genérica por id + panel en la
  página, toroidal y tamaños del slider incluidos). Capa host pura; smoke
  node 52 checks + verificación en Chrome. Fuentes sin modificar.
- **2026-08-27 (E2)** — Etapa E2 cerrada: animaciones e inspección de bots —
  los 4 toggles del menú View del original en la página (destellos de impacto
  de `DrawShots`, rejilla de visión de main.frm:1017-1060 con el export nuevo
  `db_sim_dump_focus`, vectores de movimiento de `DrawRobAim`, gauges de
  `DrawRobPer`), selección por clic (`whichrob` transcrito) e inspector con
  `db_sim_bot_text` + nrg/body/edad en vivo. Volcados ampliados: bots 8→20
  floats, shots 6→9 (flash+opos). Capa host pura (cero cambios en
  `port/core/`); suite 143/2962 en verde en los tres modos, smoke node de
  22 checks y verificación en Chrome (destellos en el punto de impacto,
  arcos encogidos con caza real, inspector vivo, consola limpia). Omitidos
  por valor menor: skins y monitor RGB (punto 5 del plan). Nota de la
  verificación: los servidores `http.server` de sesiones anteriores seguían
  vivos en el puerto 8000 sirviendo la página vieja — la demo se verificó
  en el 8010. Fuentes sin modificar.
