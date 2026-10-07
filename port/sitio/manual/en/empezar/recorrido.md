---
titulo: A tour of the app
resumen: "The six sections of the top bar (Home, Observe, Experiment, Analyze, Bots and Compete), what each one is for and where it's explained in detail, plus the classic interface."
etiquetas: [app, navigation, sections, interface]
estado: revisada
---
The app has six sections, always at hand in the top bar. There is only one
simulation running at a time: the one you see in Observe. The other sections
prepare it (Experiment), study it (Analyze), give it bots (Bots) or use it to
play matches (Compete).

| Section | What it's for |
|---|---|
| **Home** | Getting started: scenarios, the last run, your saved runs and your recent bots. |
| **Observe** | The live world, with its controls, events, statistics and the bot inspector. |
| **Experiment** | The scenarios and parameters of the simulation, with logged live changes. |
| **Analyze** | Metrics, species, phylogeny, events, comparisons and reports of your runs. |
| **Bots** | The bot library, their profiles and the DNA editor. |
| **Compete** | Matches and tournaments between bots, with standings, rounds and a hall of fame. |

## The top bar {#barra}
<!-- web2/src/lib/BarraSuperior.svelte; i18n/es/app.json; web2/PLAN.md decisión 24; i18n/es/comparar.json (comparar.chip.*) -->

Besides the six sections, the bar has:

- The DarwinBots **logo**, which leads to Home. Hover over it to see the app's
  version.
- A **simulation indicator**: “Running · _name_” or “Paused · cycle _N_”. A
  click takes you to Observe.
- A **jobs indicator** when there are replicates or tournament rounds running
  in the background (or finished, with a notice). A click takes you to where
  you can see them.
- **ES** and **EN**, to switch the language.
- Three **theme** buttons: system, light or dark. The world is always drawn
  on a dark background.
