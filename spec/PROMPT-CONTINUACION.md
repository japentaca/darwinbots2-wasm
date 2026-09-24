# Prompt de continuación — sesión nueva (post-E7)

Artefacto **regenerable** (no es historia): lo reescribe `/prompt-continuacion` al
cerrar cada etapa. Pegá el bloque de abajo como **primer mensaje** de una sesión
nueva de Claude Code abierta en el directorio del repo
(`C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`). Sesión nueva porque el
prompt es autocontenido: no referencia nada de la conversación anterior, solo
archivos del repo y hashes de commit.

Generado el 2026-09-24, tras cerrar la etapa **E7 · Internet / torneo distribuido**.

## ↓ COPIAR DESDE AQUÍ ↓

Continuá el desarrollo del port C++/WASM de DarwinBots 2.48.32.

**Contexto.** El original es un simulador de vida artificial en VB6
(`Darwinbots2/`, 53 327 LOC, read-only). La especificación extraída vive en
`spec/` y está **completa y cerrada**: es el contrato del port, con
`spec/70-CASOS-DORADOS.md` como suite de verdad (178 casos; familias de
extensión E4-* en §11, E5-* en §12, E6-* en §13 y E7-* en §14) y la regla de
oro "el fuente es la spec" para desambiguar (el wiki no entra). Cuando un
comportamiento del original es un bug, se replica tal cual (`[PROBABLE BUG]`).

El port vive en `port/`: core C++20 de headers puros
(`port/core/include/dbcore/`) sin dependencias de render, compilado nativo
(gcc/clang) y a WASM (Emscripten); la presentación es una página web
(`port/web/index.html` + `worker.js` + `imnet.js`) sobre la API C de
`port/wasm/dbcore_api.cpp`. **El port del core está completo** (M1..M10 +
extensiones Rendimiento y Bestiary) y se ejecuta el plan de extensiones de
`spec/PLAN-EXTENSIONES.md`: el resto de la superficie funcional del original
por etapas E1..E8 (más la E6.5, que no es superficie del original). **Solo
queda E8.**

**Estado actual** (verificado 2026-09-24):
- Suite: **178 casos / 3544 aserciones en verde** en los tres modos (g++ 14.2,
  clang 19.1.7, WASM/Emscripten 6.0.8 bajo node).
- Hashes recientes: E4 merge `71c3121`, E5 merge `771bd41`, E6 merge
  `58814f5`, lint del ADN `3fb85d9`, E6.5 merge `44eda9e`, **E7**: core
  `3033c0c` (`Sim::fmt`) + `86cc945` (`RemoveExtinctSpecies`) + host
  `831877d` + revisión `eda1dc4` (core, E7-06) / `b2abb64` (host) → merge
  `14e08fd`. Línea base de fuentes VB6: `02b20d7`.
- **Etapas E1..E7 y E6.5 cerradas** (detalle por etapa en la tabla de
  `PROGRESO.md`). E7 = Internet Mode: el original delegaba la red en
  `DarwinbotsIM.exe`; el port conserva la forma — el core llena/vacía los
  buzones del teleporter Internet y un cliente IM en el worker
  (`web/imnet.js`) los mueve por `BroadcastChannel` (pestañas) o por un relay
  WebSocket propio (`port/tools/imrelay/relay.mjs`, que además sirve
  `port/` estático). E7 abrió el core en tres puntos con casos: los globales
  de proceso en el tick (`Sim::fmt` / `TickFormatGlobals`), la poda
  `RemoveExtinctSpecies` y el `AddSpecie` completo con el slot de reserva
  `Specie(76)`.
- **El tick de `10-CICLO.md §2` está completo** salvo los pasos ⚙ de UI/infra:
  1 (F12), 11 (inspector), 23 (monitor RGB — ver la tarea) y 25 (autosave a
  disco).
- **Contratos de host vigentes**: el frame del worker tiene **cabecera de 12
  floats** (`…, focus, rich, nBirths, nDeaths, cycle`) más el bloque de la
  vista enriquecida (cabecera de `web/worker.js`); las selecciones viajan con
  `{t:'select', n, seq}` → `stats.selSeq`. `Sim::fmt` (apodo, sunbelt,
  SaveWithoutMutations) es global de **proceso**: no lo persiste
  `SaveSimulation` y el worker lo vuelve a fijar tras cada reset/carga
  (`imRebind`). Transiciones de Internet Mode (del fuente): sim nueva lo
  apaga, ronda nueva lo conserva y copia los teleporters al handle nuevo sin
  RNG (`db_sim_tp_copy`), cargar lo deja sin puerto. Mensajes nuevos:
  `{t:'im'…}`/`{t:'im-name'}` → `{t:'im-state'}`/`{t:'im-log'}`/`{t:'im-off'}`,
  siempre en tandas por timer.
