# Prompt de continuación — sesión nueva (post-E6.5)

Artefacto **regenerable** (no es historia): lo reescribe `/prompt-continuacion` al
cerrar cada etapa. Pegá el bloque de abajo como **primer mensaje** de una sesión
nueva de Claude Code abierta en el directorio del repo
(`C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`). Sesión nueva porque el
prompt es autocontenido: no referencia nada de la conversación anterior, solo
archivos del repo y hashes de commit.

Generado el 2026-09-24, tras cerrar la etapa **E6.5 · Vista enriquecida**.

## ↓ COPIAR DESDE AQUÍ ↓

Continuá el desarrollo del port C++/WASM de DarwinBots 2.48.32.

**Contexto.** El original es un simulador de vida artificial en VB6
(`Darwinbots2/`, 53 327 LOC, read-only). La especificación extraída vive en
`spec/` y está **completa y cerrada**: es el contrato del port, con
`spec/70-CASOS-DORADOS.md` como suite de verdad (172 casos, familias E4-* en
§11, E5-* en §12 y E6-* en §13) y la regla de oro "el fuente es la spec" para
desambiguar (el wiki no entra). Cuando un comportamiento del original es un
bug, se replica tal cual (`[PROBABLE BUG]`).

El port vive en `port/`: core C++20 de headers puros
(`port/core/include/dbcore/`) sin dependencias de render, compilado nativo
(gcc/clang) y a WASM (Emscripten); la presentación es una página web
(`port/web/index.html` + `worker.js`) sobre la API C de
`port/wasm/dbcore_api.cpp`. **El port del core está completo** (M1..M10 +
extensiones Rendimiento y Bestiary cerradas) y ahora se ejecuta el plan de
extensiones de `spec/PLAN-EXTENSIONES.md`: el resto de la superficie
funcional del original (UI/animaciones/opciones/modos), por etapas E1..E8
(más la E6.5, añadida a pedido del usuario y que no es superficie del
original).

**Estado actual** (verificado 2026-09-24):
- Suite: **172 casos / 3465 aserciones en verde** en los tres modos (g++ 14.2,
  clang 19.1.7, WASM/Emscripten 6.0.8 bajo node).
- Milestones M1..M10 cerrados + Ext·Rendimiento (Web Worker) + Ext·Bestiary
  (588 bots del foro como presets). Hashes recientes: E1 `5b83de5`,
  E2 `ad65f01`, E3 `764a03f`, E4 `5adab56` (merge `71c3121`), E5 `f568e6a` +
  `d082f8a` + `ce6d322` (merge `771bd41`), E6 `3994f67` (core) + `88a72f5`
  (host) + `47231db` (revisión) → merge `58814f5`, lint del ADN al sembrar
  `3fb85d9`, E6.5 plan `1b9a0fa` + `ff30782` (host) → merge `44eda9e`,
  PROGRESO `7f5ba5b`. Línea base de fuentes VB6: `02b20d7`.
- **Etapas E1..E6 y E6.5 cerradas.** E1-E3 = capa host (opciones por id,
  toggles del menú View + inspector, menú Objects con los 6 mazes verificados
  EXACTOS). E4 = primer core desde M8 (pasos 6-7 del tick: costes
  dinámicos). E5 = modos de juego, core + host (`gamemodes.hpp`). E6 =
  registro y análisis, core + host (`database.hpp` + los campos de
  observación `ga()`/`consoleOpen`/`dbgstring`; `CalcStats`/`FeedGraph` en la
  capa wasm; charts, consola, activaciones, snapshots, Find Best,
  philogeny). **E6.5 = vista enriquecida, capa host pura**: selector "Vista"
  (la original queda idéntica píxel a píxel; la enriquecida muestra forma,
  tono, brillo por nrg, anillo de acción, morfología con zoom, nacimientos y
  muertes, 8 lentes "Color por" y cámara con zoom/paneo/seguir, rastro y
  tooltip). Extra fuera de etapa: **lint del ADN al sembrar**
  (`db_dna_lint`, avisa los tokens que el cargador convierte en 0 sin
  decir nada).
- **Con E5 el tick de `10-CICLO.md §2` está completo** salvo los pasos ⚙ de
  UI/infra pura: 1 (F12), 11 (inspector), 23 (monitor RGB) y 25 (autosave a
  disco) — ninguno afecta la simulación.
