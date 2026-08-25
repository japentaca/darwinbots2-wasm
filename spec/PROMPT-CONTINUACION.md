# Prompt de continuación del ciclo de desarrollo (generado 2026-08-24, post-M5)

> Copiá el bloque de abajo como primer mensaje de una sesión nueva de Claude Code, en
> el directorio `C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`.
>
> Regenerable en cualquier momento con `/prompt-continuacion` — este archivo refleja
> el estado al momento de generarse; regeneralo al cerrar cada milestone.

---

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de **DarwinBots 2.48.32 (Visual Basic 6)**.

El proyecto: reimplementar el simulador desde cero — **core en C++ compilado a WASM vía
Emscripten, render 2D en web** (decisión y salvaguardas de build en `spec/PLAN.md`).
La especificación en `spec/` está **completa** (Fase 0 + Bloques A, B y C cerrados) y es
el contrato del port; `spec/70-CASOS-DORADOS.md` es la suite de verdad. Cuando haya que
desambiguar algo, **el fuente VB6 es la spec** y los documentos de `spec/` son su índice.

El port vive en `port/` y ya está arrancado:

- **M1 · Sustrato numérico** cerrado (`9182e8e`): redondeo bancario, LCG de VB6,
  gasdev, stacks, mod32000, handlers numéricos/lógicos/bitwise de la VM. Casos §1
  (S-01..S-07), §2 (N-01..N-19) y R-01..R-03.
- **M2 · VM y cargador** cerrado (`54d586e`): `ExecuteDNA` completo (bug del `else`
  canónico replicado, stores inmediatos, `CondStateIsTrue` sin consumo, 14 stores con
  sus asimetrías), cargador de texto (Parse, sombreado de privadas, corrección del
  cero inicial, sitios de rechazo). Casos §3 (V-01..V-14).
- **M3 · Memoria y ciclo** cerrado (`39fd715`): tabla completa de sysvars (255
  entradas de `LoadSysVars`), esqueleto del tick (`master.hpp`/`robots.hpp`) y los
  subsistemas de memoria: sentidos, ties, shots, Reproduce con memoria genética,
  corpses. Casos §4 (M-01..M-12).
- **M4 · Física y visión** cerrado (`487c406`): `Physics.bas` completo (`Repel3`,
  `TieHooke`/`TieTorque` con sus `[PROBABLE BUG]`, `bordercolls` + `ReSpawn`,
  arrastre/gravedad), buckets de `Quads.bas` (`buckets.hpp`), visión completa
  (`vision.hpp`: 9 ojos apuntables, oclusión rota B2-1, ojo panorámico B2-2) y
  swept-sphere de shots con `CompactShots` fiel. Casos §5 (F-01..F-15) y R-05..R-07.
- **M5 · Formatos ida-y-vuelta** cerrado (`2bc58f8`): `formats.hpp` con E/S sobre
  búferes en memoria (el core WASM no toca disco; la fidelidad es la del formato de
  bytes/texto). Registro binario de bot campo a campo (`FileContinue`/centinela
  254×3, `sint` = Mod 32000 sin clamp, solo 50 vars, `mem()` crudo, escape Int→Long
  de `LastMutDetail`, tag `String * 50`), bot de texto completo (`SalvarobText` +
  gen epigenético autodestructivo, `DetokenizeDNA` con `VOID`, `Hash` ByRef que
  muta el acumulador — fiel al original), `getvals` en el cargador ('#hash resetea
  generation) y `delgene` real (`GeneEnd`/`genepos`/`DeleteSpecificGene`). Casos §7
  (FM-01..FM-07). Siguen como stubs registrados: `CompareShapes`/`lookoccurrShape`
  (visión DE formas), `DoObstacleCollisions` (solo con `numObstacles > 0`) y las
  capas B3b/B5/B6/B7; los formatos de nivel sim (`SaveSimulation`/`.dbo`/`.mrate`)
  quedan para los milestones de mundo.
- **Estado verificado**: 82 casos / 2018 aserciones en verde
  (`port/build/dbtests.exe`).
- **Toolchain**: g++ 14 (MSYS2 ucrt64) + CMake + Ninja, binario de tests estático.
  Pendiente: instalar clang + emsdk y verificar que la suite da verde compilada a
  WASM (decisión Q07: determinismo del port consigo mismo).
- Línea base de los fuentes VB6: `02b20d7`.

**Antes de nada, leé en este orden**

