---
titulo: Analyze
resumen: "The screen for understanding what happened in a run: charts from a catalog of metrics, automatic findings, species, family tree, genetics, events and comparisons between runs."
etiquetas: [analyze, charts, species, phylogeny, genetics, compare]
estado: revisada
---
Observe shows you the world cycle by cycle; **Analyze** shows you the whole
movie. While a run advances, the app takes a _sample_ every 100 cycles: how many
bots there are of each species, how much energy they have, how long their DNA
is, how many times they shot, who is whose child. Analyze draws all of that and
helps you find what is interesting.

Open it from **Analyze** in the top bar. It has seven tabs: **Dashboard**,
**Species**, **Phylogeny**, **Genetics**, **Events**, **Compare** and
**Reports**. The first five look at a single run; the last two work with
several.

## Which run you are looking at {#corrida}
<!-- web2/src/screens/Analizar.svelte; lib/analizar/fuente.js; i18n/es/analizar.json (analizar.corrida, meta.*, rango.*, sinCorrida, sinHistoria); lib/sim/metricas.js MUESTREO_CORRIDA (cada 100, dominante 10) -->

At the top right, the **Run** selector offers:

- **The current run (live)**: the one running in Observe. The charts update on
  their own, at most once per second.
- Each **saved run** in this browser, with its name and its last cycle. It opens
  _read only_: Analyze reads the history that was saved with it, without loading
  the simulation or touching the one that is running.

To have a saved run, use **Save** in Observe (see [[app/observar]]). The app
keeps the last 20 runs (see [[app/tus-datos]]).

Under the title, one line sums up the run: whether it is the current one or a
saved one, the cycle it reached, its seed and how many cycles apart the samples
were taken. If there are no samples yet, the app tells you at which cycle the
first one arrives; if no run is in progress, it offers **Go to Observe**.

Next to it is the **Cycle range**: **All**, **Last 10k** or **Last 1k**. It
trims the Dashboard, Species and Events charts all at once, so they stay aligned
with each other.

The page address remembers the run and the tab you picked: if you reload or copy
the link, you come back to the same place. With the focus on the tabs, the left
and right arrow keys move from one to the other.

### How the history is stored {#historia}
<!-- web2/engine/history.js (cabecera); PLAN.md decisión 8 y C21; i18n analizar.panel.nota (banda clara del mínimo al máximo) -->

A long run piles up a huge number of samples. To keep the history under about
5 MB, when it fills up the app _merges_ the old points two at a time: the new
point keeps the mean of the samples it combines, and also their minimum and
maximum. That is why, in the old stretches of a long run, each point on a chart
stands for several samples and carries a **light band** that goes from the
minimum to the maximum. The latest sample is never merged.

Events (extinctions, seedings, live changes…) and the lineage are stored
separately and are not merged.

## Dashboard {#panel}
<!-- web2/src/lib/analizar/Panel.svelte; catalogo.js (PANEL_POR_DEFECTO, seriesDe: maxEspecies 8, «Otras» en apilados); grafico/Grafico.svelte (tooltip, marca, banda); i18n analizar.panel.*, analizar.grupo.*, analizar.m.* -->

The Dashboard shows four charts. By default they are living bots by species,
births by species, mean DNA length by species and total energy. Each one has a
**Change** button that opens the **Chart catalog**: about a hundred metrics
split into six groups.

| Group | Some metrics |
|---|---|
| **Population** | living bots, vegetables, animals, corpses, living species, bots in multibots |
| **Evolution** | mean and highest generation, mutations, age, offspring per bot |
| **Genetics** | DNA length (mean, minimum, maximum), genes per bot |
| **Behavior** | shots of each type, reproductions, births, ties created, shell, slime, venom and poison made, deaths, kills |
| **Energy** | total energy, of vegetables and of animals, body, waste, chloroplasts |
| **Environment** | field size, obstacles, teleporters, available light, sun position and range, day or night |

Metrics that carry “· species” in the catalog are drawn as one curve per
species; the others are a total for the whole world. Quantities that add up
(bots, energy, shots) come out as **stacked areas**, one layer per species, and
averages (generation, DNA length) as **lines**. The eight species that reached
the most bots get their own curve; in the stacked areas, the rest are lumped
into a gray layer, **Others**.

When you hover over a chart, you see the cycle and the value of each curve (with
its minimum and maximum if the point is merged) and, in the areas, the total.
Your choice of the four charts is remembered in this browser.

What each thing measures is in the simulation chapter: energy and body in
[[simulacion/energia]], shots in [[simulacion/disparos]], defenses in
[[simulacion/defensas]] and ties in [[simulacion/lazos]].

### Findings {#hallazgos}
<!-- web2/src/lib/analizar/hallazgos.js (REFRESCO_HALLAZGOS_MS 5000, agrupados como el informe); engine/detectors.js (UMBRALES); engine/report/textos.es.json hallazgo.*; i18n analizar.hallazgos.* -->

