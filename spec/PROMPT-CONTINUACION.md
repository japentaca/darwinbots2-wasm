# Prompt de continuación del port C++/WASM

Prompt de arranque autocontenido para continuar el desarrollo en una **sesión
nueva** de Claude Code. Pegalo como primer mensaje, con el directorio de trabajo
en la raíz del repo (`Darwinbots2-master/`). Se regenera con
`/prompt-continuacion` al cerrar cada milestone o extensión; este refleja el
estado **post-extensión Rendimiento** (2026-08-26): el port está completo, la
capa web corre la sim en un Web Worker, y solo quedan extensiones opcionales.

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de DarwinBots 2.48.32 (Visual Basic 6).

El proyecto: reimplementar el simulador desde cero — core en C++ compilado a WASM vía
Emscripten, render 2D en web (decisión y salvaguardas de build en spec/PLAN.md).
La especificación en spec/ está completa (Fase 0 + Bloques A, B y C cerrados) y es
el contrato del port; spec/70-CASOS-DORADOS.md es la suite de verdad. Cuando haya que
desambiguar algo, el fuente VB6 es la spec y los documentos de spec/ son su índice.

El port vive en port/ y **está completo y usable**: los 10 milestones están
cerrados (core entero verificado en WASM, ningún stub abierto, Q07 verificada,
capa de presentación web corriendo sobre él) y además la extensión opcional
**Rendimiento** está cerrada: la sim corre en un Web Worker.

- M1 · Sustrato numérico (9182e8e): redondeo bancario, LCG de VB6, gasdev,
stacks, mod32000, handlers de la VM. Casos §1, §2, R-01..R-03.
- M2 · VM y cargador (54d586e): ExecuteDNA completo y cargador de texto.
Casos §3 (V-01..V-14).
- M3 · Memoria y ciclo (39fd715): tabla de sysvars, esqueleto del tick,
sentidos/ties/shots/Reproduce/corpses. Casos §4 (M-01..M-12).
- M4 · Física y visión (487c406): Physics.bas, buckets, visión completa,
swept-sphere de shots. Casos §5 (F-01..F-15) y R-05..R-07.
- M5 · Formatos ida-y-vuelta (2bc58f8): bot de texto (gen epigenético,
Hash ByRef) y registro binario de bot. Casos §7 (FM-01..FM-07).
- M6 · Catálogo de bugs (fe740a8..0121bd4): B-01..B-28 + B-30 como
aserciones; visión de formas, alimentación de shots, virus B3b, MakeStuff.
- M7 · Mutaciones y reproducción sexual (de80e6c): NeoMutations.bas
completo, crossover/SexReproduce, herencia de Reproduce. B-29, B-31..B-35,
R-09..R-11.
- M8 · Mundo + formatos de sim (0037d27..c4fb772): economía vegetal,
teleporters (E/S sobre búferes outbox/inbox en memoria), obstacles,
.dbo, SaveSimulation/LoadSimulation, .mrate, y R-12 (orden global
de RNG del tick). El ciclo UpdateSim corre de punta a punta.
- M9 · Build WASM, Q07 verificada (ef9b63d): la suite entera da verde
idéntico en tres modos — g++ 14.2 nativo, clang 19.1.7 nativo y WASM vía
Emscripten 6.0.8 bajo node — sin una sola divergencia numérica. Presets
reproducibles en port/CMakePresets.json (native-gcc/native-clang/wasm).
- M10 · Capa de presentación web (6e753ec): port/wasm/dbcore_api.cpp con
la API completa hacia JS — arranque del form transcrito de main.frm,
opciones esenciales (campo, Costs 0..70, MinVegs/repoblación, mutaciones
on/off, StartChlr), especies con la siembra de loadrobs completa,
volcados para render (bots 8f / shots 6f / ties 5f / obstáculos 5f /
teleporters 7f), save/load de sim y .dbo sobre búferes, SalvarobText,
NewTeleporter transcrito y la E/S outbox/inbox de teleporters (el host
mueve los "archivos" .dbo entre sims). Decisiones de capa host en la
cabecera del .cpp: búferes en vez de disco, SimGUID = 0, colores de
especie del lado de la página (Q01); .mrate no se exporta.
- Ext · Rendimiento (e935f78): la sim corre entera en un Web Worker
(port/web/worker.js: dbcore.wasm + handle + ticks + volcados);
port/web/index.html queda solo con UI y render Canvas 2D. Cada frame
viaja como UN ArrayBuffer transferible (header + secciones bots/shots/
ties/obstáculos/teleporters) con ping-pong de búferes: cero basura por
frame, nunca más de un frame en vuelo. Velocidad "máx" (rebanadas ~12ms
a fondo, 1 tick por vuelta); stats con ticks/s, fps y costo de draw();
worker.onerror al registro de la página. WebGL medido y descartado por
innecesario: con ~2000 bots, draw() ≈ 4 ms vs tick del core ≈ 160 ms —
el cuello es la sim, no el render (port/README.md §"Página web").
Protocolo de mensajes documentado en la cabecera de worker.js. Cero
cambios en port/core/, port/wasm/ y CMake.
- Estado verificado: 143 casos / 2962 aserciones en verde en los tres
modos de build (nativo gcc re-corrido en esta máquina al regenerar este
prompt).
- Toolchain (todo instalado y documentado en port/README.md): g++ 14.2 y
clang 19.1.7 (MSYS2 ucrt64), CMake 4.0.1 + Ninja, emsdk en ~/emsdk
(Emscripten 6.0.8; el preset wasm necesita la variable de entorno
EMSDK=C:/Users/<usuario>/emsdk), node 24.
- Línea base de los fuentes VB6: 02b20d7.

