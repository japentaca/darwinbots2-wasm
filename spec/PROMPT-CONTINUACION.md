# Prompt de continuación — sesión nueva (post-E8, plan de extensiones completo)

Artefacto **regenerable** (no es historia): lo reescribe `/prompt-continuacion` al
cerrar cada etapa. Pegá el bloque de abajo como **primer mensaje** de una sesión
nueva de Claude Code abierta en el directorio del repo
(`C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`). Sesión nueva porque el
prompt es autocontenido: no referencia nada de la conversación anterior, solo
archivos del repo y hashes de commit.

Generado el 2026-09-24, tras cerrar la etapa **E8 · extras** — con ella se
completa el plan de extensiones.

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
extensiones Rendimiento y Bestiary) y **el plan de extensiones de
`spec/PLAN-EXTENSIONES.md` también** (E1..E8 + E6.5, cerrado el 2026-09-24).
Lo que sigue son los pendientes que el plan dejó anotados.

**Estado actual** (verificado 2026-09-24):
- Suite: **178 casos / 3544 aserciones en verde** en los tres modos (g++ 14.2,
  clang 19.1.7, WASM/Emscripten 6.0.8 bajo node).
- Hashes: E4 merge `71c3121`, E5 `771bd41`, E6 `58814f5`, E6.5 `44eda9e`,
  E7 `14e08fd`, **E8**: `5ece04c` → merge `ce82492`. Línea base de fuentes
  VB6: `02b20d7`.
- **E8** (capa host pura): skins (`DrawRobSkin` con su caché `oaim`/`OSkin`
  y `AssignSkin` transcrito — antes todas las especies tenían la skin en 0),
  monitor RGB (el paso 23 del tick como espejo de host que el worker corre
  tras cada tick, `DrawMonitor`, `frmMonitorSet` con presets `.mtrp`), eye
  designer (`frmEYE.frm`) e imagen de fondo; E-Grid (vestigial) y tray icon
  (n/a) fuera con evidencia. Detalle en `PLAN-EXTENSIONES.md §E8`.
- **Contratos de host vigentes**: el frame del worker tiene **cabecera de 13
  floats** (`…, focus, rich, nBirths, nDeaths, cycle, extras`), después los
  bloques de bots/shots/ties/obstáculos/teleporters, foco, vista enriquecida
  y, según `extras` (bit0 monitor nB×3, bit1 skins nB×9), los de E8 al final
  (cabecera de `web/worker.js`). Las selecciones viajan con
  `{t:'select', n, seq}` → `stats.selSeq`. `Sim::fmt` es global de proceso
  (no lo persiste `SaveSimulation`; el worker lo re-fija tras cada
  reset/carga). Los campos de render que el core no modela (monitor, OSkin,
  estado de la vista enriquecida) viven por slot en el `SimHandle` de la
  capa wasm, con AbsNum distinto = slot en blanco.
- El tick de `10-CICLO.md §2` está completo salvo los pasos ⚙ de UI/infra
  1 (F12), 11 (inspector) y 25 (autosave a disco); el 23 (monitor) corre en
  la capa host.
- CI en GitHub: `ci.yml` (suite en los tres modos + fuentes VB6 intactos) y
  `pages.yml` (demo viva).

**Orden de lectura al arrancar:**
1. `spec/PROGRESO.md` entero — fuente de verdad del estado (incluida la
   corrección de premisa 2026-08-16: el EXE original compila CON chequeos;
   errores 6/9/11 truncan el tick, `10-CICLO.md §14`), en especial
   §"Siguiente": el balance del plan y lo abierto.
2. `spec/PLAN-EXTENSIONES.md §E8` — sección "Hallazgos".
3. `port/README.md` — toolchain, build, relay, smokes y estado.
4. Los fuentes del original que toque el pendiente elegido.

**Reglas duras:**
1. Los fuentes VB6 (`Darwinbots2/`) son read-only — verificable con
   `git diff 02b20d7 -- Darwinbots2/` vacío.
2. Para trabajo de **core** (`port/core/`), el ciclo es siempre: caso dorado
   como test en rojo → implementación transcrita del fuente VB6 citado (no de
   memoria, no del wiki) → verde → commit citando la sección de spec, en
   **rama nueva con revisión antes de mergear** (familia de casos nueva en
   `70-CASOS-DORADOS.md`, siguiendo el patrón de §11..§14). Antes de abrir
   el core por un tema de host, **pararse y documentar por qué**. Para
   trabajo de **capa host** (wasm API/JS/HTML), el core no se toca: la suite
   queda intacta por construcción y se verifica igual en verde; la
   verificación es smoke test bajo node + prueba en Chrome. La revisión de
   rama con un agente independiente contra el fuente rindió en todas las
   etapas (E5-E8: 5, 4, 7 y 3 hallazgos reales).
3. Los `[PROBABLE BUG]` se replican tal cual; los sitios de error 6/9/11
   llevan decisión de port documentada + registro en `VmDiag`/`SimDiag`.
