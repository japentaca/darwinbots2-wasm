---
titulo: Your data
resumen: "Where the app keeps your bots, runs, scenarios, tournaments and settings, how to export and import them again, how to delete them, and what makes you lose them."
etiquetas: [data, backup, export, import, browser]
estado: revisada
---
The app has no accounts and no server: **everything of yours is saved in your
browser**, on the computer you are using. That is convenient, because there is
nothing to sign up for, but it has a consequence: if that browser loses its
data, the app loses it too. This page explains what is saved, how to take a
copy and how to bring it back.

<!-- web2/engine/almacen.js (base darwinbots2, STORES); PLAN.md decisión 17; inicio.nota -->

## What is saved and where {#que-se-guarda}
<!-- engine/almacen.js STORES: bots, escenarios, corridas, corridas-datos, informes, torneos, partidos, trabajos, ajustes; engine/bots.js (selecciones en ajustes); engine/corridas.js (política de 20); lib/trabajos/ejecutores.js (replicas, barrido, ronda, prueba); claves de localStorage darwinbots2.tema, .idioma, .experimentar.modo, .trabajos.tope, .pb.teclas, .analizar.panel, cortinilla en tv.svelte.js KV_PAUSA -->

| What | Where you create it | Detail |
|---|---|---|
| **Your own bots** | [[app/bots]], [[app/editor]] | Each bot with all its versions. |
| **Marks** | [[app/bots#marcas]] | Favorites, tags and notes, also on forum bots, and the named selections. |
| **Your own scenarios** | [[app/experimentar]] | The ones you saved with **Save as scenario**. |
| **Saved runs** | [[app/observar]] | The world, its scenario, its seed, its events, the metrics history and the lineage. The last 20 are kept. |
| **Reports** | [[app/informes]] | The reports you generated. |
| **Tournaments** | [[app/competir]] | Rules, entrants with their DNA, seasons and all the matches. |
| **Jobs** | [[app/informes#trabajos]] | Replicates, sweeps, tournament rounds and editor tests in the background, with their results. |
| **Preferences** | the whole app | Theme, language, basic or advanced mode, the workers cap, the TV mode curtain and other interface choices. |
| **Editor drafts** | [[app/editor]] | The unsaved changes of a DNA, so they survive a reload. |

The forum bots (the Bestiary) are **not** yours: they come from the site and are
loaded every time. The only thing of yours about them is your marks.

The policy for runs is this: when you save one, if there are more than 20, the
oldest are deleted. If a run matters to you, download it (see below).

## What it depends on {#dominio}
<!-- PLAN-SITIO.md S3 (los datos dependen del dominio); S1 (/app/ y /classic/ en el mismo dominio); engine/migracion.js (mismo origen) -->

The browser stores data **per site**: what you saved on `darwinbots-wasm.org` is
only seen by the app opened from that same address, in that same browser and
with that same user profile. So:

- **Another browser or another computer** starts out empty. Chrome does not see
  what is in Firefox, and your laptop does not see what is on your desktop PC.
- **Another address** also starts out empty. Always use the same one.
- **A private or incognito window** saves while it is open and deletes it all
  when you close it. In some browsers it does not let you save anything, and the
  app warns you that it cannot save data.
- **Clearing the browsing data** (cookies and site data) for the site, or for
  all sites, deletes everything of yours. It cannot be undone.

The [[app/clasica|classic interface]], at `/classic/`, is on the same site and
saves in its own space. The app copies that data the first time it starts (see
[[app/tus-datos#clasica|below]]).

:::cuidado
If you used the app from another address (for example, the earlier version
published on `github.io`), what you saved there does not move on its own to
`darwinbots-wasm.org`. You can only bring it over if you exported it from there.
:::

## Export: taking a copy {#exportar}
<!-- bots.menu.exportar (Biblioteca.svelte ⋯); experimentar.exportar (Experimentar.svelte exportar(): el borrador); observar.guardar.descargar; informes.descargar; competir.lista.exportar -->

There is no button to back everything up at once: each thing is exported from its
own screen.

| What | How | File |
|---|---|---|
| Your own bots and marks | In **Bots**, the **⋯** button → **Export my bots and marks (.json)** | `.json` with all your bots (with their versions), favorites, tags, notes and selections |
| A scenario | In **Experiment**, with the scenario open, **Export** | `.json` of the scenario you are editing |
| A run | In **Observe**, **Save** → **Download .dbsim** | `.dbsim` with the world at that cycle |
| A report | In Analyze → Reports, **Download .html** | self-contained `.html`, opens offline |
| A tournament | In **Compete**, with the tournament open, **Export** | `.json` with rules, entrants and matches |

A few things worth knowing:

- **The scenario carries the DNA of your bots**: a species that comes from one of
  your own bots travels with its DNA inside the file. Forum ones go by name and
  are looked up in the Bestiary.
- **The `.dbsim` is the world, not the whole run.** It holds the bots, their DNA
  and the state of the simulation, in the same format as the classic interface.
  The metrics history, the events and the scenario of a saved run stay in the
  browser. To download a run you already saved, resume it and download it from
  **Save**.
- **The tournament carries the entrants' DNA** as it was frozen when they were
  entered, so it can be imported in another browser without having those bots.
- Compete's quick match is neither saved nor exported: save it first as a
  tournament.

Formats of each file: [[tecnico/formatos]].

## Import: bringing a copy back {#importar}
<!-- bots.menu.importar (acepta darwinbots2-biblioteca y darwinbots-inventario); experimentar.importar (importarEscenario: id ocupado → id nuevo); inicio.corridas.importar, observar.corridas.abrir; competir.lista.importar (nombre «(importado)») -->

1. Open the app in the browser where you want the data.
2. Import each file from its own screen:
   - **Bots**: **⋯** → **Import library (.json)…**. It adds without deleting: new
     bots are added, those already there receive the new versions, and a name
     that clashes is changed. It also accepts the inventory exported from the
     classic interface. Details in [[app/bots#importar]].
   - **Scenarios**: **Experiment** → **Import .json**. If you already have one
     with the same identifier, the imported one comes in as a new scenario,
     without overwriting yours.
   - **Runs**: **Import .dbsim** in [[app/inicio]], or **Runs** →
     **Open a .dbsim file…** in Observe. The world is loaded; for it to be in
     the list, save it with **Save**.
   - **Tournaments**: **Compete** → **Import .json**. It comes in as a new
     tournament, with “(imported)” if the name already existed.
3. Read the notice each import leaves: it says what came in, what was already
   there and what could not be read.

## The classic interface's data {#clasica}
<!-- PLAN.md decisión 17; engine/migracion.js; bots.migracion.*; competir.migracion.*; competir.hofViejo.*; bots.menu.clasica -->

The first time you open the app, it **copies** what you have in the classic
interface in the same browser: the inventory (favorites, tags, notes and
selections), the lab hybrids, which become your own bots, and the tournaments.
The classic interface is not touched: it keeps its data, and what you do in one
does not show up in the other.

If you kept using the classic interface afterwards, **Import from the classic
interface** (in Bots, the **⋯** button) copies the inventory and the hybrids
again, without duplicating what was already there. New tournaments from the
classic interface are brought over by exporting them there (**⬇**) and importing
them in Compete.

The Hall of Fame of the classic interface's old F1 channel has no match history
and cannot be added to a tournament. If the app finds it, it offers to
**Download it** as a file or **Discard it**.

## Delete {#borrar}
<!-- bots.confirmar.borrarBot; experimentar.borrar.*; observar.corridas.borrar; informes.borrar; competir.torneo.borrar; comparar.trabajos.borrar -->

Each thing is deleted from its own screen and the app asks for confirmation:

- one of your own bots, from its profile (**Delete**), with all its versions;
- one of your own scenarios, in Experiment (**Delete**); the built-in ones cannot
  be deleted;
- a run, in Observe's list of runs (**Delete**);
- a report, in Analyze → Reports (**Delete**);
- a tournament, with its matches, in Compete (**Delete**);
- a job and its results, in Compare (**Delete**).

None of these actions can be undone. To start over completely, clear the site's
data from your browser's settings; first, export whatever you want to keep.

## When something fails {#problemas}
<!-- competir.almacen.*, experimentar.error.cuota, *.sin-indexeddb -->

- **“Another tab opened a newer version of the database”** or **“Another tab
  with an older version is blocking the database”**: the app was updated and an
  old tab was left open. Close it or reload all of them.
- **“This browser does not allow saving data”**: you are in a private window or
  the browser blocks the site's storage. The app works, but it saves nothing.
- **“There is no space left to save data in this browser”**: delete runs or
  reports you do not use. Long runs take up the most space.

:::nota
A healthy habit: every so often, export your bots and your tournaments and keep
the files outside the browser. They take up little space and save you from an
accidental deletion.
:::
