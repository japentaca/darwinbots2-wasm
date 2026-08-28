# Prompt de continuación — sesión nueva (post-E5)

Artefacto **regenerable** (no es historia): lo reescribe `/prompt-continuacion` al
cerrar cada etapa. Pegá el bloque de abajo como **primer mensaje** de una sesión
nueva de Claude Code abierta en el directorio del repo
(`C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`). Sesión nueva porque el
prompt es autocontenido: no referencia nada de la conversación anterior, solo
archivos del repo y hashes de commit.

Generado el 2026-08-28, tras cerrar la etapa **E5 · Modos de juego**.

## ↓ COPIAR DESDE AQUÍ ↓

Continuá el desarrollo del port C++/WASM de DarwinBots 2.48.32.

**Contexto.** El original es un simulador de vida artificial en VB6
(`Darwinbots2/`, 53 327 LOC, read-only). La especificación extraída vive en
`spec/` y está **completa y cerrada**: es el contrato del port, con
`spec/70-CASOS-DORADOS.md` como suite de verdad (166 casos, familias E4-* en
§11 y E5-* en §12) y la regla de oro "el fuente es la spec" para desambiguar
(el wiki no entra). Cuando un comportamiento del original es un bug, se
replica tal cual (`[PROBABLE BUG]`).

El port vive en `port/`: core C++20 de headers puros
(`port/core/include/dbcore/`) sin dependencias de render, compilado nativo
(gcc/clang) y a WASM (Emscripten); la presentación es una página web
(`port/web/index.html` + `worker.js`) sobre la API C de
`port/wasm/dbcore_api.cpp`. **El port del core está completo** (M1..M10 +
extensiones Rendimiento y Bestiary cerradas) y ahora se ejecuta el plan de
extensiones de `spec/PLAN-EXTENSIONES.md`: el resto de la superficie
funcional del original (UI/animaciones/opciones/modos), por etapas E1..E8.

**Estado actual** (verificado 2026-08-28):
- Suite: **166 casos / 3370 aserciones en verde** en los tres modos (g++ 14.2,
  clang 19.1.7, WASM/Emscripten 6.0.8 bajo node).
- Milestones M1..M10 cerrados + Ext·Rendimiento (Web Worker) + Ext·Bestiary
  (588 bots del foro como presets). Hashes recientes: E1 `5b83de5`,
  E2 `ad65f01`, E3 `764a03f`, E4 `5adab56` (merge `71c3121`), E5 `f568e6a`
  (core) + `d082f8a` (host) + `ce6d322` (revisión) → merge `771bd41`,
  PROGRESO `08ba14b`. Línea base de fuentes VB6: `02b20d7`.
- **Etapas E1..E5 cerradas.** E1-E3 = capa host (opciones por id, toggles del
  menú View + inspector, menú Objects con los 6 mazes verificados EXACTOS).
  E4 = primer core desde M8 (pasos 6-7 del tick: costes dinámicos). E5 =
  **modos de juego, core + host**: `gamemodes.hpp` nuevo con los pasos ⚙ que
  quedaban dentro del tick — 3 (hidepred/evo), 8-9/22 (handicap/avrnrg), 13
  (Player Bot) y 26 (seeding/ZeroBot/test) — más `F1Mode.bas` completo
  (FindSpecies/Countpop/dreason), `fittest`/`calculateZB`, las ~18 guardas
  `Base.txt And hidepred` (ahora reales, vía `BaseHidden`) y los 13 sitios de
  descalificación del fuente. Las acciones de UI/disco/proceso del original
  (Contest_Form, FileCopy, `restarter`, `logevo`, MsgBox) se sustituyen por
  **eventos** en `Sim.events` que la capa host lee y limpia.
- **Con E5 el tick de `10-CICLO.md §2` está completo** salvo los pasos ⚙ de
  UI/infra pura: 1 (F12), 11 (inspector), 23 (monitor RGB) y 25 (autosave a
  disco) — ninguno afecta la simulación.
- Sitios de error con decisión de port documentada, añadidos en E5:
  `err9_pb_memloc` (Player Bot con memloc fuera de `mem(0..1000)`: registrar y
  no escribir) y `err11_lfor_zero` (división por `LFOR = 0` en el handicap:
  registrar y saltar el bloque; sin la guarda el port propagaba `NaN` al `nrg`
  de todos los `Mutate.txt`).
- CI en GitHub: `ci.yml` (suite en los tres modos + fuentes VB6 intactos) y
  `pages.yml` (demo viva; compila el preset wasm y publica `port/web/`).

**Orden de lectura al arrancar:**
1. `spec/PROGRESO.md` entero — fuente de verdad del estado (incluida la
   corrección de premisa 2026-08-16: el EXE original compila CON chequeos;
   errores 6/9/11 truncan el tick, `10-CICLO.md §14`).
2. `spec/PLAN-EXTENSIONES.md §E6` — el alcance de la etapa.
3. `port/README.md` — toolchain, build y estado por milestone.
4. Los fuentes del original que la etapa toca (ver "La tarea").

**Reglas duras:**
1. Los fuentes VB6 (`Darwinbots2/`) son read-only — verificable con
   `git diff 02b20d7 -- Darwinbots2/` vacío.
