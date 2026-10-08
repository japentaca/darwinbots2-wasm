# port/ — Darwinbots 2.48.32 en C++ → WASM

Port del motor conforme a la especificación de `../spec/` (el fuente VB6 es la
spec; `70-CASOS-DORADOS.md` es la suite de verdad). Arquitectura fijada en
`../spec/PLAN.md`: core C++ puro sin dependencias de render, compilado a WASM
vía Emscripten; presentación web separada.

Cómo se llegó hasta acá, milestone por milestone y etapa por etapa, está en
[`HISTORIA.md`](HISTORIA.md).

## Estructura

| Carpeta | Qué es |
|---|---|
| `core/` | El motor, header-only (`include/dbcore/`): VM, ciclo, física, visión, shots, ties, virus, reproducción, mutaciones, mundo y formatos. |
| `tests/` | La suite doctest: los casos dorados de `spec/70-CASOS-DORADOS.md` y los de la revisión contra VB6. |
| `wasm/` | `dbcore_api.cpp`, la API del core hacia JS (`dbcore.js` + `dbcore.wasm`). |
| `web/` | La app clásica, **congelada**; se sirve en `/classic/` ([historia](HISTORIA.md#la-app-clásica-web)). |
| `web2/` | La app nueva (Vite + Svelte 5); plan en [`web2/PLAN.md`](web2/PLAN.md). |
| `sitio/` | El generador de darwinbots-wasm.org y el manual en español e inglés; plan en [`web2/PLAN-SITIO.md`](web2/PLAN-SITIO.md). |
| `tools/` | Herramientas y smokes (abajo). |

## Estado

El motor está completo: los milestones M1–M10 cubren el original entero, sin
stubs abiertos. Del plan de extensiones (`spec/PLAN-EXTENSIONES.md`) están
cerradas E1–E8, E6.5 y E10–E12; E9 (sexualidad visible) quedó en pausa y E13
(backend) pendiente. Lo que vino después son añadidos de la capa host,
anotados en los planes de `web2/`.

Estado verificado (2026-10-07): 284 casos / 4432 aserciones en verde (en los tres modos; incluye los tests de la revisión contra VB6, pilotos 1-14), con el plan de extensiones completo (E1..E8 y E6.5), PP-01/PP-03 y los añadidos de host del 2026-09-25/26: Inventario, Laboratorio, ajustes F1, Contest, Canal de TV e interfaz en inglés; después, E10 (ligas) y E11 (torneos unificados: Contest, Canal y Ligas en una sola ventana) (ver `spec/PROGRESO.md`), y 35 bugs del original corregidos (ver [Bugs del original corregidos](#bugs-del-original-corregidos-2026-09-29)).

## Build

Con presets (CMake ≥ 3.25; correr desde `port/`):

```
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
```

El preset `wasm` requiere la variable de entorno `EMSDK` apuntando a la raíz
del emsdk (p. ej. `EMSDK=C:/Users/<usuario>/emsdk`); toma el toolchain de
`$EMSDK/upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake`.
Equivalente sin presets: `emcmake cmake -S port -B port/build-wasm -G Ninja`.
`ctest --test-dir port/build-wasm` también funciona (el toolchain registra
node como emulador).

El preset `wasm` produce además `build-wasm/dbcore.js` + `dbcore.wasm`: el
core como biblioteca WASM con la API de `wasm/dbcore_api.cpp` (M10).

Para probar la app clásica, servir desde `port/` (el navegador no carga WASM
desde `file://`):

```
cd port && python -m http.server 8000
# → http://localhost:8000/web/
```

La app nueva se sirve con `npm run dev` desde `web2/` (ver `../README.md`).

## Herramientas

| Herramienta | Qué hace |
|---|---|
| [`tools/bestiary/`](tools/bestiary/README.md) | Baja, valida y publica los bots del Bestiary del foro y los extra del foro y del wiki (684 en total), con sus perfiles genéticos. |
| [`tools/fight/`](tools/fight/README.md) | `dbfight` (un partido F1 con el core nativo) y `torneo.mjs` (rey de la colina, suizo, duelo) sin navegador. |
| `tools/imrelay/` | Relay WebSocket de Internet Mode (`node tools/imrelay/relay.mjs`, Node ≥ 22) y su smoke. |
| `tools/pp/`, `tools/rv/`, `tools/e8/`, `tools/e10/`, `tools/e11/`, `tools/e12/`, `tools/swiss/` | Smokes de cada etapa (`node tools/<carpeta>/smoke_*.mjs`; necesitan `build-wasm/dbcore.js`). Qué prueba cada uno, en [`HISTORIA.md`](HISTORIA.md). |

## Bugs del original corregidos (2026-09-29)

Hasta aquí el port replicaba los `[PROBABLE BUG]` del catálogo
(`spec/70-CASOS-DORADOS.md §9`). Desde el 2026-09-29 se corrigen los que se
pueden corregir **sin cambiar el lenguaje del ADN**: el cargador, la VM, los
operadores y el significado de cada sysvar quedan igual, así que un bot
existente sigue cargando y ejecutando lo mismo. La única excepción, decidida
a conciencia, es el `else` tras `start` (A2-1): 9 bots de `web/bots` lo usan
(Lionfish de 2007, Zer0Bot, TRON_F1, bots de Moonfisher…) y ahora ejecutan
un cuerpo que antes nunca corría. Las estadísticas de la sim sí
cambian (energía, disparos, repoblación, consumo de RNG). Cada corrección
lleva un comentario `Corregido <id>` en el core, y su caso dorado se invirtió
para afirmar el comportamiento nuevo. Los 571 bots de `web/bots` cargan y
corren 300 ciclos sin fallos.

**Corregidos (35)**

| Área | Id | Qué cambia |
|---|---|---|
| VM | A2-1 | El `else` que sigue a un `start` corre si las condiciones del gen son falsas (antes nunca corría). La numeración de genes no cambia. |
| Ciclo | A1-1 | `Shock` convierte la energía perdida en body (antes la destruía). |
| Ciclo | A1-3 | La matanza por presión de memoria ya no llama a `KillRobot(0)` sin candidato. |
| Ciclo | A1-5 | Un bot se encola una sola vez para reproducirse; si procede la sexual, la asexual espera. |
| Sentidos | A3-1 | `refvelsx` = −`refveldx` (valía siempre 0). |
| Sentidos | A3-2 | `EraseTRefVars` borra también `trefshell`. |
| Sentidos | A3-3 | `trefnrg` se topa en ±32000 en vez de congelarse. |
| Sentidos | A3-4 | El espionaje de ojos por tie mira `tmemloc` (mem 476), no `trefaim`. |
| Sentidos | A3-5 | `Kills`/`refkills` con tope 32000 también por la vía de shots. |
| Energía | A3-7 | `strbody`/`fdbody` negativos se borran sin efecto. |
| Energía | A3-10 | `mkchlr`/`rmchlr` negativos no hacen nada (antes `rmchlr` −100 compraba 100). |
| Física | B1-1 | `TieTorque` topa `nay` con su propio signo. |
| Física | B1-2 | `TieTorque` reajusta la última tie fijada, no el slot vacío siguiente. |
| Ties | B4-1 | Una tie nueva nace en blanco (no hereda `.ang`/`.angreg` del ocupante anterior). |
| Ties | B4-2 | Compartir con topes pasa el exceso al otro lado en vez de destruirlo. |
| Visión | B2-1 | La oclusión por formas usa los lados reales y exige cruzarlos. |
| Visión | B2-3 | Dentro de una forma, `EYEF` también va a 32000. |
| Visión | B2-4 | `lastopppos` de formas se captura para el ojo con foco. |
| Visión | B2-5 | Las formas usan el mismo ancho de ojo que los bots. |
| Shots | B3-1 | Inmunidad filial por AbsNum del tirador (antes comparaba slot con AbsNum). |
| Shots | B3-2 | Un shot huérfano puede golpear al nuevo ocupante del slot del tirador; las muertes se acreditan solo al tirador real. |
| Shots | B3-4 | `newshot` y `releasenrg` no sortean números que no usan. |
| Shots | B3-5 | Gana el bot del golpe más temprano (antes el de índice más bajo o el último). |
| Shots | B3-6 | `takewaste` topa el waste en 32000 al momento. |
| Virus | B3b-1 | Disparar un virus cobra una vez (cobraba dos). |
| Virus | B3b-2 | Penetrar la slime la agota y resta de la potencia (antes la amplificaba). |
| Virus | B3b-3 | La potencia ya no se multiplica por el número de gen copiado. |
| Repro | B6-2 | Lotería vegetal 1/11 también en la sexual (era 1/10). |
| Repro | B6-4 | El body del hijo no se redondea a entero. |
| Mutaciones | B6-5 | Los suelos anti-congelación ya no reescriben las tasas heredables. |
| Mutaciones | B6-7 | `Insertion` cuenta una mutación por token (contaba dos). |
| Mutaciones | B6-9 | Una mutación en vida rehace la firma (`makeoccurrlist`). |
| Mundo | B7-1 | `VegsRepopulate` no sortea coordenadas que se descartan. |
| Mundo | B7-3 | Un teleporter con un solo eje de deriva se mueve. |
| Mundo | B7-4 | Al cargar una sim, la primera repoblación no tarda el doble. |

**Conservados**, y por qué:

- **Los ve el ADN** (cambiarlos cambiaría lo que significa un bot): el corrimiento del cero
  inicial con `def`s y su efecto en el hijo sexual (A2-2, B6-1), las
  asimetrías de pila y operadores (A2-3 a A2-7), `mkvirus` persistente
  (B3b-4), el ojo de ancho negativo (B2-2), `.shoot` múltiplo de 1000 =
  esperma (B3-3), el puerto 0 de la tie de nacimiento (B4-3), el centinela
  32000 de `fixang` (A3-8) y `hitang` sin escritor (A3-6: en la práctica es
  memoria libre con nombre).
- **Mecánica, no error**: `ReSpawn` toroidal del organismo entero (B1-4),
  corpses que colisionan (B1-5), rejilla topada al borde (B1-6), los bots que
  se reproducen el ciclo en que mueren (A1-7), la pérdida de tramos en el
  crossover (B6-3) y los tipos de cambio venom/poison y el suelo de
  `MOVECOST` (B5-2, B5-3).
- **Sin efecto observable**: `UpdateTieAngles` sobre slots vacíos (A1-6),
  `Amplification` desde t = 2 (B6-8: un centro en t = 1 siempre lo descarta
  el control de bordes), el bucle anti-espacios del cargador (A2-8).
- **Configuración**: `bodyfix = 32100` apaga la pasada anti-gigantes (B5-1);
  elegir otro umbral sería una regla nueva, no una corrección.
- **Formato de archivo**: `sint`, el centinela 254, las `vars` 51+ y los
  AbsNum importados (B8-2 a B8-6) se conservan para leer y escribir las
  sims y los `.dbo` del original.
- Ya resueltos antes: B8-1 (el guardado no se llama a sí mismo), A1-4 (sin
  busy-wait) y los sitios de error 6/9 con decisión de port.

## Toolchain verificado (Windows 11, 2026-08-26)

| Herramienta | Versión | Origen |
|---|---|---|
| g++ | 14.2.0 | MSYS2 ucrt64 (`mingw-w64-ucrt-x86_64-gcc`) |
| clang++ | 19.1.7 | MSYS2 ucrt64 (`mingw-w64-ucrt-x86_64-clang`) |
| Emscripten (emcc) | 6.0.8 | emsdk `latest` (clonado en `~/emsdk`, `emsdk install latest && emsdk activate latest`) |
| node | 24.x | sistema (el emsdk trae su propio 24.19.0) |
| CMake / Ninja | 4.0.1 / 1.13.2 | sistema |

Los tres compiladores son de la misma familia de flags GNU/Clang, así que las
salvaguardas del `CMakeLists.txt` (`-fno-fast-math`, `-ffp-contract=off`,
`-fwrapv`) aplican idénticas en los tres modos.

## Reglas

- Los fuentes VB6 (`../Darwinbots2/`) son read-only.
- Toda conversión float→int marcada por la spec pasa por `vb_round64`/`vb_clng`
  (redondeo bancario centralizado, salvaguarda 3).
- Los sitios de error 6/9/11 del original llevan comportamiento explícito
  documentado por sitio + registro en `VmDiag` (10-CICLO.md §14).
- Nada de `-ffast-math`; sin FMA implícita (`-ffp-contract=off`).
