---
titulo: Home
resumen: "The screen the app opens with: the last run, the scenarios to get started, opening a .txt or a .dbsim, your saved runs and recent bots."
etiquetas: [home, scenarios, runs, files, continue]
estado: revisada
---
Home is the app's first screen and the place you come back to when you want to
switch runs. From here you start a new world from a scenario, carry on with the
one you left running, resume a saved one or open a file. You get there with
**Home** in the top bar or by clicking the **DarwinBots** name.

The screen has two columns. On the left, the last run's card and the scenario
gallery; on the right, your **Saved runs** and **Recent bots**.

:::nota
A _run_ is a simulation with everything that defines it: the scenario it came
from, its seed and what you've been changing while it ran. That's why a saved
run can be resumed or repeated. More in [[tecnico/semillas]].
:::

## The last run {#ultima}
<!-- corrida-nucleo.js cargar («No arranca la sim»); sesion.svelte.js cargar (corriendo = false) -->
<!-- web2/src/screens/Inicio.svelte (tarjeta «ultima»); i18n/es/inicio.json inicio.ultima.*, inicio.vacio.* -->

The card at the top changes depending on what there is:

| What there is | What it shows | Buttons |
|---|---|---|
| A world in memory (what you left in Observe) | **Last run**: a thumbnail of the world, the name, the cycle, how many bots and species it has, and whether it's saved (“saved … ago”) or “not saved” | **Continue** and **View analysis** |
| Nothing in memory, but saved runs | **Last saved run**: the most recent one, with its thumbnail and its data | **Resume** |
| Nothing at all | **No runs yet** | **Pick a scenario**, which scrolls down to the gallery |

**Continue** takes you to [[app/observar]] with the world just as it was,
without reloading anything. **View analysis** opens [[app/analizar]] on that same
run. **Resume** loads the saved run and takes you to Observe paused: click
**Start** to have it go on.

With a tournament in progress, the simulation is its fight: **Resume**, the
scenarios' **Start**, **Choose file** and **Import .dbsim** are off, and a
notice at the top explains it and takes you to the tournament strip (see
[[app/competir#en-curso]]).

The world in memory lives as long as the tab is open. If you reload the page,
whatever you didn't save is lost; what you saved stays in the list on the right.

## Scenarios {#escenarios}
<!-- Inicio.svelte (galería); engine/escenarios/fabrica/*.json; i18n inicio.escenarios.*, inicio.etiqueta.* -->

A scenario is a setup ready to start: which bots get seeded, how many, what
color, and with what world settings. The gallery shows a preview of each one, its
name, a short description and some tags (the theme and how many species it
brings). The app comes with these:

| Scenario | What it's about |
|---|---|
| **Primordial soup** | Algae and a minimal animal in the default world, with mutations: the starting point to watch a species evolve. |
| **Predator and prey** | A hunter over a field of algae: does the food run out or do the populations balance? |
| **F1 match** | Two F1 league bots face to face with the league settings. |
| **Day and night** | The sun sets every 1000 cycles and the population oscillates. |
| **Maze** | A spiral maze the bots can see. |
| **Ocean** | Water physics in a world that closes in on itself; the algae float adrift. |
| **Archipelago** | Ten random rock islands and two teleporters. |

Each card has two buttons:

- **Start** creates the world with a new seed, sets it running and takes you to
  Observe. Clicking **Start** twice on the same scenario gives two different
  worlds: the seed changes.
- **Tweak** opens the scenario in [[app/experimentar]], where you change species
  and parameters before starting.

**F1 match** is different: instead of **Start** it says **Pick bots** and takes
you to [[app/competir]], because a match is set up by choosing the rivals.

The scenarios you save from Experiment show up in the same gallery after the
built-in ones, with the **Custom** tag. The **Custom setup** link, at the top
right of the gallery, also takes you to Experiment. How a scenario is built and
shared is in [[app/escenarios]].

:::cuidado
If there's a world in memory with unsaved changes, **Start**, **Resume** or
opening a file ask you before replacing it: “The current simulation has unsaved
changes and will be replaced. Continue?”. If you want to keep it, cancel and
save it from Observe.
:::

## From a file {#archivo}
<!-- corrida-nucleo.js importarDbsim (no arranca; aviso observar.aviso.importada «pulsá Iniciar»); Inicio.svelte abrirArchivo; lib/inicio/desde-txt.js (CANTIDAD_BOT 10, alga de sopa-primordial, base clásica); i18n inicio.archivo.*, inicio.error.txtVacio -->

The last card in the gallery, **From a file**, opens two kinds of file with the
**Choose file** button:

- **A `.dbsim`**: a saved simulation, yours or someone else's. It's loaded paused
  and takes you to Observe: click **Start** to have it go on.
- **A `.txt` with a bot's DNA**: the app builds a minimal world to try it and
  sets it running.

With a `.txt`, the new world is the default-values one, with the algae from
**Primordial soup** and ten copies of your bot. The bot takes the file's name
(without the `.txt`) and a color of its own; the run is called “_bot_ with
algae”. If your bot has the same name as the alga, only your bot is seeded.

It's the quickest way to see whether a bot you wrote does anything. The file
format is in [[adn/formato|the .txt format]]; if the DNA has words the engine
doesn't recognize, Observe tells you how many (they're worth 0). A `.txt` that's
empty or has only comments isn't seeded: the app warns you there's nothing to
seed.

For something more elaborate (other species, more copies, another world), seed
the bot from [[app/observar#sembrar]] or build a scenario in Experiment.

## Saved runs {#corridas}
<!-- Inicio.svelte (lateral); CORRIDAS_LATERAL 4; i18n inicio.corridas.* -->

The right-hand column lists the runs you saved from Observe, the most recent one
on top: name, cycle, how many bots it had and when you saved it. The one that's
loaded now carries the **current** mark.

1. Click a row to resume it. If it's the one already in memory, it takes you to
   Observe without reloading it.
2. If you have more than four, **See all** expands the whole list and **See
   less** shortens it again.
3. **Import .dbsim** opens a simulation file, just like the **From a file**
   card.

To delete a saved run, use **Runs** in Observe ([[app/observar#guardar]]).

## Recent bots {#bots-recientes}
<!-- lib/inicio/recientes.js (MAX_RECIENTES 4, categoría del Bestiary); i18n inicio.bots.*, inicio.categoria.* -->

Below, up to four bots from your current run and the saved ones show up, with
their color and their category in the library (F1, F2, Vegetable, Custom…). Each
name opens its profile in [[app/bots|the library]]. The **Full library** link
takes you to the entire library, with the count of bots it holds.

## Where everything is kept {#datos}
<!-- i18n inicio.nota; lib/recarga.js (con una corrida en memoria no recarga sola: lo no guardado se pierde al recargar) -->

Runs, custom bots, custom scenarios and tournaments are saved in this browser,
not on a server. If you switch computers or browsers they won't be there: export
them first. How to do that, and what happens if the browser clears its data, is
in [[app/tus-datos]].

If it's your first time, [[empezar/primera-simulacion]] walks you step by step
from **Primordial soup** to your first saved run.
