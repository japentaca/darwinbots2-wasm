# Prompt de continuación del port (post-M9)

Prompt de arranque para la **próxima sesión** de Claude Code. Pegalo como primer
mensaje con el directorio de trabajo en la raíz del repo
(`Darwinbots2-master/`). Es autocontenido: no depende de la memoria de ninguna
sesión anterior, solo de los archivos del repo. Se usa en sesión nueva porque el
desarrollo consume mucho contexto y conviene arrancar limpio con el estado
escrito en disco.

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de **DarwinBots 2.48.32 (Visual Basic 6)**.

El proyecto: reimplementar el simulador desde cero — **core en C++ compilado a WASM vía
Emscripten, render 2D en web** (decisión y salvaguardas de build en `spec/PLAN.md`).
La especificación en `spec/` está **completa** (Fase 0 + Bloques A, B y C cerrados) y es
el contrato del port; `spec/70-CASOS-DORADOS.md` es la suite de verdad. Cuando haya que
desambiguar algo, **el fuente VB6 es la spec** y los documentos de `spec/` son su índice.

El port vive en `port/`. **El core está completo y verificado en WASM**: los 9
milestones del motor están cerrados, no queda ningún stub abierto y la decisión Q07
quedó verificada empíricamente.

- **M1 · Sustrato numérico** (`9182e8e`): redondeo bancario, LCG de VB6, gasdev,
  stacks, mod32000, handlers de la VM. Casos §1, §2, R-01..R-03.
- **M2 · VM y cargador** (`54d586e`): `ExecuteDNA` completo y cargador de texto.
  Casos §3 (V-01..V-14).
- **M3 · Memoria y ciclo** (`39fd715`): tabla de sysvars, esqueleto del tick,
  sentidos/ties/shots/Reproduce/corpses. Casos §4 (M-01..M-12).
- **M4 · Física y visión** (`487c406`): `Physics.bas`, buckets, visión completa,
  swept-sphere de shots. Casos §5 (F-01..F-15) y R-05..R-07.
- **M5 · Formatos ida-y-vuelta** (`2bc58f8`): bot de texto (gen epigenético,
  `Hash` ByRef) y registro binario de bot. Casos §7 (FM-01..FM-07).
- **M6 · Catálogo de bugs** (`fe740a8`..`0121bd4`): B-01..B-28 + B-30 como
  aserciones; visión de formas, alimentación de shots, virus B3b, `MakeStuff`.
- **M7 · Mutaciones y reproducción sexual** (`de80e6c`): `NeoMutations.bas`
  completo, crossover/`SexReproduce`, herencia de `Reproduce`. B-29, B-31..B-35,
  R-09..R-11.
- **M8 · Mundo + formatos de sim** (`0037d27`..`c4fb772`): economía vegetal,
  teleporters (E/S sobre búferes `outbox`/`inbox` en memoria), obstacles,
  `.dbo`, `SaveSimulation`/`LoadSimulation`, `.mrate`, y **R-12** (orden global
  de RNG del tick). El ciclo `UpdateSim` corre de punta a punta.
- **M9 · Build WASM, Q07 verificada** (`ef9b63d`): la suite entera da **verde
  idéntico en tres modos** — g++ 14.2 nativo, clang 19.1.7 nativo y WASM vía
  Emscripten 6.0.8 corriendo bajo node — sin una sola divergencia numérica
  (tampoco en los casos [FP·Q07] de §10.1). Presets reproducibles en
  `port/CMakePresets.json` (`native-gcc`/`native-clang`/`wasm`). **Semilla de
  M10**: `port/wasm/dbcore_api.cpp` compila a `dbcore.js`/`dbcore.wasm`
  (MODULARIZE, export `createDbCore`) con la API mínima: crear/destruir sim,
  `Randomize`, sembrar fundador desde texto de ADN, tick y volcado de estado
  para render (8 floats/bot), verificada con smoke test bajo node.
- **Estado verificado**: 143 casos / 2962 aserciones en verde en los tres
  modos de build.
- **Toolchain** (todo instalado y documentado en `port/README.md`): g++ 14.2 y
  clang 19.1.7 (MSYS2 ucrt64), CMake 4.0.1 + Ninja, emsdk en `~/emsdk`
  (Emscripten 6.0.8; el preset `wasm` necesita la variable de entorno
  `EMSDK=C:/Users/<usuario>/emsdk`), node 24.
- Línea base de los fuentes VB6: `02b20d7`.

**Antes de nada, leé en este orden**

1. `spec/PROGRESO.md` — estado autoritativo, tabla de milestones y registro.
   Incluye la corrección de premisa del 2026-08-16 (**el EXE compila CON
   chequeos**; los flags `=0` del `.vbp` son casillas sin marcar): invalida
   cualquier intuición de "wrap silencioso". Su sección "Siguiente" define M10.
