# PROMPT-CONTINUACION — arranque de sesión nueva (post-E4)

Prompt autocontenido para continuar el desarrollo del port C++/WASM en una
**sesión nueva** de Claude Code. Pegarlo como primer mensaje, con el
directorio de trabajo en la raíz del repo (`Darwinbots2-master/`). Se
regenera con `/prompt-continuacion` al cerrar cada etapa; este refleja el
estado tras cerrar la etapa E4 del plan de extensiones (2026-08-27).

## ↓ COPIAR DESDE AQUÍ ↓

Continuá el desarrollo del port C++/WASM de DarwinBots 2.48.32.

**Contexto.** El original es un simulador de vida artificial en VB6
(`Darwinbots2/`, 53 327 LOC, read-only). La especificación extraída vive en
`spec/` y está **completa y cerrada**: es el contrato del port, con
`spec/70-CASOS-DORADOS.md` como suite de verdad (150 casos, familia E4-*
incluida en §11) y la regla de oro "el fuente es la spec" para desambiguar
(el wiki no entra). Cuando un comportamiento del original es un bug, se
replica tal cual (`[PROBABLE BUG]`).

El port vive en `port/`: core C++20 de headers puros (`port/core/include/dbcore/`)
sin dependencias de render, compilado nativo (gcc/clang) y a WASM (Emscripten);
la presentación es una página web (`port/web/index.html` + `worker.js`) sobre la
API C de `port/wasm/dbcore_api.cpp`. **El port del core está completo** (M1..M10
+ extensiones Rendimiento y Bestiary cerradas) y ahora se ejecuta el plan de
extensiones de `spec/PLAN-EXTENSIONES.md`: el resto de la superficie funcional
del original (UI/animaciones/opciones/modos), por etapas E1..E8.

**Estado actual** (verificado 2026-08-27):
- Suite: **150 casos / 3031 aserciones en verde** en los tres modos (g++ 14.2,
  clang 19.1.7, WASM/Emscripten 6.0.8 bajo node).
- Milestones M1..M10 cerrados + Ext·Rendimiento (Web Worker) + Ext·Bestiary
  (588 bots del foro como presets). Hashes recientes: E1 `5b83de5`,
  E2 `ad65f01`, E3 `764a03f`, E4 `5adab56`/`4a2f554` (merge `71c3121`).
  Línea base de fuentes VB6: `02b20d7`.
- **Etapas E1..E4 cerradas**. E1-E3 = capa host (opciones por id, toggles del
  menú View + inspector, menú Objects completo con los 6 mazes verificados
  EXACTOS). E4 = **primer core desde M8** (rama revisada y mergeada): pasos
  6-7 del tick transcritos de `Master.bas:240-300` (`DynamicCostsStep` en
  `master.hpp`, ANTES de `ExecRobs`), familia E4-01..E4-07 nueva en la suite,
  estado `DynamicCountdown`/`CostsWereZeroed`/`PopulationLast10Cycles` en
  `Sim` (no persistido, como el original), decisión E4-D1 (quirk TmpOpts) y
  hallazgo del centinela −1 documentados en `70-CASOS-DORADOS.md §11`; capa
  host `{t:'setcost'}` + grupo "Costes dinámicos" + CostX en stats. Quedaron
  explícitamente para E5: pasos ⚙ 3/8/9/22 (hidepred/evo, handicap, avrnrg —
  su único consumidor es el modo evo `x_restartmode` 4/5) y `PopLimMethod`
  quedó documentado sin consumidor vivo (solo persistencia).
- CI en GitHub: `ci.yml` (suite en los tres modos + fuentes VB6 intactos) y
  `pages.yml` (demo viva; compila el preset wasm y publica `port/web/`).

**Orden de lectura al arrancar:**
1. `spec/PROGRESO.md` entero — fuente de verdad del estado (incluida la
   corrección de premisa 2026-08-16: el EXE original compila CON chequeos;
   errores 6/9/11 truncan el tick).
2. `spec/PLAN-EXTENSIONES.md §E5` — el alcance de la etapa.
3. `spec/10-CICLO.md §2` — la tabla de los 26 pasos del tick: E5 implementa
   los pasos ⚙ 3 (hidepred/evo), 8-9 y 22 (handicap/avrnrg), 13 (PlayerBot)
   y 26 (modos restart/seeding/ZeroBot/test). `spec/50-MUNDO.md` §capa
   torneo para el deslinde ya hecho.
4. `port/README.md` — toolchain, build y estado por milestone.
5. Los fuentes del original que la etapa toca: `F1Mode.bas` entero (liga,
   restart, contests), `Contest_Form.frm`, `Master.bas:52-201` (paso 3),
   `:302-330` (pasos 8-9), `:398-414` (paso 22), `:483-554` (paso 26, con el
   `Static totnrgnvegs` en `:530`), `Master.bas:347-360` (paso 13 PlayerBot,
   con `PB_keys`/`MDIForm1.pbOn`), `Globals.bas:84` (`x_restartmode As
   Byte`) y sus escritores (grep), la tab "Restart and League" de
   `OptionsForm.frm`, y `NeoMutations.bas:190-210` (auto-forking:
   `SpeciationForkInterval` se usa como CONTADOR además de intervalo —
   mirar `HDRoutines.bas:1458` antes de asumir semántica).

**Reglas duras:**
1. Los fuentes VB6 (`Darwinbots2/`) son read-only — verificable con
   `git diff 02b20d7 -- Darwinbots2/` vacío.