1. `spec/PROGRESO.md` — estado autoritativo, tabla de milestones del port y registro.
   Incluye la corrección de premisa del 2026-08-16 (**el EXE compila CON chequeos**;
   los flags `=0` del `.vbp` son casillas sin marcar): invalida cualquier intuición de
   "wrap silencioso".
2. `port/README.md` — build, reglas del port, pendientes.
3. `spec/70-CASOS-DORADOS.md §9` — la tabla completa del catálogo de `[PROBABLE
   BUG]` (el milestone que sigue) y las definiciones B-01..B-37; **§0** para las
   convenciones del harness.
4. `spec/32-VISION.md §3` (visión de formas: `CompareShapes`/`lookoccurrShape`) y
   los documentos que cada caso B-* cite en su definición (`10-CICLO.md §11.1` para
   Shock, `33-SHOTS.md`, `34-TIES.md`, etc.).

**Reglas duras**

1. Los fuentes VB6 (`Darwinbots2/`) son **read-only**. Verificable con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. El ciclo es siempre: caso dorado transcrito como test **en rojo** → implementación
   **transcrita del fuente VB6 citado** línea a línea (no de memoria, no del wiki) →
   verde → commit citando la sección de la spec.
3. Los `[PROBABLE BUG]` se replican tal cual (regla 4 del brief): cada caso B-* se
   testea **como comportamiento correcto**. Los sitios de error 6/9/11 del original
   llevan decisión de port documentada por sitio + registro en `VmDiag`/`SimDiag`
   (`10-CICLO.md §14`).
4. Salvaguardas numéricas (`PLAN.md`): toda conversión float→int marcada por la
   spec pasa por `vb_round64`/`vb_clng`/`vb_cint` (bancario centralizado); `Single` =
   `float` estricto con casts explícitos en las fórmulas sensibles; nada de
   `-ffast-math`; sin FMA implícita (`-ffp-contract=off`); `-fwrapv` solo como red.
5. Al cerrar el milestone: actualizar `spec/PROGRESO.md` (tabla del port + sección
   "Siguiente" + registro con fecha) y commitear. Regenerar
   `spec/PROMPT-CONTINUACION.md` con `/prompt-continuacion`.

**Compilar y correr los tests**

```
cmake -S port -B port/build -G Ninja
cmake --build port/build
port/build/dbtests.exe
```

(El exe linkea estático; no necesita las DLL de MSYS2 en el PATH.)

**Tu tarea: M6 · El catálogo de bugs como aserciones (§9, B-*)**

Según `spec/PROGRESO.md` ("Siguiente"):

1. Leé la tabla de mapeo de `70-CASOS-DORADOS.md §9` completa antes de escribir
   nada: muchos bugs ya quedaron asertados en milestones anteriores (V-01, N-16..19,
   M-04..M-09, F-11..F-14, R-05/R-06, FM-01/FM-02/FM-05); el milestone son los casos
   **B-01..B-37** definidos en §9.
2. Primer bloque natural: la **visión de formas** — `CompareShapes`/
   `lookoccurrShape` (`32-VISION.md §3`), hoy stub registrado
   (`SimDiag.shapes_vision_stub`), que habilita **B-12** (EYEF dentro de forma),
   **B-13** (`lastopppos` solo frontal) y **B-14** (fórmula de anchura distinta para
   formas). Al reemplazar el stub, asertá su contador a 0 como se hizo en M4.
3. Después, los B-* alcanzables con las capas ya portadas: Shock (**B-01**,
   `10-CICLO.md §11.1`), `KillRobot(0)` (**B-02**), ties (**B-03**, **B-22**,
   **B-23**, **B-27**), muertes/reproducción (**B-04**), sentidos (**B-05**,
   **B-06**, **B-07**, **B-08**), `ReSpawn` toroidal (**B-09**), corpses que
   colisionan (**B-10**), bucket-clamp (**B-11**), shots (**B-15**..**B-18**,
   **B-24**).
4. Los B-* que exigen capas aún no transcritas (B3b virus: B-19..B-21; B5 energía:
   B-25, B-26, B-28; B6 mutaciones/crossover: B-29..B-35; B7 mundo: B-36, B-37)
   pueden (a) arrastrar la transcripción de esa capa si es acotada, o (b) quedar
   explícitamente para el milestone de su capa — decidilo caso a caso al leer §9 y
   dejalo registrado en `PROGRESO.md`. Los R-08..R-12 siguen siendo de los
   milestones de mundo/reproducción.
5. Verde total → commit(s) → actualizar `PROGRESO.md`.

---

*Regenerá este archivo con `/prompt-continuacion` al cerrar cada milestone.*
