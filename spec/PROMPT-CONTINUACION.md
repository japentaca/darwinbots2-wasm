# Prompt de continuación del port (post-M8)

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

El port vive en `port/` y **el core está completo**: los 8 milestones del motor
están cerrados y no queda ningún stub abierto.

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
  R-09..R-11 (con la corrección B6-1 a la spec: el hijo de padres alineados NO
  pierde su primer token).
- **M8 · Mundo + formatos de sim** (`0037d27`..`c4fb772`): economía vegetal
  (`feedvegs`/`feedveg2`/repoblación — R-08, B-37), teleporters con E/S sobre
  búferes en memoria (B-36, B7-2), obstacles (`DoObstacleCollisions`,
  `MoveObstacles` con su tope invertido que AMPLIFICA), `SaveOrganism`/
  `LoadOrganism` (`.dbo`), `SaveSimulation`/`LoadSimulation` campo a campo,
  sidecar `.mrate`, y **R-12** (el meta-caso del orden global de RNG del tick).
  El ciclo `UpdateSim` corre de punta a punta.
- **Estado verificado**: 143 casos / 2962 aserciones en verde
  (`port/build/dbtests.exe`).
- **Toolchain**: g++ 14 (MSYS2 ucrt64) + CMake + Ninja, binario de tests
  estático. **Pendiente: clang + emsdk** (la tarea de esta sesión).
- Línea base de los fuentes VB6: `02b20d7`.

**Antes de nada, leé en este orden**

1. `spec/PROGRESO.md` — estado autoritativo, tabla de milestones y registro.
   Incluye la corrección de premisa del 2026-08-16 (**el EXE compila CON
   chequeos**; los flags `=0` del `.vbp` son casillas sin marcar): invalida
   cualquier intuición de "wrap silencioso". Su sección "Siguiente" define M9/M10.
2. `port/README.md` — build, reglas del port y el detalle de qué cubre cada
   milestone.
3. `spec/PLAN.md` §"Decisión de arquitectura del port" — las 5 salvaguardas de
   build (obligatorias también para el build WASM).
4. `spec/70-CASOS-DORADOS.md` §0 (convenciones del harness) y §10.1 (los casos
   [FP·Q07] cuya tolerancia es relativa 1e-6, no bit a bit contra el original —
   pero el port SÍ se promete determinista consigo mismo).

**Reglas duras**

1. Los fuentes VB6 (`Darwinbots2/`) son **read-only**. Verificable con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. El ciclo es siempre: caso dorado transcrito como test **en rojo** →
   implementación **transcrita del fuente VB6 citado** línea a línea (no de
   memoria, no del wiki) → verde → commit citando la sección de la spec. (Para
   M9 no hay casos nuevos: la suite entera ES el caso; para M10, todo lo que
   toque el core sigue esta regla.)
3. Los `[PROBABLE BUG]` se replican tal cual (regla 4 del brief); los sitios de
   error 6/9/11 del original llevan decisión de port documentada por sitio +
   registro en `VmDiag`/`SimDiag` (`10-CICLO.md §14`).
4. Salvaguardas numéricas (`PLAN.md`): toda conversión float→int marcada por la
   spec pasa por `vb_round64`/`vb_clng`/`vb_cint` (bancario centralizado);
   `Single` = `float` estricto con casts explícitos; semántica VB6 ya replicada:
   `1/Single` y `Byte/100` dividen en Double, `Long + Single` promociona a
   Double, `IIf`/`And`/`Choose` evalúan todos sus brazos (consumen RNG aunque el
   brazo no gobierne); nada de `-ffast-math`; sin FMA implícita
   (`-ffp-contract=off`); `-fwrapv` solo como red.
5. Al cerrar el milestone: actualizar `spec/PROGRESO.md` (tabla del port +
   sección "Siguiente" + registro con fecha) y commitear. Regenerar
   `spec/PROMPT-CONTINUACION.md` con `/prompt-continuacion`.

**Compilar y correr los tests (build nativo actual)**

```
cmake -S port -B port/build -G Ninja
cmake --build port/build
port/build/dbtests.exe
```

(El exe linkea estático; no necesita las DLL de MSYS2 en el PATH.)

**Tu tarea: M9 · Build WASM (decisión Q07)**

Según `spec/PROGRESO.md` ("Siguiente"):

1. **Instalar el toolchain**: clang (idealmente vía MSYS2, `mingw-w64-ucrt-…` o
   el paquete clang64) y **emsdk** (Emscripten). Documentar versiones exactas en
   `port/README.md`. Si la instalación requiere pasos interactivos del usuario,
   dejarlos indicados con comandos concretos.
2. **Verificar la suite con clang nativo** primero: mismo CMake,
   `-DCMAKE_CXX_COMPILER=clang++`, mismas salvaguardas (`-fno-fast-math`,
   `-ffp-contract=off`, `-fwrapv`). Los 143 casos / 2962 aserciones deben dar
   verde idéntico. Cualquier divergencia numérica es un hallazgo: investigar
   antes de seguir (los sospechosos son los casos [FP·Q07] de §10.1).
3. **Compilar la suite a WASM** con emcmake/emcc (target node o standalone WASI,
   lo que menos fricción dé para correr doctest) y correrla (node). Verde total
   = la decisión Q07 queda verificada: determinismo del port consigo mismo,
   IEEE 754 estricto por operación.
4. Añadir al build los dos modos (nativo y WASM) de forma reproducible
   (presets de CMake o instrucciones en `port/README.md`), y si es razonable un
   target `dbcore` compilable a biblioteca WASM con exports mínimos (crear sim,
   tick, volcado de estado) como semilla de M10.
5. Cierre: actualizar `spec/PROGRESO.md` (tabla, "Siguiente" → M10 · capa de
   presentación web, registro con fecha), `port/README.md` (toolchain al día,
   pendiente de clang/emsdk saldado) y commitear.

Si algo del entorno bloquea la instalación (permisos, red), registrá el estado
exacto en `PROGRESO.md` como pendiente y pasá a preparar lo que no dependa de
ella (presets de CMake, API de exports para M10).

## ↑ COPIAR HASTA AQUÍ ↑

Regenerá este archivo con `/prompt-continuacion` al cerrar cada milestone.
