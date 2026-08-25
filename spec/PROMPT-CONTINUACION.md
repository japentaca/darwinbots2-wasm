# Prompt de continuación del ciclo de desarrollo (generado 2026-08-25, post-M6)

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
- **M4 · Física y visión** cerrado (`487c406`): `Physics.bas` completo, buckets de
  `Quads.bas`, visión completa (9 ojos apuntables, oclusión rota B2-1, ojo
  panorámico B2-2) y swept-sphere de shots con `CompactShots` fiel. Casos §5
  (F-01..F-15) y R-05..R-07.
- **M5 · Formatos ida-y-vuelta** cerrado (`2bc58f8`): `formats.hpp` con E/S sobre
  búferes en memoria — registro binario de bot campo a campo, bot de texto completo
  (gen epigenético autodestructivo, `Hash` ByRef), `getvals` y `delgene` real.
  Casos §7 (FM-01..FM-07). Los formatos de nivel sim
  (`SaveSimulation`/`.dbo`/`.mrate`) quedan para el milestone de mundo.
- **M6 · Catálogo de bugs (§9)** cerrado (`fe740a8`, `e88a65f`, `0121bd4`): los
  `[PROBABLE BUG]` como aserciones — **B-01..B-28 + B-30** en verde.
  Transcripciones arrastradas: visión de formas completa
  (`CompareShapes`/`lookoccurrShape`, B-12/13/14), matanza por presión de memoria
  (`MemoryPressureKill`, B-02), alimentación de shots
  (`releasenrg`/`takenrg`/`releasebod`/`defacate` — **B3a cerrada**; B-18/B-24),
  `MakeStuff` real (venom 1:1 / poison 4:1, B-26), **capa de virus B3b completa**
  (`MakeVirus`/`copygene`/`addgene`, B-19/20/21) y `bodyfix` configurable (B-25).
  Fidelidad: `nbody` de `Reproduce` en aritmética Single estricta (B-30; errata de
  spec corregida — los empates bancarios reales son 525→262 y 475→238).
  Contadores de stub cerrados y asertados a 0: `shapes_vision_stub`,
  `shot_feed_stub`, `makevirus_stub`. **Decisión registrada**: B-29/B-31..B-35
  quedaron para el milestone de mutaciones (B6); B-36/B-37 para el de mundo (B7).
- **Estado verificado**: 111 casos / 2484 aserciones en verde
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
3. `spec/40-MUTACIONES.md` (B6b: los 11 operadores, agenda, suelos anti-freeze) y
   `spec/36-REPRO.md` (B6a: `SexReproduce`/crossover, loterías vegetales).
4. `spec/70-CASOS-DORADOS.md` — **§9** para B-29 y B-31..B-35 (definiciones y la
   tabla de mapeo), **§6** para R-09..R-11; **§0** para las convenciones del harness.

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
   `float` estricto con casts explícitos en las fórmulas sensibles (lección de M6:
   `nbody` en double redondeaba distinto que el Single del original); nada de
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

**Tu tarea: M7 · Mutaciones y reproducción sexual (B6)**

Según `spec/PROGRESO.md` ("Siguiente"):

1. Leé `40-MUTACIONES.md` completo antes de escribir nada: los 11 operadores de
   `NeoMutations.bas`, la agenda geométrica vs Bernoulli/token, los suelos
   anti-freeze que **reescriben las tasas heredables** (`mutarray`), y el detalle
   Minor = MajorDeletion. `mutate` es hoy stub registrado (`mutate_stub`): al
   reemplazarlo, asertá el contador a 0 como se hizo en M4/M6.
2. Primer bloque natural: los **operadores de mutación** — habilita **B-31** (suelos
   anti-freeze reescriben `mutarray`), **B-32** (Minor = MajorDeletion salvo
   defaults), **B-33** (`Insertion` cuenta 2 mutaciones/token), **B-34**
   (`Amplification` nunca centra en el token 1) y **B-35** (mutaciones en vida no
   refrescan `makeoccurrlist`; ojo: `mem(336)/mem(339)` sí se re-publican).
3. Después, la **reproducción sexual** (`36-REPRO.md`): `SexReproduce`
   (`Robots.bas:2417-2848`), `simplematch`/`crossover` (`Robots.bas:562-694`) —
   hoy stub `sexrepro_stub` (asertar a 0 al reemplazar). Habilita **B-29**
   (el crossover pierde tramos; RNG-parametrizado con la secuencia de monedas
   fijada), **R-11** (el hijo sexual pierde su primer token — `Outdna` desde el
   índice 0) y **R-10** (loterías vegetales asimétricas 1/11 vs 1/10; la mitad
   asexual ya está portada en `Reproduce`). **R-09** (moneda del doble encolado
   repro/mrepro) ya tiene la rama portada en `ReproduceAndKill` — el caso fija las
   extracciones exactas de RNG con replays.
4. Los casos B-* y R-* que exigen mundo (B-36, B-37, R-08, R-12 — teleporters,
   repoblación, sol, orden global de RNG) son del milestone M8; si algo de B6
   resulta depender de ellos, decidilo caso a caso y dejalo registrado en
   `PROGRESO.md` como se hizo en M6.
5. Verde total → commit(s) → actualizar `PROGRESO.md`.

---

*Regenerá este archivo con `/prompt-continuacion` al cerrar cada milestone.*