To the right of the Dashboard, the **Findings** card reads the history with a set
of detectors and writes one sentence for each notable thing it finds. These are
fixed rules, not artificial intelligence: that is why the card says “rule-based
text”.

| Type | What it looks for |
|---|---|
| **Dominance** | A species that holds more than half of the animals for at least 5000 cycles. |
| **Collapse** | A sudden drop in the animal population: to half or less in about 2000 cycles, and it stays down. |
| **Extinction** | A species that runs out of bots and doesn't come back. A vegetable that reappears through repopulation doesn't count. |
| **DNA length** | A sustained growth or reduction (of 20% or more) in the DNA length of the animals. |
| **Replacement** | A species that displaces another as the most numerous. |
| **Oscillation** | A population that goes up and down with a regular period, at least five times in a row. |

Vegetables count in none of them, except extinction. Each finding has a link with
its cycle: when you click it, a dotted line marks that cycle on all four charts.
If the detectors find nothing, the card says so. With the current run, the
findings are recalculated every few seconds. They are the same sentences that
open a report (see [[app/informes]]).

Below there is a table with the most numerous species (now, their peak and their
highest generation) and the **All species** link, which opens the next tab.

## Species {#especies}
<!-- web2/src/lib/analizar/Especies.svelte; especies.js (COLUMNAS, comportamientoEspecie: últimos 10 puntos, por bot cada 1000 ciclos, COMPORTAMIENTO_FICHA); i18n analizar.col.*, analizar.esp.* -->

A table with one row per species and these columns: **Species**, **Now** (living
bots in the latest sample), **Peak**, **Appeared**, **Extinct** (“alive” if it
still is), **Max gen.**, **Mutations**, **Mean DNA**, **Energy per bot**, **Mean
age** and **Offspring per bot**, plus a small **Living bots** curve. Click a
header to sort by that column; another click reverses the order.

Clicking a species name opens its card, below the table:

- where it came from (founder present since a given cycle, or derived from
  another species) and, if it went extinct, when;
- the same numbers as the table and the cycle of its peak;
- its population over the run, with the band of the merged points;
- its recent **Behavior**, per bot and every 1000 cycles: energy, body and venom
  shots, reproductions, ties created, shell raised and deaths.

The **Show in Phylogeny** and **Dominant DNA vs founder** buttons take you to the
following tabs with that species already picked. The picked species is the same
in Species, Phylogeny and Genetics. What a species is for the engine is in
[[simulacion/especies]].

## Phylogeny {#filogenia}
<!-- web2/src/lib/analizar/Filogenia.svelte; filogenia.js; engine/lineage.js (poda a ancestros de vivos); PLAN.md C7; i18n analizar.filo.* -->

At the top, the **Species tree**: one bar per species that goes from the cycle
where it appeared to the last one where it had bots, with a × where it went
extinct. If a species was born from another, it hangs from it, and the arrow
next to the name collapses or expands its derived species.

