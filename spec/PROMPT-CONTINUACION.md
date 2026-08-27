# PROMPT-CONTINUACION — arranque de sesión nueva (post-E2)

Prompt autocontenido para continuar el desarrollo del port C++/WASM en una
**sesión nueva** de Claude Code. Pegarlo como primer mensaje, con el
directorio de trabajo en la raíz del repo (`Darwinbots2-master/`). Se
regenera con `/prompt-continuacion` al cerrar cada etapa; este refleja el
estado tras cerrar la etapa E2 del plan de extensiones (2026-08-27).

## ↓ COPIAR DESDE AQUÍ ↓

Continuá el desarrollo del port C++/WASM de DarwinBots 2.48.32.

**Contexto.** El original es un simulador de vida artificial en VB6
(`Darwinbots2/`, 53 327 LOC, read-only). La especificación extraída vive en
`spec/` y está **completa y cerrada**: es el contrato del port, con
`spec/70-CASOS-DORADOS.md` como suite de verdad (~143 casos) y la regla de
oro "el fuente es la spec" para desambiguar (el wiki no entra). Cuando un
comportamiento del original es un bug, se replica tal cual (`[PROBABLE BUG]`).

El port vive en `port/`: core C++20 de headers puros (`port/core/include/dbcore/`)
sin dependencias de render, compilado nativo (gcc/clang) y a WASM (Emscripten);
la presentación es una página web (`port/web/index.html` + `worker.js`) sobre la
API C de `port/wasm/dbcore_api.cpp`. **El port del core está completo** (M1..M10
+ extensiones Rendimiento y Bestiary cerradas) y ahora se ejecuta el plan de
extensiones de `spec/PLAN-EXTENSIONES.md`: el resto de la superficie funcional
del original (UI/animaciones/opciones/modos), por etapas E1..E8.

**Estado actual** (verificado 2026-08-27):
- Suite: **143 casos / 2962 aserciones en verde** en los tres modos (g++ 14.2,
  clang 19.1.7, WASM/Emscripten 6.0.8 bajo node).
- Milestones M1..M10 cerrados + Ext·Rendimiento (Web Worker) + Ext·Bestiary
  (588 bots del foro como presets). Hashes recientes: M10 `6e753ec`,
  Rendimiento `e935f78`, Bestiary `144e6e6`/`d52d9c4`, E1 `5b83de5`,
  E2 `ad65f01`. Línea base de fuentes VB6: `02b20d7`.
- **Etapa E1 cerrada** (escenario y física configurables, capa host):
  `db_sim_set_opt`/`db_sim_get_opt` por id estable en `wasm/dbcore_api.cpp`
  (46 ids con consumidor real en el core) + panel "Opciones de sim" en
  `web/index.html` (aplican en vivo vía `{t:'setopt'}` del worker).
- **Etapa E2 cerrada** (animaciones e inspección, capa host): los 4 toggles
  del menú View del original en la página — destellos de impacto de shots
  (dump de shots 6→9 floats con `flash`+`opos`), rejilla de visión del bot
  seleccionado (export `db_sim_dump_focus`: inspector + 9 ojos con la
  matemática de visión del core; la página dibuja con la geometría literal
  de `main.frm:1017-1060`), vectores de movimiento y gauges de recursos
  (dump de bots 8→20 floats). Selección por clic (`whichrob` transcrito) e
  inspector con `db_sim_bot_text` + nrg/body/edad en vivo. Omitidos por
  valor menor: skins `DrawRobSkin` y monitor RGB `DrawMonitor`.
- CI en GitHub: `ci.yml` (suite en los tres modos + fuentes VB6 intactos) y
  `pages.yml` (demo viva; compila el preset wasm y publica `port/web/`).

**Orden de lectura al arrancar:**
1. `spec/PROGRESO.md` entero — fuente de verdad del estado (incluida la
   corrección de premisa 2026-08-16: el EXE original compila CON chequeos;
   errores 6/9/11 truncan el tick).
2. `spec/PLAN-EXTENSIONES.md` — el plan por etapas vigente (la tarea sale de ahí).
3. `port/README.md` — toolchain, build y estado por milestone.
4. Los fuentes del original que la etapa toque (para E3:
   `Obstacles.bas:45-208` y el menú Objects de `MDIForm1.frm`).