4. Salvaguardas numéricas de `PLAN.md`: redondeo bancario centralizado
   (`vb_round64`/`vb_cint`/`vb_clng`), `float` estricto para `Single`, nada de
   `-ffast-math`, `-ffp-contract=off` (sin FMA implícita), `-fwrapv` solo como
   red. Ojo con los literales VB6: los `0.1`-style son `Double`. Un `Dim`
   dentro de un bucle inicializa **una vez por invocación** del Sub. `Dim a,
   b As Long` declara `a` como **Variant**. Los slots que VB6 no reinicia
   conservan sus campos (`NewTeleporter`, E7). `Rnd(n)`: n<0 re-siembra,
   n=0 repite el último, n>0 avanza; `Randomize` solo reemplaza los bytes
   medios del estado (el byte bajo sobrevive). Restas de dos `Integer` dan
   error 6 si salen de ±32767 aunque el resultado vaya a un `Double`.
5. Al cerrar un trabajo: actualizar `spec/PROGRESO.md` (tabla + sección
   "Siguiente" + registro con fecha), commitear y regenerar este prompt con
   `/prompt-continuacion`.

**Build y tests** (desde `port/`; CMake ≥ 3.25):
```
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
node tools/imrelay/smoke_im.mjs      # smoke de Internet Mode (44 checks)
node tools/e8/smoke_e8.mjs           # smoke de E8 (30 checks)
```
El preset `wasm` necesita `EMSDK` en el entorno (en esta máquina:
`EMSDK=C:/Users/jntac/emsdk`; en bash: `export EMSDK=/c/Users/jntac/emsdk &&
source "$EMSDK/emsdk_env.sh"`). Produce también `build-wasm/dbcore.js/.wasm`
(`--target dbcore.js` la compila sola). La página se sirve con
`cd port && node tools/imrelay/relay.mjs` → `http://localhost:8060/web/`.
⚠️ Pueden quedar servidores de sesiones anteriores vivos en el puerto:
verificar con `netstat -ano | grep :8060` y que quede UN solo PID. **Caché
del worker**: antes de probar, desde la página: `for (const f of
['index.html','worker.js','imnet.js','../build-wasm/dbcore.js',
'../build-wasm/dbcore.wasm']) await fetch(f,{cache:'reload'})` y recargar.
⚠️ Chrome con la ventana **ocluida o en segundo plano** (`document.hidden`):
el rAF no dispara y los timers se estrangulan a extremos (un `await` de
`setTimeout` dentro de `javascript_tool` puede colgar la llamada 45 s).
Funciona: llamadas cortas sin esperas, `worker.postMessage({t:'redraw'})`
en una llamada y `if (latest) renderFrame()` en la siguiente; leer píxeles
con `getImageData` en vez de fiarse de la captura (puede mostrar un frame
viejo); contar llamadas de dibujo envolviendo `ctx.strokeRect` etc. Si hace
falta ver la sim correr, pedirle al usuario que traiga la ventana al frente.
⚠️ En este Bash los heredocs con ciertas comillas fallan ("unexpected EOF")
y Python dentro de heredoc puede romper los escapes: para scripts no
triviales, escribirlos con Write en el scratchpad y ejecutarlos con node.
Compiladores: g++/clang de MSYS2 ucrt64, node 24.

**La tarea: después del plan — pendientes anotados.** No hay etapa en
curso. Arrancá leyendo lo de arriba y **preguntale al usuario cuál tomar**
(el 1 es decisión suya). Los pendientes (§"Siguiente" de `PROGRESO.md`):

1. **El `Redraw` del original escribe en la sim** (`main.frm:422-469`):
   antes de dibujar corre cada bot `pos -= vel − actvel` y al final lo
   devuelve; en `Single`, `(x − d) + d` no siempre vuelve (~0,35 % de las
   coordenadas por frame, 1 ulp), así que con el video encendido la
   trayectoria depende de que se dibuje, y si el Redraw aborta (error 6 de
   `DrawMonitor` con rango `ceil − floor` > 32767, o de un `OSkin`) los bots
   quedan corridos. Hoy el port es el original con el video apagado
   (`visualize = False`). Opciones a plantear: dejarlo documentado, o una
   opción de host "video del original" que aplique el ida-y-vuelta tras cada
   tick (O(n), sin core; pero modifica la sim desde el host — decisión).
2. **Desborde de pila al sembrar en un campo chico**: 15 algas (preset de
   la página) en 4000×3000 dan `Maximum call stack size exceeded` en wasm
   (8000×6000 no). Anterior a E8. Reproducir en nativo (gdb o un test) para
   ubicar la recursión (probablemente la colocación/respawn), decidir si es
   un `[PROBABLE BUG]` del original (error 28 "Out of stack space") o del
   port, y corregir o documentar con caso.
3. **La ronda nueva no regenera las formas** desde `xObstacle`
   (`main.frm:1353`, límite heredado de E5; los teleporters sí pasan desde
   E7).
4. Lo que queda fuera por decisión (balance del plan en `PROGRESO.md`): la
   carrera evo de `Evo.bas` y eco-IM, la liga por disco
   (`MDIForm1.frm:2536-2790`), `SafeModeBackup.exe`, los pasos ⚙ 1/11/25.
   Solo si el usuario lo pide.

Criterio de cierre de cada pendiente: suite completa en verde en los tres
modos; decisión documentada (en `PROGRESO.md` y, si toca el core, familia de
casos nueva con revisión de rama); smoke node de lo nuevo + verificación en
Chrome con consola limpia; prompt regenerado.

## ↑ COPIAR HASTA AQUÍ ↑

---

Regenerá este archivo con `/prompt-continuacion` al cerrar cada etapa.