- **Contratos de host que E6.5 dejó y que E7 debe respetar**: el frame del
  worker tiene **cabecera de 12 floats** (`…, focus, rich, nBirths, nDeaths,
  cycle`) y, con la vista enriquecida, un bloque extra al final (ver la
  cabecera de `web/worker.js`); cada selección de la página viaja con un
  número (`{t:'select', n, seq}`) que vuelve en `stats.selSeq`, y solo un
  frame que ya conoce la selección vigente puede deseleccionar. La API
  `db_sim_vis_*` es de solo lectura y guarda/restaura
  `SimDiag::err9_simplematch` alrededor de `DoGeneticDistance`. Si E7
  cambia slots o el handle (llegada de organismos, carga), la vista se
  reprima con `db_sim_vis_reset` (ya lo hacen reset/carga/siembra en el
  worker) y la lente de distancia avisa con `{t:'gendist-off'}`.
- CI en GitHub: `ci.yml` (suite en los tres modos + fuentes VB6 intactos) y
  `pages.yml` (demo viva; compila el preset wasm y publica `port/web/`).

**Orden de lectura al arrancar:**
1. `spec/PROGRESO.md` entero — fuente de verdad del estado (incluida la
   corrección de premisa 2026-08-16: el EXE original compila CON chequeos;
   errores 6/9/11 truncan el tick, `10-CICLO.md §14`).
2. `spec/PLAN-EXTENSIONES.md §E7` — el alcance de la etapa (y §E6.5 para el
   contrato de frame vigente).
3. `spec/50-MUNDO.md §5` — la capa ⚙ de Internet/torneo deslindada en B7, y
   `spec/60-FORMATOS.md` para el registro `.dbo` que viaja.
4. `port/README.md` — toolchain, build y estado por milestone.
5. Los fuentes del original que la etapa toca (ver "La tarea").

**Reglas duras:**
1. Los fuentes VB6 (`Darwinbots2/`) son read-only — verificable con
   `git diff 02b20d7 -- Darwinbots2/` vacío.
2. Para trabajo de **core** (`port/core/`), el ciclo es siempre: caso dorado
   como test en rojo → implementación transcrita del fuente VB6 citado (no de
   memoria, no del wiki) → verde → commit citando la sección de spec, en
   **rama nueva con revisión antes de mergear** (familia de casos nueva en
   `70-CASOS-DORADOS.md`, siguiendo el patrón de E4 §11 / E5 §12 / E6 §13).
   Para trabajo de **capa host** (wasm API/JS/HTML), el core no se toca: la
   suite queda intacta por construcción y se verifica igual en verde; la
   verificación de la etapa es smoke test bajo node + prueba en Chrome.
3. Los `[PROBABLE BUG]` se replican tal cual; los sitios de error 6/9/11
   llevan decisión de port documentada + registro en `VmDiag`/`SimDiag`.
4. Salvaguardas numéricas de `PLAN.md`: redondeo bancario centralizado
   (`vb_round64`/`vb_cint`/`vb_clng`), `float` estricto para `Single`, nada de
   `-ffast-math`, `-ffp-contract=off` (sin FMA implícita), `-fwrapv` solo como
   red. Ojo con los literales VB6: los `0.1`-style son `Double` (E4 lo
   ejercitó con `0.0000001`). Ojo con la vida de los locales: un `Dim` dentro
   de un bucle en VB6 inicializa **una vez por invocación** del Sub, no por
   iteración (E5 lo encontró con `clist` en `Master.bas:169`). Y ojo con
   `Dim a, b As Long`: en VB6 eso declara `a` como **Variant** y solo `b` como
   Long (E6 lo encontró en `main.frm:2387` — el port truncaba un Single).
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
(la biblioteca de la página; `--target dbcore.js` la compila sola). La página
se sirve con `cd port && python -m http.server 8000` →
`http://localhost:8000/web/`.
⚠️ Ojo: pueden quedar `http.server` de sesiones anteriores vivos en el 8000
sirviendo la página vieja — si la demo no refleja los cambios, verificar con
`netstat -ano | grep :8000` y servir en otro puerto (p. ej. 8050, verificando
que quede UN solo PID escuchando). El `?v=N` en la URL solo evita la caché de
la página, **no la del `worker.js`**: forzarla con
`await fetch('worker.js', {cache:'reload'})` antes de recargar.
⚠️ Al verificar en Chrome con la ventana **ocluida o en segundo plano**: el
rAF no dispara (la página no hace `ack` y el canvas y las stats quedan
congelados aunque el worker siga) y **los timers se estrangulan** (hasta 1
por segundo o menos), así que un guion con `setTimeout` puede tardar minutos
o exceder los 45 s del evaluador. Lo que funciona: velocidad "máx" (el
worker corre solo), llamar `renderFrame()` a mano cuando hay `latest`, y
guiones que esperan el siguiente frame con una promesa colgada de
`worker.onmessage` (los mensajes no se estrangulan), lanzados sin `await` y
consultados después. Para comparar píxeles, SHA-256 de `getImageData`. Los
clics por coordenada pueden desfasarse si el panel se re-renderiza: usar
`find`+ref.
⚠️ Lecciones del worker/render: **nada que la página tenga que dibujar puede
publicarse a ritmo de tick** (E6: sin coalescer el pintado en el rAF la cola
de mensajes crece sin freno — medido 1 tick/s); lo que se observa por tick se
acumula en el wasm y viaja una vez por frame (E6.5). Y en Canvas 2D **un
path con miles de subpaths escala peor que lineal** (E6.5: 1943 círculos en
un path = 18 ms, en tandas de 64 = 4 ms). Cualquier canal nuevo de E7
necesita el mismo cuidado. En este Bash los heredocs con ciertas comillas
fallan ("unexpected EOF"): para scripts largos, escribirlos con Write en el
scratchpad y ejecutarlos. Compiladores: g++/clang de MSYS2 ucrt64, node 24.

