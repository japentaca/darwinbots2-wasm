# DarwinBots 2 — fuente original, especificación y port C++ → WASM

[DarwinBots](http://wiki.darwinbots.com/) es un simulador de vida artificial
(2003–2015): organismos con ADN programable compiten, se alimentan, mutan y
evolucionan en un mundo físico 2D. El original es una aplicación de
Visual Basic 6 que ya no corre en Windows moderno.

Este repositorio contiene **tres capas, en orden de derivación**:

| Capa | Qué es |
|---|---|
| [`Darwinbots2/`](Darwinbots2/) | El fuente original de DarwinBots **2.48.32** (VB6, 53 327 LOC). **Read-only**: es la autoridad última. Línea base en el commit `02b20d7`; `git diff 02b20d7 -- Darwinbots2/` debe salir vacío siempre. |
| [`spec/`](spec/) | La **especificación completa** extraída del fuente: ciclo de simulación, VM de ADN (77 opcodes), mapa de memoria (247 sysvars), física, visión, shots, ties, virus, reproducción, mutaciones, mundo y formatos — incluido el catálogo de bugs del original, que se replican tal cual. [`spec/70-CASOS-DORADOS.md`](spec/70-CASOS-DORADOS.md) es la suite de verdad; [`spec/PROGRESO.md`](spec/PROGRESO.md) el estado autoritativo. |
| [`port/`](port/) | La **reimplementación**: core C++20 *header-only* fiel al original bit a bit, compilado nativo (g++/clang) y a WebAssembly (Emscripten), con la sim corriendo en el navegador sobre un Web Worker y render Canvas 2D. |

El resto de los directorios de la raíz (`DBLaunch/`, `Installer/`,
`LocalDBIM/`, …) son herramientas companion de la época, parte del drop
original y conservadas sin tocar.

## Estado

**El port está completo y usable.** Los 10 milestones cerrados y verificados:

- **143 casos dorados / 2 962 aserciones en verde en tres modos de build** —
  g++ nativo, clang nativo y WASM bajo node — sin una sola divergencia
  numérica (redondeo bancario de VB6, LCG exacto, `Single`/`Double` con
  semántica VB6, sin `-ffast-math`, sin FMA implícita).
- Los `[PROBABLE BUG]` del original (35 catalogados) replicados y afirmados
  por tests: la fidelidad incluye los bugs.
- Página web con la sim completa: la física y el RNG viven en `dbcore.wasm`
  dentro de un Web Worker; la página solo presenta. Incluye guardar/cargar
  la sim en el formato binario de VB6 y un **Bestiary de 545 bots reales**
  bajados del [foro oficial](http://forum.darwinbots.com/) y validados con
  el propio core (`port/tools/bestiary/`).

El detalle milestone por milestone, con hashes y fechas, está en
[`spec/PROGRESO.md`](spec/PROGRESO.md).

## Compilar y correr los tests

Requisitos: CMake ≥ 3.25 + Ninja, g++ y/o clang++, y para WASM el
[emsdk](https://emscripten.org/) (variable de entorno `EMSDK`) y node.
Detalles del toolchain verificado en [`port/README.md`](port/README.md).

```sh
cd port
cmake --preset native-gcc   && cmake --build --preset native-gcc   && build/dbtests
cmake --preset native-clang && cmake --build --preset native-clang && build-clang/dbtests
cmake --preset wasm         && cmake --build --preset wasm         && node build-wasm/dbtests.js
```

## Correr la sim en el navegador

```sh
cd port && python -m http.server 8000
# → http://localhost:8000/web/
```

(Necesita el preset `wasm` compilado: produce `build-wasm/dbcore.js` +
`dbcore.wasm`, que consume el worker.)

## Reglas del proyecto

1. `Darwinbots2/` es read-only; el fuente VB6 **es** la spec cuando hay que
   desambiguar.
2. Todo lo que toca `port/core/` sigue el ciclo: caso dorado en rojo →
   implementación transcrita del fuente citado línea a línea → verde →
   commit citando la sección de spec.
3. Los bugs del original se replican, no se corrigen.
4. La capa JS/render nunca recalcula física ni RNG: solo presenta lo que el
   core vuelca.

## Licencia

El fuente original es copyright 2003 Carlo Comis y colaboradores
posteriores, distribuido bajo la licencia BSD-style de
[`LICENSE.md`](LICENSE.md). El port de `port/` y la especificación de
`spec/` son obras derivadas de ese fuente y se distribuyen bajo la misma
licencia.
