# Prompt de continuación del ciclo de desarrollo (generado 2026-08-24, post-M3)

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
  entradas extraídas de `LoadSysVars`, verificadas contra `sysvars.yaml`), esqueleto
  del tick (`master.hpp`: pasos 10/12/14/15/16/17 de `10-CICLO.md §2`; `robots.hpp`:
  las 7 pasadas de `UpdateBots`) y los subsistemas de memoria: sentidos, ties, shots,
  Reproduce con memoria genética, corpses. Casos §4 (M-01..M-12). **Ojo**: las
  colisiones bot-bot y de shots usan detección simplificada y varias pasadas son
  stubs **registrados en `SimDiag`** (`sim.hpp`) — M4 los reemplaza.
- **Estado verificado**: 56 casos / 1714 aserciones en verde (`port/build/dbtests.exe`).
- Toolchain: g++ 14 (MSYS2 ucrt64) + CMake + Ninja, binario de tests estático.
  **Pendiente**: instalar clang + emsdk y verificar que la suite da verde compilada a
  WASM (decisión Q07: determinismo del port consigo mismo).

### Antes de nada, leé en este orden

1. `spec/PROGRESO.md` — estado autoritativo, tabla de milestones del port y registro.
   **Incluye la corrección de premisa del 2026-08-16** (el EXE compila CON chequeos;
   los flags `=0` del `.vbp` son casillas sin marcar): invalida cualquier intuición de
   "wrap silencioso".
2. `port/README.md` — build, reglas del port, pendientes.
3. `spec/30-FISICA.md` + `spec/32-VISION.md` — física y visión (el milestone que sigue).
4. `spec/10-CICLO.md §5` — dónde encaja cada rutina en las pasadas del tick.
5. `spec/70-CASOS-DORADOS.md §0` (convenciones del harness) y `§5` (los casos del
   milestone, F-01..F-15).

### Reglas duras

1. **Los fuentes VB6 (`Darwinbots2/`) son read-only.** Verificable con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. **El ciclo es siempre**: caso dorado transcrito como test en rojo → implementación
   transcrita del fuente VB6 citado línea a línea (no de memoria, no del wiki) →
   verde → commit citando la sección de la spec.
3. **Los `[PROBABLE BUG]` se replican tal cual** (regla 4 del brief). Los sitios de
   error 6/9/11 del original llevan decisión de port documentada por sitio + registro
   en `VmDiag`/`SimDiag` (`10-CICLO.md §14`).
4. **Salvaguardas numéricas** (`PLAN.md`): toda conversión float→int marcada por la
   spec pasa por `vb_round64`/`vb_clng`/`vb_cint` (bancario centralizado); `Single` =
   `float` estricto con casts explícitos en las fórmulas sensibles; nada de
   `-ffast-math`; sin FMA implícita (`-ffp-contract=off`); `-fwrapv` solo como red.
5. **Al cerrar el milestone**: actualizar `spec/PROGRESO.md` (tabla del port + sección
   "Siguiente" + registro con fecha) y commitear. Regenerar
   `spec/PROMPT-CONTINUACION.md` con `/prompt-continuacion`.

### Compilar y correr los tests

```
cmake -S port -B port/build -G Ninja
cmake --build port/build
port/build/dbtests.exe
```

(El exe linkea estático; no necesita las DLL de MSYS2 en el PATH.)

### Tu tarea: M4 · Física y visión

Según `spec/PROGRESO.md` ("Siguiente"):

1. **Los casos §5 (F-01..F-15)** de `70-CASOS-DORADOS.md`: `CalcMass`/`FindRadius`/
   `iceil`/`UpdatePosition` (F-01..F-04, en parte ya implementados en M3 — el caso
   dorado los fija), muelle de tie con zona muerta (F-05), `Repel3` con masas dadas
   (F-06, reemplaza la respuesta de impulso que M3 dejó fuera), `angle`/`angnorm`/
   `AngDiff` (F-07), visión completa (F-08..F-11: `AbsoluteEyeWidth`, `NarrowestEye`,
   `EyeSightDistance`, `eyestrength`, `eyevalue`, ojo panorámico por anchura
   negativa), `TieTorque` con su clamp cruzado (F-12, [PROBABLE BUG] B1-1), la
   librería de vectores que muta sus argumentos (F-13 — ya en `common.hpp`, el caso
   la fija), la oclusión por formas rota dos veces (F-14, [PROBABLE BUG] B2-1) y los
   sectores de `touch` (F-15).
2. **Reemplazar las simplificaciones de M3** manteniendo M-01..M-12 en verde:
   `BucketsCollisionSimple` → `BucketsCollision`/`Repel3` reales (par único, índice
   menor manda, efectos sensoriales inmediatos), `NewShotCollisionSimple` →
   swept-sphere con sesgo por índice (`33-SHOTS.md`), `VisionSweepStub` →
   `BucketsProximity` con los 9 ojos apuntables, y las fuerzas de muelle/torque de
   ties que `TieTiming` dejó como stub. Los contadores de `SimDiag` que queden en
   cero en los tests son la señal de que el stub correspondiente fue reemplazado.
3. Los casos R-05..R-07 (RNG de shots/ties) caen naturalmente aquí si tocás esas
   rutinas; R-08..R-12 (repoblación, crossover, orden global de RNG) son de los
   milestones de mundo/reproducción — no los arranques.
4. Verde total → commit(s) → actualizar `PROGRESO.md`.

Después de M4 vienen: formatos ida-y-vuelta (§7, FM-*) y el catálogo de bugs como
aserciones (§9, B-*). No los arranques sin cerrar M4.

## ↑ COPIAR HASTA AQUÍ ↑

*Regenerá este archivo con `/prompt-continuacion` al cerrar cada milestone.*