2. `port/README.md` — los tres modos de build, el toolchain verificado y qué
   cubre cada milestone (incluida la API actual de `wasm/dbcore_api.cpp`).
3. `spec/PLAN.md` §"Decisión de arquitectura del port" — las 5 salvaguardas de
   build (obligatorias también para todo lo que se recompile a WASM).
4. Para la capa host: `spec/50-MUNDO.md` (teleporters/E-S), `spec/60-FORMATOS.md`
   (qué mueve la UI vs qué mueve el core) y `spec/10-CICLO.md §1` (qué hacía el
   form de VB6 alrededor del tick: el contrato core/presentación del original).

**Reglas duras**

1. Los fuentes VB6 (`Darwinbots2/`) son **read-only**. Verificable con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. El ciclo es siempre: caso dorado transcrito como test **en rojo** →
   implementación **transcrita del fuente VB6 citado** línea a línea (no de
   memoria, no del wiki) → verde → commit citando la sección de la spec.
   (M10 es capa host: no tiene casos dorados propios, pero **todo lo que toque
   `port/core/` sigue esta regla** y la suite entera debe seguir en verde en
   los tres modos tras cada cambio.)
3. Los `[PROBABLE BUG]` se replican tal cual (regla 4 del brief); los sitios de
   error 6/9/11 del original llevan decisión de port documentada por sitio +
   registro en `VmDiag`/`SimDiag` (`10-CICLO.md §14`).
4. Salvaguardas numéricas (`PLAN.md`): toda conversión float→int marcada por la
   spec pasa por `vb_round64`/`vb_clng`/`vb_cint` (bancario centralizado);
   `Single` = `float` estricto con casts explícitos; semántica VB6 ya replicada:
   `1/Single` y `Byte/100` dividen en Double, `Long + Single` promociona a
   Double, `IIf`/`And`/`Choose` evalúan todos sus brazos (consumen RNG aunque el
   brazo no gobierne); nada de `-ffast-math`; sin FMA implícita
   (`-ffp-contract=off`); `-fwrapv` solo como red. La capa JS/render nunca
   recalcula física ni RNG: solo presenta lo que el core vuelca.
5. Al cerrar el milestone: actualizar `spec/PROGRESO.md` (tabla del port +
   sección "Siguiente" + registro con fecha) y commitear. Regenerar
   `spec/PROMPT-CONTINUACION.md` con `/prompt-continuacion`.

**Compilar y correr los tests (presets de CMake; correr desde `port/`)**

```
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
```

(El preset `wasm` requiere `EMSDK` en el entorno y produce además
`build-wasm/dbcore.js` + `dbcore.wasm`. Los exe nativos linkean estático; no
necesitan las DLL de MSYS2 en el PATH.)

**Tu tarea: M10 · Capa de presentación web**

Según `spec/PROGRESO.md` ("Siguiente"), sobre la semilla de M9
(`port/wasm/dbcore_api.cpp`):

1. **Ampliar la API del core hacia JS** donde el render y el control lo
   necesiten: exponer opciones de sim (SimOpts esenciales: campo, costes,
   MinVegs/repoblación, mutaciones on/off), E/S de búferes para guardar/cargar
   (`SaveSimulation`/`LoadSimulation`, `.dbo` — ya operan sobre memoria en
   `formats.hpp`) y los búferes `outbox`/`inbox` de teleporters (la capa host
   mueve los "archivos"; el core nunca toca disco). Volcado de estado
   suficiente para render: bots (pos/radio/aim/color/flags — ya existe),
   shots, ties, obstacles y teleporters.
2. **Render 2D en web** (Canvas 2D es suficiente para arrancar; WebGL si hace
   falta): página que carga `dbcore.js`/`dbcore.wasm`, siembra especies desde
   texto de ADN, corre el tick en un loop (requestAnimationFrame o worker) y
   dibuja el estado. Controles mínimos: iniciar/pausar, velocidad, sembrar.
3. **Decisiones de capa host** (fuera del contrato de fidelidad, documentarlas
   donde vivan): el movimiento de archivos de teleporters entre sims, el
   `SimGUID` ausente (queda en 0) y los colores con `Rnd` crudo (Q01).
4. La suite de 143 casos debe seguir en verde en los tres modos tras cualquier
   cambio en `port/core/` o en el CMake. Si un export nuevo necesita tocar el
   core, la regla 2 aplica entera.
5. Cierre: actualizar `spec/PROGRESO.md` (tabla, "Siguiente", registro con
   fecha), `port/README.md` (API y cómo servir/abrir la página) y commitear.

Si algo del entorno bloquea (p. ej. servir la página con MIME de wasm),
registrá el estado exacto en `PROGRESO.md` y dejá indicados los comandos
concretos para el usuario.

## ↑ COPIAR HASTA AQUÍ ↑

Regenerá este archivo con `/prompt-continuacion` al cerrar cada milestone.
