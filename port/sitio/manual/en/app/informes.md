---
titulo: Reports
resumen: "How to turn a run, a comparison, a replicates job or a tournament into an .html report that opens offline and prints to PDF, how to export the raw data and how background jobs work."
etiquetas: [reports, export, PDF, CSV, replicates, jobs]
estado: revisada
---
A report is a single `.html` file with everything inside: the text, the charts
and the data. It opens in any browser offline, prints to PDF and can be emailed
or uploaded to a forum without attaching anything else. It's useful for keeping
the result of an experiment or for showing it to someone who doesn't have the
app open.

Reports are built in the **Reports** tab of Analyze (see [[app/analizar]]). Two
more come from other places: a tournament's, also from Compete, and a parameter
sweep's, from Compare.

## Generating a report {#generar}
<!-- web2/src/lib/analizar/informes/Informes.svelte; i18n/es/informes.json (paso.*, tpl.*, idioma.*, generar, descargar, imprimir, vista*); engine/report/index.js TIPOS -->

1. Under **1 · Template**, pick what to report on: **Run**, **Comparison**,
   **Replicates** or **Tournament**. Each card says what it includes and where it
   would come from.
2. Under **2 · Source and language**, pick the run (the current one or a saved
   one), the two runs to compare, the replicates job or the tournament,
   depending on the template. Also pick the **Report language**: **Español** or
   **English**, even if the app is in the other one.
3. Click **Generate and view**. The report shows up in the **Preview**, on the
   right.
4. With **Download .html** you download it; with **Print / PDF** it opens in a
   window and the browser offers to print it or save it as a PDF.

The app suggests from the start the run you're looking at in Analyze. To compare
you need two runs: if you only have the current one, save it from Observe or run
another. If the browser won't let the print window open, allow the site's
pop-ups, or download the `.html` and print it from there.

A report of the current run is a snapshot: it shows the run up to the cycle you
generated it at. If the run keeps going, generate another one later.

## What each template includes {#plantillas}
<!-- engine/report/corrida.js, comparacion.js (GRUPOS_CMP), replicas.js, torneo.js, barrido.js; engine/report/textos.es.json (sec.*, kpi.*, cmp.*, rep.*, torneo.sec.*, barrido.sec*) -->

They all start the same way: a title, a line with the data of what's being
reported (cycles, seed, options base, replicates…) and a rule-written
**Summary**.

### Run {#corrida}

It opens with the main numbers: bots at the end, the population peak, how many
species are still alive, the extinctions, the highest generation, the mean DNA
length at the end, the births and the cycles. Then, six sections:

1. **Configuration**: the options base and every changed parameter, the species
   seeded and the world objects.
2. **Population by species**: bots per species, stacked, with the findings
   marked.
3. **Metrics**: one block per group (population, evolution, genetics, behavior,
   energy and environment), with the histograms of the last sample.
4. **Species**: a table with each one's end value, peak, highest generation,
   mean DNA and status.
5. **Events and live changes**.
6. **Genealogy**: the species tree and, for each species, its dominant DNA
   against the founder's, gene by gene.

### Comparison {#comparacion}