In a simulation set up in the app the tree is usually **flat**: all species are
founders, seeded by you or arrived through a teleporter. That is because the app
doesn't turn on self-speciation, which is what makes new species appear (see
[[simulacion/especies#autoespeciacion]]). A tree with branches shows up when you
load a `.dbsim` file that has it turned on.

Below, the **Individuals** of the picked species: a family tree ordered by
generation, from left to right. The colored circles are the living bots; the
dots, their ancestors. So that it doesn't grow without end, the app keeps only
the living bots and their ancestors: branches that were cut off without
descendants are discarded. If the chain goes further back than what fits in the
drawing, it marks that with “…”.

When you click a bot, the **Selected individual** card shows its number, its
**Generation**, the cycle it was born in, its **Parent**, its **Mutations**, its
**DNA length**, its **Offspring** and whether it is alive or an ancestor. You can
also move around the tree with the keyboard: left goes to the mother, right to
the first child, up and down to the neighboring bot. The lineage follows the
maternal line, as [[simulacion/especies#linaje]] explains.

## Genetics {#genetica}
<!-- web2/src/lib/analizar/Genetica.svelte; genetica.js (KINDS_LINAJE, mapaCalor); engine/lineage.js (MAX_FOTOS 50, fotos solo si cambia el hash); lib/sim/metricas.js (dominante cada 10 muestras); i18n analizar.gen.*, analizar.hist.* -->

The tab has two halves.

**Histograms.** With **Histograms of** you pick **All species** or just one,
and with the buttons, what to measure: **DNA length**, **Generation**,
**Accumulated mutations**, **Age**, **Energy**, **Body**, **Genes**,
**Offspring** and **Kills**. The histogram is of the latest sample, with a dotted
line at the median. For all species, **Change over the run** is added: a heat map
with time on one axis and the value on the other, darker where there are more
bots. There you can see, for example, how DNA length drifts over the run. For a
single species there are four measures (DNA length, generation, mutations and
offspring), which come from its living individuals.

**Dominant DNA vs founder.** Every 1000 cycles the app takes a snapshot of the
_dominant_ DNA of each species, the one that most bots carry, and saves it if it
changed. Pick the **Species** and, if there are several, the **Snapshot**: the
tab compares it with the first one, which is the founder's. At the top, four
numbers: how many genes changed, the length before and now, the distance to the
founder and what share of the species carries that DNA. Then, one cell per gene
(**same**, **modified**, **new** or **deleted**) and, for each gene that changed,
the words before and after with the differences highlighted. At the end, the full
dominant DNA can be expanded.

This distance compares gene by gene; it is not the one the engine uses to decide
whether two bots can cross ([[simulacion/especies#distancia]]). How DNA changes
when it mutates is in [[simulacion/mutaciones]], and [[tutoriales/evolucion]]
suggests an experiment to see it in this tab.

## Events {#eventos}
<!-- web2/src/lib/analizar/Eventos.svelte; eventos.js (FILTROS; además del filtro «Todos»); i18n analizar.ev.* -->

A chart of the total population with a pin for each event and, below it, the list
of the run's events: the same ones Observe announces, stored without trimming.
The buttons filter by type and count how many there are:

| Filter | What it gathers |
|---|---|
| **New species** | species that appeared and ones that arrived by teleporter |
| **Extinctions** | species that ran out of bots |
| **Records** | population and generation records |
| **Live changes** | parameters changed while the run was going and changes to world objects |
| **Seeding** | the start of the run and every seeding |
| **Save and load** | when it was saved, resumed or loaded from a file |

When you click an event, in the list or on its pin, its cycle is marked with a
dotted line on this chart and on the Dashboard and Species ones. **Clear the
mark** removes it. It is useful to see what happened to the metrics right after a
live change or an extinction.

## Compare {#comparar}
<!-- web2/src/lib/analizar/comparar/Comparar.svelte, DosCorridas.svelte, Replicas.svelte, Barrido.svelte, SelectorMetrica.svelte; engine/replicas.js (MAX_REPLICAS 64, METRICAS_CLAVE, C19); engine/barrido.js (2-32 valores, 512 corridas); i18n/es/comparar.json; PLAN.md decisiones 10 y 13, C19 -->

Compare has three views.

**Two runs.** Pick **Run A** and **Run B** (the current one or saved ones), a
**Group** and a **Metric**: the two curves are drawn overlaid, each with its
band. Below, the **Settings differences**: scenario, seed, settings base, each
parameter that differs at the start, the seeded species, the world objects and
the live changes and seedings of each one. It is the quick way to answer “why
did these two runs end up so different?”.

**Replicates.** A single run can fool you: chance weighs a lot. Replicates repeat
a run's scenario with other seeds to see which result is typical and which was
luck.

1. In **Source run**, pick the run. It must have come from a scenario; a
   simulation loaded from a file can't be replicated.
2. Pick how many **Replicates** (1 to 64), how many **Cycles** and how many
   **Workers at once** (up to 8 by default, at most the cores of your computer
   minus one).
3. Pick the metric you want to see and click **Launch replicates**.

Each replicate runs without drawing, at full speed, and repeats the source run's
live changes at the same cycle. Replicate 1 uses the source run's seed. The
result is a line with the mean of the replicates and a band from the 10th to the
90th percentile, plus a table with the final value of the main metrics (living
bots, animals, vegetables, living species, highest generation, mutations, DNA
length, energy and kills) with their mean, standard deviation, minimum and
maximum. While replicates are still missing, you see what has already finished.

**Sweep.** The same, but changing one parameter: pick one with the **Parameter**
search (by name, variable or key), its **Values** (**From one value to another in
equal steps** or a **List of values**, between 2 and 32) and the **Seeds per
value**. The app runs each value with each seed, up to 512 runs in total, and
shows the metric at the end by parameter value, a table per value and the mean
series of each value. If the source run had live changes of that same parameter,
they are rewritten with each run's value. The parameters are in
[[app/experimentar-avanzado]]; by default the sweep proposes
[[param:base:maxEnergy]].

Replicates and sweeps are _background jobs_: they keep going while you use the
rest of the app and resume if you close it. How to manage them, and how to make a
report with their results, is in [[app/informes#trabajos]].

:::nota
The engine tells only 65,536 different worlds apart per seed: two different seeds
can give exactly the same run. Replicates and sweeps discard the seeds that would
repeat a world already used, so the band and the deviation don't come out
narrower than they really are.
:::
<!-- C19; verificado con probar-adn: semillas 12345 y 73151 (misma mezcla según estadoSemilla) dan posiciones idénticas; 12346 no -->

## Reports {#informes}

The last tab builds reports of one run, of two runs or of a replicates job, and
exports the raw data. It has its own page: [[app/informes]].
