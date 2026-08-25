# Prompt de continuación del ciclo de desarrollo (generado 2026-08-24, post-M4)

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
  swept-sphere de shots con `CompactShots` fiel. Casos §5 (F-01..F-15) y
  R-05..R-07. Los stubs de M3 quedaron reemplazados (contadores `SimDiag` a 0,
  asertado). Siguen como stubs registrados: `CompareShapes`/`lookoccurrShape`
  (visión DE formas), `DoObstacleCollisions` (solo con `numObstacles > 0`) y las
  capas B3b/B5/B6/B7.
- **Estado verificado**: 75 casos / 1931 aserciones en verde
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
3. `spec/60-FORMATOS.md` — formatos texto/.dbo/sim binaria (el milestone que sigue).
4. `spec/20-VM.md §` (tokenizador/ida-y-vuelta) y `spec/36-REPRO.md` (gen
   epigenético) donde FM-03/FM-06 los citen.
5. `spec/70-CASOS-DORADOS.md §0` (convenciones del harness) y **§7** (los casos del
   milestone, FM-01..FM-07).

**Reglas duras**

1. Los fuentes VB6 (`Darwinbots2/`) son **read-only**. Verificable con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. El ciclo es siempre: caso dorado transcrito como test **en rojo** → implementación
   **transcrita del fuente VB6 citado** línea a línea (no de memoria, no del wiki) →
   verde → commit citando la sección de la spec.
3. Los `[PROBABLE BUG]` se replican tal cual (regla 4 del brief). Los sitios de
   error 6/9/11 del original llevan decisión de port documentada por sitio + registro
   en `VmDiag`/`SimDiag` (`10-CICLO.md §14`).
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

**Tu tarea: M5 · Formatos ida-y-vuelta**

Según `spec/PROGRESO.md` ("Siguiente"):

1. Los casos **§7 (FM-01..FM-07)** de `70-CASOS-DORADOS.md`: `FileContinue` con el
   centinela 254×3 (FM-01), `sint` = Mod 32000 sin clamp (FM-02, [PROBABLE BUG]
   B8-2), el gen epigenético autodestructivo (FM-03), `Hash` con valor concreto
   (FM-04), el registro binario de bot con solo 50 vars persistidas y `mem` crudo
   (FM-05), la ida-y-vuelta de texto inestable para ADN degenerado (FM-06, heredado
   de A2) y el cap del contador de `SaveRobHeader` (FM-07). La E/S del port opera
   sobre búferes en memoria (el core WASM no toca disco): la fidelidad exigida es
   la del **formato de bytes/texto**, no la de archivos.
2. Ojo con `60-FORMATOS.md`: versionado FE×3 + `FileContinue`, `SaveSimulation`
   recursivo en error (sitio de error con decisión de port) y el gen epigenético
   que se autodestruye al cargar.
3. Después de M5 viene **el catálogo de bugs como aserciones (§9, B-01..B-27+)** —
   ahí llegan `CompareShapes`/`lookoccurrShape` (B2-3/B2-4), `Shock` (B-01),
   `ReSpawn` toroidal (B-09), corpses que colisionan (B-10), etc. Los R-08..R-12
   (repoblación, crossover, orden global de RNG) son de los milestones de
   mundo/reproducción — no los arranques.
4. Verde total → commit(s) → actualizar `PROGRESO.md`.

---

*Regenerá este archivo con `/prompt-continuacion` al cerrar cada milestone.*