- CI en GitHub: `ci.yml` (suite en los tres modos + fuentes VB6 intactos) y
  `pages.yml` (demo viva; compila el preset wasm y publica `port/web/`).

**Orden de lectura al arrancar:**
1. `spec/PROGRESO.md` entero — fuente de verdad del estado (incluida la
   corrección de premisa 2026-08-16: el EXE original compila CON chequeos;
   errores 6/9/11 truncan el tick, `10-CICLO.md §14`).
2. `spec/PLAN-EXTENSIONES.md §E8` — el alcance (y §E7 "Resultado" para el
   patrón de etapa host con parada documentada antes de abrir el core).
3. `spec/10-CICLO.md §2` (paso 23, monitor RGB) y `spec/50-MUNDO.md §4` (el
   E-Grid ya marcado vestigial).
4. `port/README.md` — toolchain, build, relay y estado.
5. Los fuentes del original que la etapa toca (ver "La tarea").

**Reglas duras:**
1. Los fuentes VB6 (`Darwinbots2/`) son read-only — verificable con
   `git diff 02b20d7 -- Darwinbots2/` vacío.
2. Para trabajo de **core** (`port/core/`), el ciclo es siempre: caso dorado
   como test en rojo → implementación transcrita del fuente VB6 citado (no de
   memoria, no del wiki) → verde → commit citando la sección de spec, en
   **rama nueva con revisión antes de mergear** (familia de casos nueva en
   `70-CASOS-DORADOS.md`, siguiendo el patrón de §11..§14). Antes de abrir
   el core en una etapa host, **pararse y documentar por qué** en
   `PLAN-EXTENSIONES.md` (como E6 y E7). Para trabajo de **capa host** (wasm
   API/JS/HTML), el core no se toca: la suite queda intacta por construcción
   y se verifica igual en verde; la verificación de la etapa es smoke test
   bajo node + prueba en Chrome. La revisión de rama rindió mucho en E5-E7
   (5, 4 y 7 hallazgos reales): hacerla con un agente independiente contra
   el fuente.
3. Los `[PROBABLE BUG]` se replican tal cual; los sitios de error 6/9/11
   llevan decisión de port documentada + registro en `VmDiag`/`SimDiag`.
4. Salvaguardas numéricas de `PLAN.md`: redondeo bancario centralizado
   (`vb_round64`/`vb_cint`/`vb_clng`), `float` estricto para `Single`, nada de
   `-ffast-math`, `-ffp-contract=off` (sin FMA implícita), `-fwrapv` solo como
   red. Ojo con los literales VB6: los `0.1`-style son `Double`. Un `Dim`
   dentro de un bucle inicializa **una vez por invocación** del Sub. `Dim a,
   b As Long` declara `a` como **Variant**. Y ojo con los slots que VB6 **no
   reinicia**: `NewTeleporter` asigna solo sus campos y `DeleteTeleporter`
   solo baja `.exist` — lo demás del slot sobrevive (E7).
5. Al cerrar la etapa: actualizar `spec/PROGRESO.md` (tabla de etapas +
   sección "Siguiente" + registro con fecha), commitear y regenerar este
   prompt con `/prompt-continuacion`.

