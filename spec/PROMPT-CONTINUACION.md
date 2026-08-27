# PROMPT-CONTINUACION — arranque de sesión nueva (post-E3)

Prompt autocontenido para continuar el desarrollo del port C++/WASM en una
**sesión nueva** de Claude Code. Pegarlo como primer mensaje, con el
directorio de trabajo en la raíz del repo (`Darwinbots2-master/`). Se
regenera con `/prompt-continuacion` al cerrar cada etapa; este refleja el
estado tras cerrar la etapa E3 del plan de extensiones (2026-08-27).

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
  E2 `ad65f01`, E3 `764a03f`. Línea base de fuentes VB6: `02b20d7`.
- **Etapas E1..E3 cerradas** (todas capa host, cero cambios en `port/core/`):
  E1 = opciones de sim por id estable (`db_sim_set_opt`/`get_opt`, panel en la
  página); E2 = toggles del menú View (destellos, rejilla de visión con
  `db_sim_dump_focus`, vectores, gauges) + selección de bot e inspector;
  E3 = menú Objects completo — formas (alta manual/±10 al azar/borrados con
  desplazamiento), los 6 mazes de `Obstacles.bas:45-181` transcritos en
  `wasm/dbcore_api.cpp` con el RNG de la sim (aperturas `Random` incluidas;
  layouts verificados EXACTOS contra réplica del LCG), teleporters
  (highlight por tipo/borrar uno/todos), ids 80-85 en el panel y selección
  por clic con la prioridad de `Form_MouseDown` (bot → teleporter →
  obstáculo).
- CI en GitHub: `ci.yml` (suite en los tres modos + fuentes VB6 intactos) y
  `pages.yml` (demo viva; compila el preset wasm y publica `port/web/`).

**Orden de lectura al arrancar:**
1. `spec/PROGRESO.md` entero — fuente de verdad del estado (incluida la
   corrección de premisa 2026-08-16: el EXE original compila CON chequeos;
   errores 6/9/11 truncan el tick).
2. `spec/PLAN-EXTENSIONES.md` — el plan por etapas vigente (la tarea sale de ahí).
3. `spec/10-CICLO.md §2` — la tabla de los 26 pasos del tick (E4 implementa
   los pasos hoy marcados fuera de contrato) y `spec/31-ENERGIA.md` (costes).
4. `port/README.md` — toolchain, build y estado por milestone.
5. Los fuentes del original que la etapa toca: `Master.bas:240-300` (pasos
   6-7: población y ajuste dinámico de costes), `Master.bas:52-201` (paso 3,
   hidepred/evo ⚙), `Master.bas:302-330` (pasos 8-9), `SimOptions.bas`
   (`DynamicCosts`, `PopLimMethod`, Costs 51..62) y `CostsForm.frm` (la UI
   que fija esos índices).

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
`netstat -ano | grep :8000` y servir en otro puerto (p. ej. 8020, verificando
que quede UN solo PID escuchando). ⚠️ Al verificar en Chrome: el rAF de una
ventana ocluida se estrangula a ~2 fps y con speed>0 los ticks van atados al
ack del frame — stats "congeladas" no son un cuelgue, es throttling.
Compiladores: g++/clang de MSYS2 ucrt64, node 24.

**La tarea: etapa E4 — costes dinámicos y torneo del tick (CAPA CORE).**
Según `spec/PLAN-EXTENSIONES.md §E4`, es el primer trabajo de core desde M8:
**rama nueva + revisión antes de mergear**, con familia de casos dorados
nueva **E4-\*** (extender la suite; la spec de referencia es la tabla del
tick en `10-CICLO.md §2` y `31-ENERGIA.md`). Alcance:

1. **Paso 6** (`Master.bas:240-252`, hoy parcial/fuera de contrato):
   `CurrentPopulation` desde `totnvegsDisplayed` (+ vegetales si
   `DYNAMICCOSTINCLUDEPLANTS`, Costs índice según `CostsForm.frm`) e
   historial `PopulationLast10Cycles` desplazado cada 10 ciclos.
2. **Paso 7** (`Master.bas:254-300`): el ajuste dinámico de `COSTMULTIPLIER`
   (Costs(54)): ±1e-7 × desvío × sensibilidad cuando la población sale del
   objetivo (`DYNAMICCOSTTARGET`/`SENSITIVITY`, upper/lower — Costs 51..62,
   nombres exactos en `SimOptions.bas` y `CostsForm.frm`); suelo en 0 salvo
   `ALLOWNEGATIVECOSTX`; cero-costes bajo `BOTNOCOSTLEVEL` con
   reinstauración sobre `COSTXREINSTATEMENTLEVEL` (estado global
   `DynamicCountdown`/`CostsWereZeroed`, `Master.bas:3-4` — decidir dónde
   vive en `Sim` y si un save lo persiste, mirando `HDRoutines.bas`).
3. **`PopLimMethod`** (`SimOptions.bas:76`): los modos de límite de
   población que el core aún no distinga (mirar sus consumidores reales con
   grep antes de implementar — parte está comentada en `main.frm:2959-2960`).
4. **Pasos ⚙ 3, 8, 9** (`Master.bas:52-201, 302-330`): hidepred/evo,
   handicap a "Mutate.txt", `avrnrgStart`/`avrnrgEnd` — capa torneo; evaluar
   con el fuente a la vista cuánto tiene consumidor real fuera del modo
   torneo/F1 y documentar qué queda fuera y por qué (puede cerrarse como
   "transcrito" o como "fuera de alcance documentado" si solo alimenta a E5).
5. Exponer lo nuevo por la capa host donde aplique (ids de opción para
   `DynamicCosts` on/off y `PopLimMethod` si el core los consume; los Costs
   51..62 ya viajan por `db_sim_set_cost`).

Criterio de cierre E4: familia E4-* en la suite (casos en rojo → verde
transcribiendo `Master.bas`, con inventario RNG de los pasos nuevos si
consumen `rndy`); suite completa en verde en los tres modos; decisión
documentada para cada pieza ⚙ que quede fuera; PROGRESO.md actualizado,
rama revisada y mergeada, y prompt regenerado.

Después de E4 sigue E5 (modos de juego: F1/League/Restart, auto-forking,
PlayerBot — core + host); ver `spec/PLAN-EXTENSIONES.md`.

## ↑ COPIAR HASTA AQUÍ ↑

Regenerar este archivo con `/prompt-continuacion` al cerrar cada etapa.