**La tarea: etapa E7 — Internet / torneo distribuido (CAPA HOST, transporte).**
Según `spec/PLAN-EXTENSIONES.md §E7`. No debería tocar `port/core/`: la
mecánica de teleporters ya está portada entera desde M8 y opera sobre búferes
en memoria (`Teleport.bas` en `robots.hpp`; `50-MUNDO.md §5` deslinda la capa
⚙). Si algo pareciera exigir el core, pararse y documentar por qué antes de
abrirlo. El alcance se desglosa con el fuente a la vista (parte del trabajo de
la etapa es decidir qué entra y qué queda fuera, con evidencia de grep):

1. **El transporte** — el grueso de la etapa. Hoy el ciclo completo funciona
   entre dos sims dentro del mismo proceso: `CheckTeleporters` (P0a) serializa
   el organismo al `outbox` y lo mata, y `TeleportInBots` (paso 18) sondea el
   `inbox` con su gate de 45 especies; la API expone
   `db_sim_tp_outbox_count` / `db_sim_tp_outbox_take` / `db_sim_tp_inbox_push`
   y el smoke test de M10 ya lo verifica. Falta mover esos registros `.dbo`
   **entre navegadores**. Diseño abierto: servidor de relay simple
   (WebSocket + un `node`/`python` mínimo en `port/tools/`) o WebRTC con
   señalización. Decidir con el fuente del original a la vista
   (`NetEvent.frm`, `provvisorio.bas`, `Module1.bas`) y documentar la decisión
   como las de M10, en la cabecera del archivo que la implemente.
   Restricción heredada: `B7-2` (el puerto Internet solo expulsa con
   `PollCountDown <= 0`) ya está en el core y no se toca.
2. **Estadísticas de IM** — `main.frm:3134 writeIMdata` arma un JSON con
   `strSimStart`, ciclo, campo y población por especie, y el loop lo llama
   cada 200 ciclos si `InternetMode.Visible` (`main.frm:2108-2110`).
3. **`InternetSpecies`** (`provvisorio.bas:19-21`, hasta 500 especies
   remotas): el `SetValues` de `grafico.frm:3735-3742` ya las contempla como
   serie de chart, y la capa host de E6 documenta que hoy cae en color al
   azar por no existir esa lista. Conectarlas cierra ese hueco.
4. **Modo eco-IM** (`y_eco_im`): el `[PROBABLE BUG] B8-3` (el tag se contamina
   con el nrg antes de persistir) ya está en `formats.hpp`; evaluar qué más
   del modo aporta.
5. **La orquestación de liga** (`MDIForm1.frm:2536-2790`, `populateladder`,
   los `FileCopy` de los case 10/2/3/1) que E5 dejó fuera con decisión
   documentada, si tiene sentido sobre el transporte nuevo.
6. Exponer lo nuevo por la capa host (mensajes del worker + UI) donde aplique.
   En la vista enriquecida, un organismo que **sale** por un teleporter
   Out/Internet ya se dibuja como salida (anillo cian); uno que **llega**
   aparece como bot nuevo (sin línea a la madre si la madre no está en esta
   sim) — revisar que se lea bien con el transporte real.

Criterio de cierre E7: suite completa en verde en los tres modos (intacta por
construcción si la etapa es host puro); decisión documentada para cada pieza
que quede fuera; smoke node + verificación en Chrome (idealmente con dos
pestañas intercambiando un organismo real); `PROGRESO.md` actualizado (tabla
+ "Siguiente" + registro) y prompt regenerado.

Después de E7 sigue **E8** (extras de menor valor: eye designer
`frmEYE.frm`, imagen de fondo, settings del monitor RGB, E-Grid
`EGridEnabled/Width` — verificar primero si el original lo consume de
verdad —, tray icon n/a en web).

## ↑ COPIAR HASTA AQUÍ ↑

---

Regenerá este archivo con `/prompt-continuacion` al cerrar cada etapa.