**Build y tests** (desde `port/`; CMake ≥ 3.25):
```
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
node tools/imrelay/smoke_im.mjs      # smoke de Internet Mode (44 checks)
```
El preset `wasm` necesita `EMSDK` en el entorno (en esta máquina:
`EMSDK=C:/Users/jntac/emsdk`; en bash: `export EMSDK=/c/Users/jntac/emsdk &&
source "$EMSDK/emsdk_env.sh"`). Produce también `build-wasm/dbcore.js/.wasm`
(la biblioteca de la página; `--target dbcore.js` la compila sola). La página
se sirve con `cd port && node tools/imrelay/relay.mjs` →
`http://localhost:8060/web/` (o `python -m http.server 8000`).
⚠️ Pueden quedar servidores de sesiones anteriores vivos en el puerto:
verificar con `netstat -ano | grep :8060` y que quede UN solo PID. **Caché
del worker**: el `?v=N` solo evita la caché de la página; en E7 volvió a
morder (el worker corría una versión vieja sin avisar). Antes de probar,
desde la página: `for (const f of ['worker.js','imnet.js',
'../build-wasm/dbcore.js','../build-wasm/dbcore.wasm']) await fetch(f,
{cache:'reload'})` y recargar.
⚠️ Chrome con la ventana **ocluida o en segundo plano**: el rAF no dispara
(canvas y stats congelados aunque el worker siga) y los timers se
estrangulan. Funciona: velocidad "máx", `renderFrame()` a mano cuando hay
`latest`, y esperar mensajes con un listener sobre `worker` (los mensajes no
se estrangulan). Para comparar píxeles, SHA-256 de `getImageData`. Clics:
`find`+ref mejor que coordenadas.
⚠️ Lecciones del worker/render: **nada que la página tenga que dibujar puede
publicarse a ritmo de tick** (se acumula en el wasm o se tanda por timer); en
Canvas 2D un path con miles de subpaths escala peor que lineal (pintar en
tandas de 64). En este Bash los heredocs con ciertas comillas fallan
("unexpected EOF") y Python dentro de heredoc puede convertir `\\n` en saltos
reales: para scripts largos, escribirlos con Write en el scratchpad y
ejecutarlos. Compiladores: g++/clang de MSYS2 ucrt64, node 24.

**La tarea: etapa E8 — extras de menor valor (última del plan).**
Según `spec/PLAN-EXTENSIONES.md §E8`. Es mayormente capa host; parte del
trabajo es decidir con evidencia de grep qué entra y qué queda fuera, y
documentarlo. Rama nueva (`e8-extras`). Piezas:

1. **Eye designer** (`frmEYE.frm`, 373 líneas; menú `showEyeDesign_Click`,
   `MDIForm1.frm:1635`, deshabilitado con F1 o `y_eco_im = 2`, `:1714`):
   leer qué escribe (¿`.eye*dir`/`.eye*width` de un bot? ¿genera ADN?) y
   exponerlo como ventana flotante (patrón de las de E6) sobre la API
   existente (`db_sim_bot_mem`/`set_mem`, `db_sim_dump_focus`).
2. **Monitor RGB** (`MonitorOn_Click`/`MonitorSettings_Click`,
   `MDIForm1.frm:1521-1530`; `frmMonitorSet.frm`, 426 líneas; dibujo
   `DrawMonitor`, `main.frm:548`; **paso 23 del tick**, `Master.bas:417-427`,
   copia 3 posiciones de `mem` a `rob(t).monitor_r/g/b` — campos del `Type
   robot` que el port NO tiene). Decidir con el fuente si basta leer `mem`
   desde el host al volcar (¿algún paso posterior al 23 toca esas celdas?) o
   si hace falta el campo de observación en el core (patrón E6 `ga()`:
   parada documentada, caso dorado, rama con revisión). E2 lo había omitido
   "por valor menor" junto con las skins (`DrawRobSkin`, `main.frm:838`):
   evaluar las skins en la misma pasada.
3. **Imagen de fondo** (`loadpiccy_Click`, `MDIForm1.frm:1433`;
   `removepiccy_Click`, `:1558`): carga de archivo local en la página
   (nada del core); ver cómo el original la escala/dibuja.
4. **E-Grid** (`SimOptions.bas:182-183`, persistido en `HDRoutines.bas:774-775`
   y `:1438-1441`, menú `MDIForm1.frm:803-813`): `50-MUNDO.md §4` ya lo marca
   vestigial (`InitEGrid` comentado, `main.frm:1503-1504`). Confirmar con
   grep que nada lo consume y documentar la decisión (el formato de sim ya lo
   persiste desde M8).
5. **Tray icon** (`TrayIcon.cls`, `stealthmode`, `MDIForm1.frm:1696`/`:1826`):
   n/a en web — documentar.

Pendientes que E7 dejó anotados (evaluar si entran, o dejarlos documentados
para después del plan): la ronda nueva del port no regenera las formas desde
`xObstacle` como el original (`main.frm:1353`, límite heredado de E5), y la
orquestación de liga (`MDIForm1.frm:2536-2790`, orquestación local por disco)
sigue fuera.

Criterio de cierre E8: suite completa en verde en los tres modos; decisión
documentada para cada pieza (entra / fuera con evidencia); smoke node de lo
nuevo + verificación en Chrome con consola limpia; `PROGRESO.md` actualizado
(tabla + "Siguiente" — con E8 se cierra el plan de extensiones: dejar
anotado el balance de lo que queda fuera — + registro) y prompt regenerado.

## ↑ COPIAR HASTA AQUÍ ↑

---

Regenerá este archivo con `/prompt-continuacion` al cerrar cada etapa.