Antes de nada, leé en este orden

1. spec/PROGRESO.md — estado autoritativo, tabla de milestones y registro.
Incluye la corrección de premisa del 2026-08-16 (el EXE compila CON
chequeos; los flags =0 del .vbp son casillas sin marcar): invalida
cualquier intuición de "wrap silencioso". Su sección "Siguiente" lista
las extensiones opcionales.
2. port/README.md — los tres modos de build, el toolchain verificado, la
API completa de wasm/dbcore_api.cpp, la arquitectura Worker de la página
web y cómo servirla/abrirla.
3. spec/PLAN.md §"Decisión de arquitectura del port" — las 5 salvaguardas de
build (obligatorias también para todo lo que se recompile a WASM).
4. Los documentos de spec/ que toque la extensión elegida (p. ej.
50-MUNDO.md §5 para la capa torneo/Internet, 60-FORMATOS.md para
formatos, 10-CICLO.md §1 para el contrato core/presentación).

Reglas duras

1. Los fuentes VB6 (Darwinbots2/) son read-only. Verificable con
git diff 02b20d7 -- Darwinbots2/, que debe salir vacío.
2. El ciclo es siempre: caso dorado transcrito como test en rojo →
implementación transcrita del fuente VB6 citado línea a línea (no de
memoria, no del wiki) → verde → commit citando la sección de la spec.
(El trabajo de capa host — API WASM, página web, worker — no tiene casos
dorados propios, pero TODO lo que toque port/core/ sigue esta regla
entera y la suite debe seguir en verde en los tres modos tras cada
cambio.)
3. Los [PROBABLE BUG] se replican tal cual (regla 4 del brief); los sitios de
error 6/9/11 del original llevan decisión de port documentada por sitio +
registro en VmDiag/SimDiag (10-CICLO.md §14).
4. Salvaguardas numéricas (PLAN.md): toda conversión float→int marcada por la
spec pasa por vb_round64/vb_clng/vb_cint (bancario centralizado);
Single = float estricto con casts explícitos; semántica VB6 ya replicada:
1/Single y Byte/100 dividen en Double, Long + Single promociona a
Double, IIf/And/Choose evalúan todos sus brazos (consumen RNG aunque el
brazo no gobierne); nada de -ffast-math; sin FMA implícita
(-ffp-contract=off); -fwrapv solo como red. La capa JS/render nunca
recalcula física ni RNG: solo presenta lo que el core vuelca (el worker
incluido: solo llama a db_sim_* y empaqueta).
5. Al cerrar un milestone o extensión: actualizar spec/PROGRESO.md (tabla
del port + sección "Siguiente" + registro con fecha) y commitear.
Regenerar spec/PROMPT-CONTINUACION.md con /prompt-continuacion.

Compilar y correr los tests (presets de CMake; correr desde port/)

cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js

(El preset wasm requiere EMSDK en el entorno y produce además
build-wasm/dbcore.js + dbcore.wasm — la biblioteca que consumen el worker
y la página. Los exe nativos linkean estático; no necesitan las DLL de
MSYS2 en el PATH.)

Correr la página web (la sim completa en el navegador, sobre un Web Worker)

cd port && python -m http.server 8000
# → http://localhost:8000/web/

Tu tarea

**El port está completo y la extensión Rendimiento está cerrada: no hay nada
obligatorio pendiente.** Preguntale al usuario qué extensión quiere encarar
(o encarala si ya te la indicó en este mensaje). Las candidatas registradas
en spec/PROGRESO.md §"Siguiente", todas capa host y opcionales:

1. **UI de sim** — inspector de bot al click (la API ya expone
   db_sim_bot_text), zoom/cámara sobre el Canvas, editor de opciones
   completo (la API llega hasta Costs 0..70; la página hoy expone las
   esenciales), gráficas de población.
2. **Modo Internet/torneo** — la E/S de teleporters entre sims ya funciona
   por búferes (db_sim_tp_outbox_take / db_sim_tp_inbox_push, verificada
   entre dos sims bajo node); faltaría el transporte que mueva los
   registros .dbo entre navegadores. La capa ⚙ de torneo (50-MUNDO.md §5)
   quedó deliberadamente fuera del contrato de fidelidad.

(La tercera candidata, Rendimiento, ya está cerrada: Web Worker + frame
único transferible; WebGL descartado por medición.)

Cualquiera de las dos es pura capa host (JS/HTML o dbcore_api.cpp): la
regla 2 solo se activa si algo exige tocar port/core/. Tras cualquier
cambio en port/core/ o en el CMake, la suite entera (143 casos / 2962
aserciones) debe seguir en verde en los tres modos. Si la extensión toca
la página web, respetá la arquitectura Worker: la página no llama a la API
WASM directamente — todo pasa por el protocolo de mensajes de worker.js
(documentado en su cabecera).

## ↑ COPIAR HASTA AQUÍ ↑

Recordatorio: regenerar este archivo con `/prompt-continuacion` al cerrar cada
milestone o extensión.
