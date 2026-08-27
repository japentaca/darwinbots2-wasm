# PROMPT-CONTINUACION — arranque de sesión nueva (post-E1)

Prompt autocontenido para continuar el desarrollo del port C++/WASM en una
**sesión nueva** de Claude Code. Pegarlo como primer mensaje, con el
directorio de trabajo en la raíz del repo (`Darwinbots2-master/`). Se
regenera con `/prompt-continuacion` al cerrar cada etapa; este refleja el
estado tras cerrar la etapa E1 del plan de extensiones (2026-08-26).

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

**Estado actual** (verificado 2026-08-26):
- Suite: **143 casos / 2962 aserciones en verde** en los tres modos (g++ 14.2,
  clang 19.1.7, WASM/Emscripten 6.0.8 bajo node).
- Milestones M1..M10 cerrados + Ext·Rendimiento (Web Worker) + Ext·Bestiary
  (588 bots del foro como presets). Hashes recientes: M9 `ef9b63d`,
  M10 `6e753ec`, Rendimiento `e935f78`, Bestiary `144e6e6`/`d52d9c4`.
  Línea base de fuentes VB6: `02b20d7`.
- **Etapa E1 cerrada** (escenario y física configurables, capa host):
  `db_sim_set_opt`/`db_sim_get_opt` por id estable en `wasm/dbcore_api.cpp`
  (46 ids con consumidor real en el core: toroidal/cilindros, física del
  medio con los presets exactos de `OptionsForm.frm:4406-4453`, luz y
  día/noche, decay, energía, restricciones) + panel "Opciones de sim" en
  `web/index.html` (tabla declarativa espejo; los ids aplican en vivo vía
  `{t:'setopt'}` del worker y se reenvían al reiniciar; tamaños del campo con
  la fórmula del slider original, `OptionsForm.frm:4075-4099`).
- CI en GitHub: `ci.yml` (suite en los tres modos + fuentes VB6 intactos) y
  `pages.yml` (demo viva; compila el preset wasm y publica `port/web/`).

**Orden de lectura al arrancar:**
1. `spec/PROGRESO.md` entero — fuente de verdad del estado (incluida la
   corrección de premisa 2026-08-16: el EXE original compila CON chequeos;
   errores 6/9/11 truncan el tick).
2. `spec/PLAN-EXTENSIONES.md` — el plan por etapas vigente (la tarea sale de ahí).
3. `port/README.md` — toolchain, build y estado por milestone.
4. Los fuentes del original que la etapa toque (para E2: `main.frm:953-1140`).

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
Compiladores: g++/clang de MSYS2 ucrt64, node 24.

**La tarea: etapa E2 — animaciones e inspección de bots (capa host).**
Según `spec/PLAN-EXTENSIONES.md` §E2, transcribir a la página las
visualizaciones de `main.frm` que el original dibujaba. En orden:

1. **Destellos de impacto de shots** (`DrawShots`, `main.frm:953-971` +
   paleta `FlashColor`, `main.frm:397-404`): ampliar `db_sim_dump_shots`
   (dbcore_api.cpp) con `flash` y `opos` (el core ya mantiene ambos:
   `shots.hpp:645,712`) y pintar en `web/index.html` el círculo de un frame
   por tipo — rojo robo de nrg (−1), blanco nrg (−2), azul veneno (−3),
   verde waste (−4), amarillo poison (−5), magenta robo de body (−6), cian
   virus (−7). Con toggle, como `displayShotImpactsToggle`.
2. **Selección de bot + alcance de la vista** (`main.frm:1017-1060`,
   `showVisionGridToggle`): clic en el canvas → bot más cercano; export
   nuevo que vuelque por ojo `[dir efectiva (EYE1DIR), semiancho
   (EYE1WIDTH), EyeSightDistance, valor visto]` (la matemática ya está en
   `vision.hpp` — NO recalcular en JS más que la geometría de dibujo);
   arcos cian, encogidos a la distancia vista con pluma invertida cuando el
   ojo ve, y el ojo con foco (`FOCUSEYE`) en rojo. Doble uso: herramienta de
   diagnóstico de visión.
3. **Inspector de bot**: panel con `db_sim_bot_text` (ya existe) + nrg/body/
   edad del bot seleccionado.
4. **Vectores de movimiento y gauges** (menú View del original): flechas de
   `vel` y barras nrg/body por bot, con sus toggles.
5. (Opcional, valor menor) skins `DrawRobSkin` y monitor RGB `DrawMonitor`.

Criterio de cierre E2: los toggles del menú View del original funcionando en
la página; suite intacta en verde en los tres modos; smoke node de los
exports nuevos; verificación en Chrome con consola limpia; PROGRESO.md
actualizado y prompt regenerado.

Después de E2 siguen E3 (formas/mazes/teleporters UI) y E4 (costes dinámicos,
**capa core** — pasos ⚙ 3/6-9 de `Master.bas`, con familia de casos dorados
nueva); ver `spec/PLAN-EXTENSIONES.md`.

## ↑ COPIAR HASTA AQUÍ ↑

Regenerar este archivo con `/prompt-continuacion` al cerrar cada etapa.
