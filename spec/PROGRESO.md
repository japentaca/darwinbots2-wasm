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

**Decisión M6 sobre los B-* de capas no transcritas** (opción (b) del prompt,
caso a caso): B-29 y B-31..B-35 exigen los operadores de `NeoMutations.bas`
(agenda, suelos anti-freeze, Insertion/Amplification) — van con el milestone
de mutaciones (B6) junto con `SexReproduce`/crossover (R-09..R-12). B-36 y
B-37 exigen teleporters y repoblación (`Teleport.bas`/`Vegs.bas`) — van con
el milestone de mundo (B7), igual que R-08 y los formatos de nivel sim.

## Siguiente

**El core está completo y verificado en WASM**: los 143 casos dorados de
`70-CASOS-DORADOS.md` aplicables al motor están en verde en los tres modos
de build (g++/clang nativos y Emscripten bajo node — Q07 verificada) y no
queda ningún stub abierto (los contadores de `SimDiag`/`VmDiag` que
sobreviven son sitios de error 6/9/11 con decisión de port documentada).
Próximo paso:

1. **M10 · Capa de presentación web** — sobre la semilla de M9
   (`port/wasm/dbcore_api.cpp` → `dbcore.js`/`dbcore.wasm`): ampliar la API
   del core hacia JS (opciones de sim, E/S de búferes para guardar/cargar
   — `SaveSimulation`/`LoadSimulation`/`.dbo` ya operan sobre memoria — y
   los búferes `outbox`/`inbox` de teleporters) y construir el render 2D
   (Canvas/WebGL). Fuera del contrato de fidelidad: la capa host decide el
   movimiento de archivos de teleporters, el `SimGUID` ausente y los
   colores con `Rnd` crudo.

## Pendiente

- (nada)

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