**Reglas duras:**
1. Los fuentes VB6 (`Darwinbots2/`) son read-only — verificable con
   `git diff 02b20d7 -- Darwinbots2/` vacío.
2. Para trabajo de **core** (`port/core/`), el ciclo es siempre: caso dorado
   como test en rojo → implementación transcrita del fuente VB6 citado (no de
   memoria, no del wiki) → verde → commit citando la sección de spec. Para
   trabajo de **capa host** (wasm API/JS/HTML), el core no se toca: la suite
   queda intacta por construcción y se verifica igual en verde; la
   verificación de la etapa es smoke test bajo node + prueba en Chrome.
3. Los `[PROBABLE BUG]` se replican tal cual; los sitios de error 6/9/11
   llevan decisión de port documentada + registro en `VmDiag`/`SimDiag`.
4. Salvaguardas numéricas de `PLAN.md`: redondeo bancario centralizado
   (`vb_round64`/`vb_cint`/`vb_clng`), `float` estricto para `Single`, nada
   de `-ffast-math`, `-ffp-contract=off` (sin FMA implícita), `-fwrapv` solo
   como red.
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
`netstat -ano | grep :8000` y servir en otro puerto (p. ej. 8010).
Compiladores: g++/clang de MSYS2 ucrt64, node 24.

**La tarea: etapa E3 — objetos del escenario: formas, mazes, teleporters
(capa host).** Según `spec/PLAN-EXTENSIONES.md` §E3, exponer el menú
"Objects" del original en la página. En orden:

1. **Shapes UI**: alta manual de obstáculo (la API `db_sim_add_obstacle` ya
   existe), "Add Ten Random Shapes" / "Delete 10 Random Shapes" / "Delete
   All Shapes" (`MDIForm1.frm:1115-1148,1186` — transcribir su consumo de
   RNG si sortean posición/tamaño con `Random`), borrar el obstáculo
   seleccionado (clic, como `whichobstacle`). Los toggles de
   visible/transparente/absorbe-shots y la deriva (V/H + `shapeDriftRate`)
   ya están en el core — solo exponer por id de opción (ampliar la tabla de
   `db_sim_set_opt` si les falta id).
2. **Mazes** (`Obstacles.bas:45-208`): los 6 generadores — horizontal (:45),
   vertical (:61), checkerboard (:78), polar ice (:110), trash compactor
   (:129, con su movimiento `TrashCompactorMove` :146 ya en core) y espiral
   (`DrawSpiral` :158). Transcribir las fórmulas de layout como llamadas a
   `db_sim_add_obstacle` desde la capa host (o exports nuevos si el maze
   necesita estado del core, como los compactors), respetando su consumo de
   RNG (`Random` en los openings) y los defaults `mazeCorridorWidth = 500`,
   `mazeWallThickness = 50` (`MDIForm1.frm:2464-2465`). Nota: polar ice y
   trash compactor encienden la deriva (`allowHorizontal/VerticalShapeDrift`,
   `shapeDriftRate = 20`).
3. **Teleporters UI**: el alta ya está exportada (`db_sim_add_teleporter`);
   faltan resaltar el teleporter clickeado, borrar uno y borrar todos
   (`MDIForm1.frm:1174-1184`, `whichTeleporter` de `main.frm`).

Criterio de cierre E3: cada maze reproduce el layout del original a igual
campo (comparar contra las fórmulas transcritas, con RNG inyectado en el
smoke); alta/borrado de shapes y teleporters funcionando en la página; suite
intacta en verde en los tres modos; smoke node de los exports nuevos;
verificación en Chrome con consola limpia; PROGRESO.md actualizado y prompt
regenerado.

Después de E3 sigue E4 (costes dinámicos y torneo del tick, **capa core** —
pasos ⚙ 3/6-9 de `Master.bas`, con familia de casos dorados nueva E4-*, rama
+ revisión); ver `spec/PLAN-EXTENSIONES.md`.

## ↑ COPIAR HASTA AQUÍ ↑

Regenerar este archivo con `/prompt-continuacion` al cerrar cada etapa.
