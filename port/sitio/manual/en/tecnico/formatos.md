---
titulo: File formats
resumen: "What each file the app reads and writes is — a bot's .txt, a simulation's .dbsim, the .snp and .json files —, what it holds inside, and what gets rewritten when it is loaded."
etiquetas: [formats, file, dbsim, snp, json, backup]
estado: revisada
---
The app works with a few formats, and all of them are designed to last: you can
save them, move them to another computer and open them again. This page is the
reference for each one: what it is, what it holds, what opens it and what happens
when the app loads it. How to export and import them from each screen is in
[[app/tus-datos]]; the DNA format itself is in [[adn/formato]].

## At a glance {#tabla}
<!-- web2 src/lib/observar/descargas.js (nombreArchivo, descargar); i18n inicio.archivo.*, observar.guardar.*, observar.corridas.*, experimentar.*, competir.lista.*, bots.menu.*; port/web/index.html (Save sim/Load sim, .gsave); engine/league.js (lgFileName: .league.json) -->

| File | What it is | Who writes it | Who reads it |
|---|---|---|---|
| `.txt` | A bot's DNA, as text | You and the [[app/editor\|editor]]; the engine, when exporting a living bot | The DNA loader, in the app and in the classic interface |
| `.dbsim` | A saved simulation, in binary | [[app/observar]] (**Download .dbsim**) and the [[app/clasica\|classic interface]] (**Save sim**) | The app (**Import .dbsim**, **Open a .dbsim file…**) and the classic interface (**Load sim**) |
| `.snp` and `_Mutations.txt` | Census of the living and record of the dead | [[app/observar]] → **Snapshot** | Nobody inside the app: they are text for you to read |
| scenario `.json` | A simulation's configuration | [[app/experimentar]] (**Export**) | **Import .json** in Experiment, here or in another browser |
| `.league.json` | A tournament with its entrants and matches | [[app/competir]] (**Export**) | **Import .json** in Compete (the classic interface too) |
| library `.json` | Your bots with their versions and your marks | [[app/bots]] (**⋯** → **Export my bots and marks**) | **Import library** in Bots (the classic interface's inventory too) |
| `.html`, `.csv`, `.json`, `eyes.txt`, `.png` | Outputs to read separately | [[app/informes]], Compare and the inspector | Your browser, your spreadsheet, your text editor |

## A bot's .txt {#txt}
<!-- adn/formato.md (toda la mecánica del formato); Inicio.svelte abrirArchivo (.txt → escenario con algas); web/index.html Seed species -->

Every bot is a text file: the ones in the Bestiary (published on the forum and
the wiki), the ones you write and the ones the engine rebuilds when exporting.
Bringing one into a simulation is easy: in [[app/inicio]], **From a file** with
a `.txt` extension seeds it in a world with algae; a scenario names them in its
species; the classic interface pastes it into the seeding panel. How the loader
reads that text line by line — the comments, the `'#` header, the hash — is in
[[adn/formato]], and isn't repeated here.

## The saved simulation (.dbsim) {#dbsim}

### What it contains {#dbsim-contiene}
<!-- 60-FORMATOS §4 (arquitectura de SaveSimulation: bots densos, SimOpts por capas, 5 pasadas de especies, Costs, teleporters, obstáculos, shots, MaxAbsNum, gráficas, sol, mareas); core formats.hpp SaveSimulation (UserSeedNumber, TotRunCycle, strSimStart, EnableAutoSpeciation y umbrales); robots.hpp ManageDeath (el cadáver sigue existiendo); wasm dbcore_api.cpp db_sim_save -->

The `.dbsim` is a complete picture of the world at the cycle when you
downloaded it:

- **the bots that exist at that moment, corpses included**: position, heading
  and velocity, energy, body, waste, venom, poison, shell and slime,
  chloroplasts, age, generation and mutations, species and mother, the entire
  memory, the DNA and the ties (with the sperm received, if the bot was
  fertilized);
- the shots in flight, the obstacles and the teleporters;
- the species registry: name, color, whether it is vegetable, its mutation
  rates;
- all the simulation's parameters and costs, the current cycle, the seed, the
  start date, the sun and the tides;
- the state of self-speciation: if the file has it on, with its thresholds, the
  engine honors it even though the app has no control to turn it on (see
  [[simulacion/especies#autoespeciacion]]).

It is the same binary format as the original DarwinBots, which saved these files
under the name `.sim`.

### What doesn't travel and is rewritten on load {#dbsim-carga}
<!-- 60-FORMATOS §4 RV-40 (el registro de especie guarda ruta y nombre, no el ADN); core sim.hpp Specie::dnaMissing, master.hpp RobScriptLoadSim, vegs.hpp checkvegstatus (Native); web2 src/lib/sim/corrida-nucleo.js (dna-missing → dna-lib: escenario, siembras, bots propios del escenario, Bestiario; StartChlr y opciones 92–101 reescritas del escenario efectivo); i18n observar.aviso.error.sinAdn. 60-FORMATOS §4 RV-39; wasm dbcore_api.cpp CarryProcessGlobals. Quirk de mutaciones: core formats.hpp LoadSimulation (CInt(True) = −1: el flag DisableMutations cargado en True se resetea siempre); web2 engine/opciones.js (la casilla «Mutaciones» de Experimentar es este flag, invertido) -->

Three things aren't in the file, and on load they are filled in or rewritten:

- **Each species' DNA.** The registry stores the name, not the code. On load,
  the app looks for it among what this page seeded (the run's scenario and your
  seedings) and in the Bestiary. If it doesn't find it, it warns you with the
  bot's name: that species can no longer be seeded or repopulate, although the
  bots that already carry it are fine, because each one keeps its own DNA.
- **The initial chloroplasts and the game modes' settings** (the restart, the
  disqualification, F1…). In the original they survived loading because they
  lived in the program, not in the file. When you resume a saved run that has a
  scenario, the app rewrites them with the scenario's; in a `.dbsim` opened as
  a loose file, the session's own values apply.
- **The global switch-off of mutations.** The file stores it, but the original's
  loader always turned it on (a detail of how it read the flag), and the port
  replicates that behavior: when you load a simulation, mutations are on. Each
  species' rates do travel, so you only have to turn them off again if that's
  what you wanted.

A fourth one isn't about the format but about the app: the metrics history, the
events and the lineage don't go inside the `.dbsim`; they stay with the saved
run in the browser, trimmed to the file's cycle (see [[app/tus-datos]]). The
`.dbsim` is the world, not the whole run.

### Resuming is not repeating {#dbsim-retomar}
<!-- wasm dbcore_api.cpp db_sim_load (Rnd -1 : Randomize UserSeedNumber/100: el generador se vuelve a sembrar con la semilla del archivo); web2 PLAN.md C17 (futuro válido pero no idéntico; el mismo archivo en cualquier worker sigue igual); probado (re-corrido con la API del wasm): sim guardada al ciclo 10, el buffer cargado en dos sims nuevas reproduce byte a byte la misma corrida en las dos, y ninguna sigue el futuro que habría tenido la original -->

The random number generator doesn't travel either: on load, the engine reseeds
it with the seed the file carries. That is why a resumed run follows a _valid_
course, but not the identical one it would have taken had you not saved it.
What is guaranteed: the same file, loaded in any browser, runs the same. The
seed's full mechanics are in [[tecnico/semillas]].

### Both interfaces {#dbsim-compat}
<!-- port/README.md «Página web» (formato binario de VB6 como .dbsim); port/web/index.html (darwinbots-cycleN.dbsim; el selector de Load sim acepta .dbsim y .sim); wasm dbcore_api.cpp db_sim_save/db_sim_load compartidos por las dos orquestaciones (paridad byte a byte, PROGRESO E1) -->

The app and the classic interface share the engine and the format: a file from
one opens in the other. The classic interface downloads it as
`darwinbots-cycleN.dbsim` (_N_ is the cycle) and its picker also accepts files
with the old extension, `.sim`; inside it is the same thing.

## Snapshots (.snp) {#snp}
<!-- core database.hpp (kSnpHeader, AppendSnpRecord: 14 columnas, el ADN detokenizado cierra cada registro; Snapshot/AddRecord = «Snapshot of the living» / «of the dead» de Database.bas); port/README.md «Registro y análisis»; web2 MenuInstantanea.svelte + inspector/veterano.js (ARCHIVOS_MUERTOS DeadRobots.snp / DeadRobots_Mutations.txt; vivos <corrida>-<ciclo>.snp; deadTake → drain; deadReset) -->

The **Snapshot** menu in [[app/observar]] downloads two things:

- **Snapshot of the living (.snp)**: a record of each living bot at the moment
  you press the button, with its complete DNA. With **With the mutation
  details** ticked, it also downloads a `_Mutations.txt` with each one's
  mutation history.
- **Record of the dead**: with **Record dead bots** on, the simulation writes a
  record of each bot that dies (it is the parameter [[param:opt:111]]; **Without
  vegetables**, the [[param:opt:112]]). **Download** gets what has accumulated as
  `DeadRobots.snp` and `DeadRobots_Mutations.txt`, and the record carries on;
  **Reset** deletes it entirely.

The living are downloaded as `<run>-<cycle>.snp`. Inside it is plain text, as in
the original:

```text
Rob id,Parent id,Founder name,Generation,Birth cycle,Age,Mutations,New mutations,Dna length,Offspring number,kills,Fitness,Energy,Chloroplasts

13,0,Animal Minimalis,2,1450,331,1,1,27,5,2,1045935.86,4300,0
 cond
 *93 1 <
 start
 5 .up store
 stop
```

A header line with the fourteen columns and, for each bot, its line of numbers
and below it its DNA. “New mutations” are the bot's own (not the inherited
ones); “Energy” is its energy plus ten times its body; “Fitness” is the same
fitness that **Find the best** uses. It opens with any text editor: it is useful
for keeping the winners of an evolution, comparing them or analyzing them with
your own programs. The app doesn't read them back.

## The app's .json files {#json}
<!-- escenarios: engine/escenarios/index.js (typedef: formato 1, id, nombre, etiquetas, destino, opciones base+cambios, especies con origen/hash/adn, objetos) y src/lib/experimentar/archivo.js (exportarEscenario JSON con sangría 2; importarEscenario renombra id ocupado o de fábrica); probado en el scratchpad: export de «Sopa primordial (copia)» y reimportación. Torneos: engine/league.js lgExportObj/lgImportObj (kind darwinbots-league, version 2, la 1 también se importa; entrants con dna; matches sin id ni liga), src/lib/competir/torneos.svelte.js (exportar/importar, nombre.league.json, «(importado)»); probado en el scratchpad. Biblioteca: engine/migracion.js (formato darwinbots2-biblioteca v1; también lee el darwinbots-inventario de la clásica) -->

### Scenarios {#json-escenario}

A scenario's `.json` is indented text, meant to be read and edited by hand:
name, description and tags; the parameters as changes on top of a base (Classic
or F1 league); the species with their bot, quantity, color, vegetable flag,
initial energy and a fingerprint of the DNA; and the world's objects. The
Bestiary's bots go by name and fingerprint; yours travel with their DNA inside,
so the file works in any browser. A whole example, field by field, is in
[[app/escenarios#archivo]]. On import, if you already have a scenario with the
same identifier, it comes in as a new one without overwriting yours.

### Tournaments {#json-torneo}

The `.league.json` carries the entire tournament: each season with its rules, its
format and its entrants — each with the DNA frozen when it was entered — and all
the matches played. You don't need to have the bots: the DNA travels inside, so
it can be shared with anyone. On import it comes in as a new tournament (with
“(imported)” if the name already existed) and the files exported by the classic
interface are accepted too.

### Your library {#json-biblioteca}

The Bots `.json` carries all your own bots with their versions, your favorites,
tags, notes and named selections. The import adds without deleting anything, and
it also accepts the inventory exported by the classic interface. The details are
in [[app/bots#importar]].

## Outputs to read separately {#salidas}
<!-- engine/report/plantilla.js (informe_<slug>_<fecha>.html, autocontenido); engine/export.js (csvLargo, jsonCorrida: historia + eventos + linaje + meta); src/lib/analizar/comparar/Barrido.svelte (_resumen.csv / _semillas.csv); src/lib/inspector/DisenadorOjos.svelte (eyes.txt); port/web/index.html (.gsave del original, solo la clásica; web2/PLAN.md decisión 5: la app lo reemplaza por el CSV) -->

- **Report `.html`** ([[app/informes#archivo]]): a single self-contained file,
  with the charts and the data embedded; it opens offline and prints on A4 from
  the browser.
- **Series · CSV** and **Everything · JSON** ([[app/informes#datos]]): a run's metrics
  for your spreadsheet, or the full history, events and lineage. Compare's
  sweeps download their own CSVs.
- **`eyes.txt`**: the gene that sets the eyes designed in the inspector, ready to
  paste into a bot.
- **World image (PNG)**: the field as you see it, from Observe or the Analyze
  Dashboard.
- **`.gsave`**: the text dump of a chart from the original. It only exists in the
  classic interface; the app replaces it with the CSV.

## Where these names come from {#origenes}
<!-- 60-FORMATOS §1 (sidecar .mrate), §2 (registro binario de bot), §3 (.dbo de organismo); Darwinbots2/Master.bas:472 (el autosave del original era .sim); wasm dbcore_api.cpp (db_sim_save_organism/db_sim_load_organism: el .dbo es lo que viaja por Internet Mode, no una descarga; «el sidecar .mrate no se exporta») -->

:::nota
The original spoke of `.sim` for the simulation (the port uses the same format
under another name, `.dbsim`) and of `.dbo` for an _organism_: a bot or a tied
group that is sent whole from one simulation to another. In the port the `.dbo`
exists, but it isn't a file you download: it is what travels through the classic
interface's Internet Mode teleporter. Inside the `.dbsim` and the `.dbo` goes the
binary bot record, which was never a separate file. And each species' mutation
rates, which the original saved in a `.mrate` next to the bot, here travel inside
the `.dbsim` itself: the port doesn't use that file.
:::

## What to back up {#respaldo}
<!-- engine/corridas.js (MAX_CORRIDAS = 20: se conservan las últimas 20 corridas y las marcadas); app/tus-datos -->

The practical rule: export often what is cheap to export and expensive to lose.

- **Your bots** (the library's `.json`) and **your tournaments**: they are small
  and worth years of work.
- **The runs you care about**, with **Download .dbsim** before the 20-run policy
  pushes them out.
- **Your scenarios** and the **reports** you want to keep.

Everything else gets generated again. How to do it, and what makes you lose
the browser's data, is in [[app/tus-datos]].