2. Para trabajo de **core** (`port/core/`), el ciclo es siempre: caso dorado
   como test en rojo → implementación transcrita del fuente VB6 citado (no de
   memoria, no del wiki) → verde → commit citando la sección de spec, en
   **rama nueva con revisión antes de mergear** (familia de casos E5-* si
   aplica, siguiendo el patrón de E4 en `70-CASOS-DORADOS.md §11`). Para
   trabajo de **capa host** (wasm API/JS/HTML), el core no se toca: la suite
   queda intacta por construcción y se verifica igual en verde; la
   verificación de la etapa es smoke test bajo node + prueba en Chrome.
3. Los `[PROBABLE BUG]` se replican tal cual; los sitios de error 6/9/11
   llevan decisión de port documentada + registro en `VmDiag`/`SimDiag`.
4. Salvaguardas numéricas de `PLAN.md`: redondeo bancario centralizado
   (`vb_round64`/`vb_cint`/`vb_clng`), `float` estricto para `Single`, nada
   de `-ffast-math`, `-ffp-contract=off` (sin FMA implícita), `-fwrapv` solo
   como red. Ojo con los literales VB6: `0.1`-style son `Double` (E4 lo
   ejercitó con `0.0000001`).
5. Al cerrar la etapa: actualizar `spec/PROGRESO.md` (tabla de etapas en
   "Pendiente" + registro con fecha), commitear y regenerar este prompt con
   `/prompt-continuacion`.

**Build y tests** (desde `port/`; CMake ≥ 3.25):
```
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
```
El preset `wasm` necesita `EMSDK` en el entorno (en esta máquina:
`EMSDK=C:/Users/jntac/emsdk`; en bash: `export EMSDK=/c/Users/jntac/emsdk &&
source "$EMSDK/emsdk_env.sh"`). Produce también `build-wasm/dbcore.js/.wasm`
(la biblioteca de la página). La página se sirve con
`cd port && python -m http.server 8000` → `http://localhost:8000/web/`.
⚠️ Ojo: pueden quedar `http.server` de sesiones anteriores vivos en el 8000
sirviendo la página vieja — si la demo no refleja los cambios, verificar con
`netstat -ano | grep :8000` y servir en otro puerto (p. ej. 8020, verificando
que quede UN solo PID escuchando), y recargar con Ctrl+Shift+R (el worker.js
se cachea). ⚠️ Al verificar en Chrome: el rAF de una ventana ocluida se
estrangula (hasta 0 fps con la ventana tapada) y con speed>0 los ticks van
atados al ack del frame — stats "congeladas" no son un cuelgue, es
throttling; los clics por coordenada pueden desfasarse si el panel se
re-renderiza: usar `find`+ref. Compiladores: g++/clang de MSYS2 ucrt64,
node 24.

**La tarea: etapa E5 — modos de juego (CORE + HOST).**
Según `spec/PLAN-EXTENSIONES.md §E5`. Alcance a desglosar con el fuente a la
vista (parte del trabajo de la etapa es el deslinde core/host de cada pieza):

1. **F1 / League / Restart** (`F1Mode.bas`, tab "Restart and League" de
   `OptionsForm.frm`, `Contest_Form.frm`): condiciones de reinicio de ronda
   (`SimOpts.Restart`/`F1`, `StartAnotherRound` — el gate ya existe en el
   loop del original, `main.frm:2081`), liga y contests. Decidir qué corre
   en core (condiciones/estado de ronda) y qué es host (UI, archivos de
   liga).
2. **Paso 26 del tick** (`Master.bas:483-554`): `x_restartmode` = 1
   (re-seeding), 7/8 (ZeroBot), 9 (test, con `Static totnrgnvegs` — estado
   entre ciclos), y el par 4/5 (evo) que habilita los pasos ⚙ que E4 dejó
   documentados: 3 (hidepred, conteo Base/Mutate, reposicionado de chasers,
   alternancia con `rndy` — CONSUME RNG, inventariar), 8-9 y 22 (handicap
   `calc_handycap` y `avrnrgStart/End` con `energydif*`).
3. **Auto-forking** (`SpeciationForkInterval`; la auto-especiación por
   distancia ya está en `mutations.hpp`) — verificar la semántica real en
   `NeoMutations.bas:190-210` (se incrementa como contador) antes de
   implementar.
4. **PlayerBot Mode** (paso 13, `Master.bas:347-360`): overwrites de
   `mem(SetAim)` y teclas → posiciones de memoria. El estado (`PB_keys`,
   mouse) es host; el overwrite en el tick es core o API (decidir y
   documentar).
5. "Automatically tag by name", "Restriction Overwrites", hidepred UI —
   evaluar consumidor real con grep y documentar qué queda fuera y por qué.
6. Exponer lo nuevo por la capa host (mensajes del worker + UI) donde
   aplique.

Criterio de cierre E5: todo trabajo de core en rama con revisión y casos
nuevos (familia E5-*, con inventario RNG de los pasos que consumen `rndy` —
el paso 3 consume); suite completa en verde en los tres modos; decisión
documentada para cada pieza que quede fuera; smoke node + Chrome para la
capa host; PROGRESO.md actualizado y prompt regenerado.

Después de E5 sigue E6 (registro/análisis: gráficas, snapshots — capa host);
ver `spec/PLAN-EXTENSIONES.md`.

## ↑ COPIAR HASTA AQUÍ ↑

Regenerar este archivo con `/prompt-continuacion` al cerrar cada etapa.