2. Para trabajo de **core** (`port/core/`), el ciclo es siempre: caso dorado
   como test en rojo → implementación transcrita del fuente VB6 citado (no de
   memoria, no del wiki) → verde → commit citando la sección de spec, en
   **rama nueva con revisión antes de mergear** (familia de casos nueva en
   `70-CASOS-DORADOS.md`, siguiendo el patrón de E4 §11 / E5 §12). Para
   trabajo de **capa host** (wasm API/JS/HTML), el core no se toca: la suite
   queda intacta por construcción y se verifica igual en verde; la
   verificación de la etapa es smoke test bajo node + prueba en Chrome.
3. Los `[PROBABLE BUG]` se replican tal cual; los sitios de error 6/9/11
   llevan decisión de port documentada + registro en `VmDiag`/`SimDiag`.
4. Salvaguardas numéricas de `PLAN.md`: redondeo bancario centralizado
   (`vb_round64`/`vb_cint`/`vb_clng`), `float` estricto para `Single`, nada de
   `-ffast-math`, `-ffp-contract=off` (sin FMA implícita), `-fwrapv` solo como
   red. Ojo con los literales VB6: los `0.1`-style son `Double` (E4 lo
   ejercitó con `0.0000001`). Ojo también con la vida de los locales: `Dim`
   dentro de un bucle en VB6 inicializa **una vez por invocación** del Sub, no
   por iteración (E5 lo encontró con `clist` en `Master.bas:169`).
5. Al cerrar la etapa: actualizar `spec/PROGRESO.md` (tabla de etapas +
   sección "Siguiente" + registro con fecha), commitear y regenerar este
   prompt con `/prompt-continuacion`.

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
`netstat -ano | grep :8000` y servir en otro puerto (p. ej. 8040, verificando
que quede UN solo PID escuchando), y recargar con Ctrl+Shift+R (el worker.js
se cachea). ⚠️ Al verificar en Chrome: el rAF de una ventana **ocluida** se
estrangula hasta 0 fps y la página deja de hacer `ack`, así que el canvas y
las stats quedan congelados aunque el worker siga simulando — no es un
cuelgue; para comprobar el estado real de la sim con la ventana tapada usá un
mensaje que no viaje por frames (p. ej. `{t:'bot-text', n}`). Los clics por
coordenada pueden desfasarse si el panel se re-renderiza: usar `find`+ref.
Compiladores: g++/clang de MSYS2 ucrt64, node 24.

**La tarea: etapa E6 — registro y análisis (CAPA HOST).**
Según `spec/PLAN-EXTENSIONES.md §E6`. No debería tocar `port/core/`: si algo
pareciera exigirlo, pararse y documentar por qué antes de abrir el core. El
alcance se desglosa con el fuente a la vista (parte del trabajo de la etapa es
decidir qué entra y qué queda fuera, con evidencia de grep):

1. **Gráficas** — el grueso de la etapa. `grafico.frm` (4197 líneas) es el
   form del chart; `main.frm:2174 NewGraph` lo crea y `main.frm:2228 FeedGraph`
   lo alimenta. El loop principal alimenta cada `SimOpts.chartingInterval`
   ciclos y **solo si el chart está visible** (`main.frm:2098-2107`). Las 18
   series están en `Globals.bas:127-151`: `POPULATION_GRAPH` (1),
   `MUTATIONS_GRAPH`, `AVGAGE_GRAPH`, `OFFSPRING_GRAPH`, `ENERGY_GRAPH`,
   `DNALENGTH_GRAPH`, `DNACOND_GRAPH`, `MUT_DNALENGTH_GRAPH`,
   `ENERGY_SPECIES_GRAPH`, `DYNAMICCOSTS_GRAPH`, `SPECIESDIVERSITY_GRAPH`,
   `AVGCHLR_GRAPH`, `GENETIC_DIST_GRAPH`, `GENERATION_DIST_GRAPH`,
   `GENETIC_SIMPLE_GRAPH` y los 3 `CUSTOM_*` (con `strGraphQuery1..3`).
   `graphvisible`/`graphleft`/`graphtop`/`graphfilecounter`/`graphsave` ya los
   persiste el formato de sim y viajan en `Sim.evo` desde M8 (`HDRoutines.bas`
   :800/:1476) — la etapa los conecta. Decidir qué series tienen datos reales
   disponibles hoy por la API y cuáles piden un export nuevo.
2. **Snapshots** — `Database.bas:89 AddRecord`, disparado desde
   `Robots.bas:2972` bajo `SimOpts.DeadRobotSnp` (con `SnpExcludeVegs`). El
   original escribía a una MDB de Access: en el port van como descarga del
   navegador (CSV/JSON, decisión de host a documentar).
3. **Philogeny** (`parentele.frm`), **gene activations** (`ActivForm.frm`),
   **console** (`console.frm`) y **Find Best** del menú Robot — evaluar cuáles
   aportan y cuáles quedan fuera, con la evidencia del grep.
4. Exponer lo nuevo por la capa host (mensajes del worker + UI) donde aplique.

Criterio de cierre E6: suite completa en verde en los tres modos (intacta por
construcción si la etapa es host puro); decisión documentada para cada pieza
que quede fuera; smoke node + verificación en Chrome; `PROGRESO.md`
actualizado (tabla + "Siguiente" + registro) y prompt regenerado.

Después de E6 siguen **E7** (Internet/torneo distribuido: el transporte real
entre navegadores; la E/S por búferes `outbox`/`inbox` ya funciona entre sims)
y **E8** (extras: eye designer, imagen de fondo, monitor RGB, E-Grid).

## ↑ COPIAR HASTA AQUÍ ↑

---

Regenerá este archivo con `/prompt-continuacion` al cerrar cada etapa.
