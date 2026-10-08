# DarwinBots 2 en el navegador — un port del original en Visual Basic

*[Read in English](README.en.md)*

> **Este proyecto es un port.** No es un DarwinBots nuevo: es una
> reimplementación fiel, en C++20 compilado a WebAssembly, de
> **DarwinBots 2.48.32**, el simulador de vida artificial escrito en
> Visual Basic 6 por Carlo Comis y mantenido durante más de una década por
> su comunidad. Todo el mérito del diseño, de la simulación y de los bots
> es de ellos; este repositorio solo intenta que su trabajo siga corriendo
> en máquinas modernas.
>
> **Sitio:** https://darwinbots-wasm.org: la app en `/app/` (en español e
> inglés), el manual en `/manual/` y `/en/manual/`, y la interfaz clásica en
> `/classic/`. Cada push a `main` lo publica en Cloudflare Pages
> (`.github/workflows/sitio.yml`).

## El proyecto original y su comunidad

[DarwinBots](http://wiki.darwinbots.com/) es un simulador de vida artificial
(2003–2015) en el que organismos con ADN programable compiten, se
alimentan, mutan y evolucionan en un mundo físico 2D. El ADN de cada bot es
un pequeño programa en un lenguaje de pila propio; los bots pueden
escribirse a mano o dejarse evolucionar.

**Historia.** Carlo Comis lo creó en Italia en 2002–2003 (*"Robottini
genetici!"*, se lee todavía en la pantalla *About* del original, que sigue
en italiano). A partir de ahí el proyecto pasó de mano en mano, tal como lo
registra su [licencia](LICENSE.md) y la propia pantalla *About*:

| Etapa | Quiénes |
|---|---|
| Versión original (2002–2003) | **Carlo Comis** |
| 2004–2005 | **Purple Youko** y **Numsgil** |
| Después de la 2.42 (2006–2007) | **Eric Lockard** (EricL) |
| Después de la 2.44.01 | **Los miembros del [foro de DarwinBots](http://forum.darwinbots.com/)** |
| Después de la 2.45.1 | **Botsareus** — la versión que se porta aquí es la 2.48.32 |

El fuente VB6 se publicó en
[github.com/darwinbots/Darwinbots2](https://github.com/darwinbots/Darwinbots2),
de donde sale el árbol que este repositorio conserva intacto en
[`Darwinbots2/`](Darwinbots2/). Alrededor del programa creció una
comunidad que durante años documentó el lenguaje de ADN y las variables del
sistema en el [wiki](http://wiki.darwinbots.com/), discutió estrategias en el
foro, organizó ligas y competencias (F1, F2, F3, multi-bots…) y, sobre
todo, **escribió bots**. Esa comunidad es la razón de ser de este port.

### De dónde salen los bots de la demo

La página incluye un **Bestiary de 684 bots reales**, escritos por la
comunidad y publicados a lo largo de los años en el
[Bestiary del foro](http://forum.darwinbots.com/) (el board 13 y sus
sub-boards). Ninguno fue escrito ni modificado para este port:

- Se rastrearon los 12 sub-boards del Bestiary: F1 (143 bots), F2 (130),
  *Interesting behaviour* (64), *Short* (58), *Multi-Bots* (54),
  *Mutations* (38), *Untagged* (34), F3 (29), *Veggies* (19),
  *Single store* (13), *EcoSim* (3) y *The Starting Gate* (3). Son las cifras
  de la primera corrida; el Bestiary actual tiene 684 bots (más bots de esos
  sub-boards y 115 del resto del foro y del wiki: ver `port/tools/bestiary/README.md`).
- De cada tema se tomó el ADN publicado: los adjuntos `.txt` del autor
  cuando existían y, si no, el bloque de código más completo del primer
  mensaje. Solo se normalizaron los caracteres invisibles (`&nbsp;`,
  espacios de ancho cero) que el foro había introducido.
- Cada candidato se validó **con el propio motor portado**, no con
  heurísticas: se carga, se siembra y corre 50 ciclos. Los 753 candidatos
  pasaron y se publicó uno por tema; después se quitaron 20 copias con
  ADN idéntico (el mismo bot publicado en varios sub-boards).
- En el selector de la página cada bot conserva el nombre con que lo
  publicó su autor. Cuando dos temas compartían título con ADN distinto, el
  nombre sale del propio ADN: el que el autor puso en la cabecera del
  código (varios adjuntos titulados "1" son en realidad *Saber*, *Slam
  Funk 1.0*, *Pacifist*…) o el título más lo que distingue a cada versión
  (nº de genes, por ejemplo). `port/web/bots/bots.json` guarda además el
  enlace al tema original del foro, donde está la autoría y la discusión.

El detalle del proceso está en
[`port/tools/bestiary/README.md`](port/tools/bestiary/README.md).

### Gracias

A Carlo Comis por la idea y el código original; a Purple Youko, Numsgil,
EricL y Botsareus por mantenerlo vivo; a quienes escribieron el wiki, que
documentó el lenguaje de los bots y resolvió dudas que el fuente solo no
alcanzaba a responder; y a cada persona que publicó un bot en el foro. Si alguno de los
bots de la demo es tuyo y preferís que se quite o que se acredite de otra
forma, abrí un *issue*.

Hubo otros intentos de llevar DarwinBots a plataformas nuevas, como
[DarwinbotsC](https://github.com/darwinbots/DarwinbotsC) o
[DarwinBots.Js](https://github.com/BradleyLyman/DarwinBots.Js); este
repositorio sigue su camino.

## Qué hay en este repositorio

El original es una aplicación de Visual Basic 6 que ya no corre en
Windows moderno.
Este repositorio contiene **tres capas, en orden de derivación**:

| Capa | Qué es |
|---|---|
| [`Darwinbots2/`](Darwinbots2/) | El fuente original de DarwinBots **2.48.32** (VB6, 53 327 LOC). **Read-only**: es la autoridad última. Línea base en el commit `02b20d7`; `git diff 02b20d7 -- Darwinbots2/` debe salir vacío siempre. |
| [`spec/`](spec/) | La **especificación completa** extraída del fuente: ciclo de simulación, VM de ADN (77 opcodes), mapa de memoria (247 sysvars), física, visión, shots, ties, virus, reproducción, mutaciones, mundo y formatos — incluido el catálogo de bugs del original (la mayoría ya corregidos en el port, ver [`port/README.md`](port/README.md#bugs-del-original-corregidos-2026-09-29)). [`spec/70-CASOS-DORADOS.md`](spec/70-CASOS-DORADOS.md) es la suite de verdad; [`spec/PROGRESO.md`](spec/PROGRESO.md) el estado autoritativo. |
| [`port/`](port/) | La **reimplementación**: core C++20 *header-only* fiel al original (salvo los bugs corregidos), compilado nativo (g++/clang) y a WebAssembly (Emscripten), con la sim corriendo en el navegador sobre un Web Worker. |

Dentro de `port/`, lo que se publica en el sitio:

| Carpeta | Qué es |
|---|---|
| [`port/web2/`](port/web2/) | La **app** (`/app/`): Vite + Svelte 5, en español e inglés, con seis secciones: Inicio, Observar, Experimentar, Analizar, Bots y Competir. Plan y decisiones en [`port/web2/PLAN.md`](port/web2/PLAN.md). |
| [`port/sitio/`](port/sitio/) | El **manual** (`/manual/` y `/en/manual/`) y las portadas: páginas en Markdown en `manual/es/` y `manual/en/`, y un generador propio sin dependencias (`generar.mjs`) que arma el HTML. Plan en [`port/web2/PLAN-SITIO.md`](port/web2/PLAN-SITIO.md). |
| [`port/web/`](port/web/) | La **interfaz clásica** (`/classic/`), la primera página del port, congelada: no recibe cambios. |

Qué documento interno mirar para cada cosa (spec, planes, historia del
port) está en [`DOCUMENTACION.md`](DOCUMENTACION.md).

El resto de los directorios de la raíz (`DBLaunch/`, `Installer/`,
`LocalDBIM/`, …) son herramientas companion de la época, parte del drop
original y conservadas sin tocar.

## Estado

**El port está completo y usable.** Los 10 milestones cerrados y verificados:

- **284 casos / 4 432 aserciones en verde en tres modos de build** (los casos dorados de la spec más los tests de la revisión contra VB6) —
  g++ nativo, clang nativo y WASM bajo node — sin una sola divergencia
  numérica (redondeo bancario de VB6, LCG exacto, `Single`/`Double` con
  semántica VB6, sin `-ffast-math`, sin FMA implícita).
- 35 bugs del original **corregidos** (2026-09-29). El lenguaje del ADN solo
  cambia en uno: el `else` tras `start` ahora corre, como decía la ayuda de
  los autores. Los demás que el ADN puede notar (`mkvirus` persistente, el
  ojo de ancho negativo…) se conservan. Lista completa en
  [`port/README.md`](port/README.md#bugs-del-original-corregidos-2026-09-29).
- Una app web con la sim completa: la física y el RNG viven en `dbcore.wasm`
  dentro de un Web Worker; la página solo presenta. Se observa el mundo y se
  inspecciona cada bot, se experimenta con escenarios y parámetros (también en
  caliente), se analiza cada corrida (población, genética, filogenia,
  eventos, réplicas e informes), se escriben bots con un editor de ADN, con la pila paso a paso, y se
  organizan torneos. Guarda y carga la sim en el formato binario de VB6
  (`.dbsim`) e incluye el **Bestiary de 684 bots de la comunidad** (ver
  [De dónde salen los bots](#de-dónde-salen-los-bots-de-la-demo)). La
  interfaz clásica sigue disponible en `/classic/`.
- Un **manual completo, en español y en inglés** (441 páginas por idioma):
  cómo funciona la simulación, el lenguaje del ADN, una página por sysvar y
  por operador, cada parámetro, tutoriales, estrategias y la guía de la app.
  Sus ejemplos de ADN pasan el lint del motor al generarse, y la app enlaza
  a él desde cada pantalla.

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

La app y el manual (node ≥ 24):

```sh
cd port/web2
npm ci
npm test            # node:test; con el wasm compilado corren también los que lo usan
npm run check       # Biome
npx vite build
node ../sitio/generar.mjs --lint   # el manual en los dos idiomas: enlaces, paridad y lint del ADN
```

## Correr la sim en el navegador

Necesita el preset `wasm` compilado (produce `build-wasm/dbcore.js` +
`dbcore.wasm`, que consume el worker).

```sh
node port/sitio/generar.mjs   # opcional: el manual, para que la app enlace a él
cd port/web2 && npm run dev
# → http://localhost:5173/ (la app); /classic/, /manual/ y /en/manual/ en el mismo servidor
```

## Competir

La sección **Competir** de la app enfrenta bots del Bestiary o propios con
las reglas de la liga F1 del original (capa host: no toca el core). Tiene un
partido rápido y torneos en seis formatos (partido único, que es el concurso
F1, rey de la colina, todos contra todos, escalera, mundial y suizo), con
una tabla con Elo que sigue de un torneo a otro, temporadas, un Salón de la
fama y un **▶ Jugar** que mira una pelea, la temporada entera o una edición
tras otra, con cortinillas y, si querés, a pantalla completa. La
interfaz clásica conserva sus ventanas *Contest* y *Canal de TV*. El detalle
está en el manual: [Competir](https://darwinbots-wasm.org/manual/app/competir/).

## Reglas del proyecto

1. `Darwinbots2/` es read-only; el fuente VB6 **es** la spec cuando hay que
   desambiguar.
2. Todo lo que toca `port/core/` sigue el ciclo: caso dorado en rojo →
   implementación transcrita del fuente citado línea a línea → verde →
   commit citando la sección de spec.
3. Los bugs del original se corrigen solo si el lenguaje del ADN no cambia:
   un bot existente tiene que seguir significando lo mismo. Única excepción
   decidida: el `else` tras `start` (desde el 2026-09-29; antes se
   replicaban todos).
4. La capa JS/render nunca recalcula física ni RNG: solo presenta lo que el
   core vuelca.
5. Cada cambio se refleja en la app, el manual y estos README, en los dos
   idiomas. Las instrucciones para agentes de código (y las skills que las
   detallan) están en [`AGENTS.md`](AGENTS.md).

## Licencia

El fuente original es copyright 2003 Carlo Comis, con modificaciones de
Purple Youko y Numsgil (2004–2005), Eric Lockard (2006–2007) y los miembros
del foro de DarwinBots, distribuido bajo la licencia BSD-style de
[`LICENSE.md`](LICENSE.md). El port de `port/` y la especificación de
`spec/` son obras derivadas de ese fuente y se distribuyen bajo la misma
licencia, incluida su cláusula de uso no comercial. Los bots del Bestiary
pertenecen a sus autores.