- **Classic interface**, the link to the other interface (see
  [[empezar/recorrido#clasica|further down]]).

## Home {#inicio}
<!-- web2/src/screens/Inicio.svelte; i18n/es/inicio.json -->

It's the front door. At the top, the **Last run**: the one you have open, with
**Continue** and **View analysis**, or, if none is open, the last one you
saved, with **Resume**. Below it, the **Scenarios** gallery: each card has
**Start**, which starts a new run and takes you to Observe, and **Tweak**, which
opens it in Experiment. The **From a file** card loads a saved simulation
(`.dbsim`) or seeds a bot from its `.txt` file, with algae in the default
world.

On the side, your **Saved runs** and your **Recent bots**, with a link to the
full library.

Details in [[app/inicio]]. If it's your first time, follow
[[empezar/primera-simulacion]].

## Observe {#observar}
<!-- web2/src/screens/Observar.svelte; lib/observar/*; lib/inspector/Inspector.svelte; i18n/es/observar.json, mundo.json, mundoObj.json -->

The world, big. On the bottom bar: **Start** / **Pause**, **One cycle**, the
speed (**× 1**, **× 10**, **× 100**, **Max**), **Seed** a new species,
**World** to place obstacles, mazes and teleporters on the field, **Save**,
**Find the best**, **Snapshot** (a world image or a record of each bot, living
or dead) and **Runs**. On the right, the **View** and **Color by**, which
change how the bots are drawn.

The side panel has tabs: **Live** (bots, species, energy, generation, the
population chart and the events), **Tournament** while one is being played and
**Bot**, with the **inspector** of the bot you clicked: its resources, its
senses, its memory, its DNA, a console and a mode for driving it with the
keyboard. The **▣ Field**, **◧ Mixed** and **▤ Data** buttons share the space
between the world and the panel.

Details in [[app/observar]] and [[app/inspector]].

## Experiment {#experimentar}
<!-- web2/src/screens/Experimentar.svelte; lib/experimentar/*; engine/opciones.js (CONTROLES_BASICOS, GRUPOS); i18n/es/experimentar.json; web2/PLAN.md decisiones 12-14 -->

This is where you build the world. On the left, the **Built-in scenarios** and
**Mine**. On the right, the open scenario as a _draft_: its parameters, its
**Species to seed** and its **World objects**.

- In **Basic** mode there are ten controls: costs, mutations, field size,
  edges, solar energy, vegetable cap and repopulation, day and night, medium
  (water, solid or space) and corpses.
- In **Advanced** mode all the engine's parameters are there, by group, with a
  search box and a mark on the ones you've changed.

Each change can be sent to the simulation that's running with **Apply to
current**, without starting over (except the field size, the initial seeding
and the objects, which need a new simulation), or used for a new run with
**New simulation**. What's applied live is noted in the run as an event.

Details in [[app/experimentar]], [[app/experimentar-avanzado]] and
[[app/escenarios]].

## Analyze {#analizar}
<!-- web2/src/screens/Analizar.svelte; i18n/es/analizar.json (analizar.tab.*), comparar.json (comparar.vista.*), informes.json; web2/PLAN.md decisiones 7-11 -->

Everything that can be measured about a run, in seven tabs:

| Tab | What it shows |
|---|---|
| **Dashboard** | Four charts of your choice, from six groups of metrics (population, evolution, genetics, behavior, energy and environment), and the automatic findings. |
| **Species** | One row per species, with its history. |
| **Phylogeny** | The tree of species and of individuals. |
| **Genetics** | Histograms and each species' dominant DNA, compared with its founder's. |
| **Events** | What happened and when; picking one marks it on all the charts. |
| **Compare** | **Two runs** overlaid, **Replicates** of the same scenario with several seeds and a **Sweep** of one parameter. |
| **Reports** | An `.html` file with the charts and the data inside, which opens offline and prints to PDF. |

Details in [[app/analizar]] and [[app/informes]].

## Bots {#bots}
<!-- web2/src/screens/Bots.svelte; lib/bots/*; lib/bots/editor/*; i18n/es/bots.json, editor.json; web2/PLAN.md decisiones 18-20 -->

The **Library** brings together the Bestiary bots and your own. You search them
by name, group and filter them by capability (“hunts (energy)”,
“photosynthesis”, “uses ties”, “venom”…), mark them as favorites and seed them
several at a time with **Seed batch**.

Each bot has its **profile**, with three tabs: **Summary** (what it does, what
it reads and what it writes), **DNA** and **History** (which runs,
tournaments and tests it took part in). The Bestiary bots are read-only: to
change them, you duplicate them. Your own are created with **+ New bot** and
written in the **DNA editor**, which warns you about errors as you write,
shows the DNA gene by gene, saves versions and has **Test**: it runs the number
of copies of the bot that you choose, for the number of cycles you choose,
without drawing, and tells you how it did compared with the previous version.

Details in [[app/bots]] and [[app/editor]].

## Compete {#competir}
<!-- i18n/es/competir.json competir.rapido.*, competir.nuevo.paso1-3, competir.formato.*, competir.jugar.*, competir.salon.ayuda -->
<!-- web2/src/screens/Competir.svelte; lib/competir/*; i18n/es/competir.json; web2/PLAN.md decisiones 21-23; port/HISTORIA.md Torneos (E10-E12) -->

Matches and tournaments between bots. The **Quick match** brings together up
to 20 bots and isn't saved, unless you keep it with **Save as tournament**. A
**New tournament** is set up in three steps (format, entrants and rules) with
six formats: single match, king of the hill, round robin, step ladder, world
cup and Swiss.

Matches are watched in Observe with **▶ Play**: a single one, the whole season
or one edition after another, with break screens between fights and, if you
like, in full screen. They can also be played with the **Background round**,
without drawing and at full speed; the result is the same. The standings carry points,
Elo and tiebreakers, and the **Hall of Fame** brings together the bots from all
the saved tournaments, with a single Elo calculated over all their matches.

Details in [[app/competir]].

## Your data {#datos}
<!-- i18n/es/inicio.json inicio.nota; web2/PLAN.md decisión 17; lib/analizar/informes/guardados.js -->

Everything you save (runs, your own bots, scenarios, tournaments, reports) stays
in this browser. Each section has a way to export it to a file and to import it
again. What is saved, where, and what happens if you clear the browser's data
is in [[app/tus-datos]].

## The classic interface {#clasica}
<!-- web2/PLAN.md decisión 5 (monitor RGB, skins, imagen de fondo, .gsave), decisión 17, C22; lib/bots/migracion.svelte.js y lib/competir/migracion.svelte.js (una sola vez, la clásica no se toca); port/HISTORIA.md Página web, Internet Mode (E7); port/web/index.html -->

The **Classic interface** link opens the port's first web version, at
`/classic/`. It uses the same engine, is in English and looks more like the
original program: floating windows, bot inventory, the original's charts and
Internet Mode. It no longer changes: it is published as it is.

The new app does everything the classic one does, except a few things that were
left out on purpose (such as the colored memory monitor or the background
image) and Internet Mode. The first time you open the new app, it copies the
bots and tournaments you had saved in the classic one, without touching them.
Details in [[app/clasica]].
