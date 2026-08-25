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

Estado verificado: 82 casos / 2018 aserciones en verde.

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