Two runs, A and B. It includes the two **Configurations** side by side with
their differences, the **Metrics** of each group overlaid (A as a solid line and
B as a dashed one) along with each one's population by species, and the **Final
values** with the B − A difference. If the two seeds give the same world, the
report says so (see the note in [[app/analizar#comparar]]).

### Replicates {#replicas}

A replicates job from Compare. The summary gives the final value of the main
metrics as mean ± deviation. Next come the **Scenario and seeds** (with each
replicate's seed and whether it finished), the **Mean and p10–p90 band** of each
metric and the **Final values: means and deviations**. You can report on a job
that was left half done, cancelled or with a failed replicate, as long as at
least one finished: the report makes clear that the results are partial.

### Tournament {#torneo}

The last season of a saved tournament: **Standings**, the format's structure
(rounds, groups and bracket, fixtures, ladder…), **Elo over the season**,
**Matches** with their seeds and **Rules**. The report for another season is
generated from Compete (see [[app/competir]]).

### Sweep {#barrido}

It isn't among the templates: you download it with **.html report** when
viewing a sweep job in Compare, next to **CSV · summary per value** and **CSV ·
every run**. It includes the parameter, the scenario and the seeds, the final
value as a function of the parameter, each value's mean series and the table per
value.

## The automatic summary {#resumen}
<!-- engine/detectors.js; engine/report/corrida.js (frases con enlace #fig); informes.resumenNota; PLAN.md decisión 11 -->

In run and comparison reports, the summary's sentences come from the same
detectors as the Findings card on the Dashboard (see [[app/analizar#hallazgos]]):
dominance of a species, population collapse, extinctions, changes in DNA length,
substitutions and oscillations. In the replicates report they sum up each metric's
final value. There's no artificial intelligence or server involved: they're fixed
rules over the numbers. Each sentence ends with a link to the figure that backs
it up.

If a detector finds nothing, it writes nothing. A short or empty summary isn't an
error: the run had none of those things.

## The .html file {#archivo}
<!-- engine/report/plantilla.js (autocontenido, @media print A4, barra con script, datos en <script type=application/json>); PLAN.md decisión 24 (informes siempre claros); Informes.svelte (iframe sandbox="") -->

- **It needs no connection or anything external**: the charts are drawn inside
  the file and the data is embedded.
- **It has a bar at the top** with **Data · CSV**, **Data · JSON** and **Print /
  PDF**, which download the report's data without going through the app. That
  bar works in the downloaded file; in the app's preview the buttons don't
  respond.
- **It prints on A4**: without the bar, with page breaks between sections and
  without cutting figures or tables.
- **It's always light**, even if you use the app with the dark theme.

## Generated reports {#generados}
<!-- web2/src/lib/analizar/informes/guardados.js (MAX_INFORMES 30, guarda el html entero); i18n informes.generados, ver, bajar, borrar; competir.informe.listo -->

Every report you generate ends up in the **Generated reports** list, with its
template, its language, the date and the size. **View** opens it again in the
preview, **Download** downloads it again and **Delete** removes it. The whole
file is saved, so you can download it again even if you've already deleted the
run it came from. The tournament reports you generate from Compete also show up
here.

The app keeps the 30 most recent ones; when you generate the 31st, the oldest is
deleted. Everything stays in this browser (see [[app/tus-datos]]).

## Data only {#datos}
<!-- Informes.svelte (bajarCsv, bajarJson, bajarPng, MAX_LEYENDA 12); engine/export.js (csvLargo, jsonCorrida); lib/analizar/informes/png.js; i18n informes.datos.*, informes.png.* -->

If you'd rather make your own charts, the **Data only** card exports the run
you're looking at in Analyze:

| Button | What it downloads |
|---|---|
| **Series · CSV** | A table with all the history's series, one row per point: cycle, metric, species (empty if it's a total), mean, minimum, maximum and how many samples the point merges. It opens in any spreadsheet. |
| **Everything · JSON** | The complete history, the events, the lineage and the run's data (name, seed and scenario). |
| **Chart · PNG** | One of the Dashboard's four charts, whichever you choose in **Panel chart**, as an image. It comes out with the theme you're viewing; the legend shows up to 12 series. |

The merged points of a long run come out as they're stored: with their mean,
their minimum and their maximum (see [[app/analizar#historia]]).

## Background jobs {#trabajos}
<!-- web2/src/lib/trabajos/trabajos.svelte.js, pool.js (TOPE_POR_DEFECTO 8, núcleos − 1), ListaTrabajos.svelte, ejecutores.js (replicas, prueba, ronda, barrido); engine/replicas.js; lib/BarraSuperior.svelte (chip); i18n comparar.trabajos.*, comparar.aviso.*, comparar.chip.*; PLAN.md decisiones 10 y 23, C20 -->

Compare's replicates and sweeps run as _background jobs_: the app puts them in a
queue and runs them on several threads at once, without drawing and at full
speed, while you keep using the rest. The same queue also runs tournament rounds
in the background and the editor's bot test (see [[app/competir]] and
[[app/editor]]).

Each job shows up in Compare's list (**Replicate jobs** or **Sweep jobs**) with
its status: **Waiting**, **Running**, **Finished**, **Failed** or **Cancelled**,
and how many units it has done. The buttons:

- **Cancel** stops one that's waiting or in progress. What already finished is
  kept.
- **Retry** runs a failed or cancelled one again. Tournament rounds aren't
  retried: you ask for another round from Compete.
- **Delete** removes it along with its results, after you confirm.

A few useful things:

- **How many at once.** Compare's **Workers at once** field sets how many units
  run together: 8 by default, and at most your machine's cores minus one. Faster
  isn't always better if you want to keep using the computer.
- **They survive a reload.** If you close the app with jobs half done, they pick
  up again when you reopen it. Finished units aren't repeated; the one that was
  cut short starts over and gives the same result, because a run with its
  scenario and its seed comes out the same on any thread.
- **Only one tab runs them.** With the app open in several tabs, only one runs
  the queue; in the others you can see and manage them all the same. If that tab
  closes, another one takes over the queue.
- **Notices.** The top bar shows how many jobs are running or, when they finish,
  how many have finished; clicking it takes you to Compare (or to Compete, if
  they're tournament rounds). When a job finishes, a notice also appears in the
  list, with **View** and **Dismiss**. With **Notify me**, the browser also
  alerts you with a system notification.

When a replicates job finishes, it becomes available in the **Replicates**
template of Reports.
