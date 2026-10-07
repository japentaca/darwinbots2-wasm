---
titulo: Observe
resumen: "The live world screen: layouts and tabs, the camera, full screen, time, the three views, the Live panel with its chart and its events, seeding, saving, snapshots, tournaments and the Player Bot."
etiquetas: [observe, camera, speed, views, seed, save]
estado: revisada
---
Observe is where you watch the simulation while it runs. It fills the screen in
three parts:

- **The world**, on the left: the field with the bots, the shots, the ties and
  the obstacles.
- **The side panel**, on the right, with tabs: **Live** (the run's figures),
  **Tournament** (only while a tournament is in progress) and **Bot** (the
  [[app/inspector|inspector]] of the bot you picked).
- **The bottom bar**: time, speed, the tools (seed, save, snapshots…) and the
  view.

If you enter Observe with no world in memory, the app starts the **Primordial
soup** scenario on its own with a new seed and sets it running. To pick another,
go to [[app/inicio]].

## Layouts and tabs {#disposiciones}
<!-- Observar.svelte (disposicion, pestaña); lib/observar/disposicion.js (DISPOSICIONES, pestañaTras, KV_DISPOSICION); i18n observar.disposicion.*, observar.lateral.*; PLAN-TORNEO-EN-CURSO.md TC3 -->

Three buttons on the bottom bar, to the left of **⛶**, share the space between
the world and the side panel:

| Button | What you see |
|---|---|
| **▣ Field** | the world alone, without the side panel |
| **◧ Mixed** | the world and the side panel (the usual one) |
| **▤ Data** | the panel at full width, and the world as a thumbnail in a corner |

The world is never hidden: in **Data** it keeps running in the thumbnail, and
you can click a bot or zoom there too. The app remembers the layout in this
browser. On a phone, **Data** leaves the world on top, shorter, and the panel
below.

The side panel has tabs. **Live** is the usual one. **Tournament** appears
while a [[app/observar#tv|tournament is in progress]] and opens by itself when
it starts. **Bot** shows the [[app/inspector|inspector]]: picking a bot jumps
to that tab, and letting it go returns to the previous one.

## The camera {#camara}
<!-- web2/src/lib/mundo/Mundo.svelte (alTeclear, alRodar, alMover, encuadrar); lib/mundo/camara.js (ZOOM_MIN 1, ZOOM_MAX 64); i18n/es/mundo.json mundo.aria, mundo.acercar… -->

At the start you see the whole field. To zoom in:

| What you want | With the mouse | With the keyboard |
|---|---|---|
| Zoom in | wheel forward (zooms toward the pointer) or the **+** button | `+` |
| Zoom out | wheel backward or the **−** button | `−` |
| See the whole field | the **[ ]** button (**Fit the whole field**) | `0` |
| Move around | drag the world (only when zoomed in) | the arrow keys |

The keyboard shortcuts work when the world has focus: click once on the field, or
get there with Tab. The zoom goes from 1 (the whole field) to 64 magnifications.
At the bottom left, a scale bar says how many world units it spans and the size
of the field.

At the top left, a label reminds you which view you're using (and the “color by”,
in the enriched view).

### Full screen {#pantalla}
<!-- Observar.svelte alternarPantalla (botón ⛶ de la barra, tecla F, Esc); i18n observar.pantalla.* -->

The **⛶** button, on the right of the bottom bar, or the `F` key put Observe
in full screen, without the bottom bar and with the chosen
[[app/observar#disposiciones|layout]]: with **▣ Field**, the field alone; with
**◧ Mixed** or **▤ Data**, the side panel too. `Esc` or **Exit full screen
(Esc)** go back to Observe as it was. Going in and out doesn't change the
simulation or the tournament being played.

## Picking and following a bot {#seleccionar}
<!-- Mundo.svelte alSoltar (clic = sesion.seleccionar), chip de foco (Seguir / Dejar de seguir / ×), efecto «acercar si hace falta» (z<2 → 4); i18n mundo.ayuda.clic, mundo.seguir, mundo.deseleccionar -->

A click on a bot picks it: it gets marked, the side panel jumps to the
**Bot** tab, with its [[app/inspector|inspector]], and the world draws its
trail and its nine eyes. A
click on an empty spot lets it go. While nothing is picked, the label says “Click
a bot to inspect it”.

With a bot picked, the label at the top left shows its number and its species,
plus two buttons:

- **Follow**: the camera stays with it. If you were far away, it zooms in on its
  own. Dragging the world, moving it with the arrows or fitting everything stops
  following it.
- **×** (**Clear the selection**): lets it go.

If the bot dies while you're watching, the inspector says so and keeps its last
data.

## Time {#tiempo}
<!-- web2/src/screens/Observar.svelte (barra); lib/sim/sesion.svelte.js VELOCIDADES [1,10,100,0], velocidad inicial 10; i18n mundo.iniciar, mundo.pausar, mundo.unCiclo, mundo.velocidad.* -->

The first three controls in the bar handle time:

- **Start** / **Pause**: starts or stops the simulation.
- **One cycle**: advances exactly one cycle. It's useful when paused to see, step
  by step, what a bot does (with the inspector open, the genes that ran update at
  every step).
- **Speed**: how many cycles the simulation runs for each frame it draws: **× 1**,
  **× 10** (the starting one), **× 100** or **Max**, which runs as fast as it can
  and draws when it gets the chance.

To the right of the bar, a counter says how many cycles per second the simulation
computes and how many frames per second it draws. With **× 1** you see every
cycle; with **Max** you let evolution move on without watching every step. What
happens in each cycle is in [[simulacion/ciclo]].

## The views {#vistas}
<!-- Observar.svelte selector «Vista»; lib/mundo/render-enriquecido.js (cabecera, ANILLOS, detalleBot, dibujarEventos), render-clasico.js (dibujarBotsClasicos, INDICADORES, flechas, dibujarVision); i18n mundo.vista.* -->

The **View** selector in the bar changes how the bots are drawn. It doesn't
change the simulation: only the drawing and some of the panel's data.

**Enriched** (the starting one). Each animal is a circle with a “nose” that marks
where it's facing; each vegetable, a hexagon. The hue is its species' color and
the brightness follows its energy: a dim bot is about to run out of everything. A
green tint gives away chloroplasts. When a bot does something, a brief colored
ring surrounds it (reproducing, shooting, making a tie, making defenses, gaining
energy…). As you zoom in, details appear: the thick rim of the shell, the halo of
the slime, blue spikes of venom and yellow ones of poison, an inner circle on the
ones that are part of a multibot, the eyes (the ones that see something, in
white) and the status (paralyzed, poisoned, infected). Births flash with a line
to the mother; the dead shrink and fade out, and one that leaves through a
teleporter leaves a cyan ring.

**Classic**. The original interface's drawing: circles in the species' color, a
line toward where it's facing, arrows with each bot's thrust and thin rings
showing its reserves (energy, body, waste, venom, shell, slime, poison, virus and
chloroplasts). It's the lightest.

**Outline**. Like the classic one, but the bots are just an outline, with no
fill. It helps you see what's underneath when they're piled up.

In all three, the picked bot shows its trail and its vision grid: nine cyan arcs,
the focus eye's in red (see [[simulacion/vision]]).

:::nota
Some data is only calculated in the enriched view: each species' name (in the
classic one they're grouped by color), extinctions, the highest generation, the
tooltip and the “color by”. The panel and the inspector tell you when it's
missing.
:::

### The tooltip {#tooltip}
<!-- Mundo.svelte actualizarTip; i18n mundo.tip.*, mundo.tipo.*, mundo.accion.* -->

In the enriched view, hovering over a bot brings up a brief card: its species,
its number, whether it's an animal, a vegetable or a corpse (and whether it's
part of a multibot), its energy, body and age, its generation, mutations, DNA
length, victims ([[.kills]]) and ties, and what it did in the last second.

### Color by {#color-por}
<!-- render-enriquecido.js LENTES; Mundo.svelte leyenda (RAMPA_CSS, rango min/max, mundo.lente.sinReferencia); i18n mundo.lente.* -->

In the enriched view, the **Color by** selector changes the bots' hue to show a
piece of data instead of the species:

| Option | What it paints |
|---|---|
| **Species** | each species' color (the usual) |
| **Energy (nrg)** | [[.nrg]] |
| **Body** | [[.body]] |
| **Generation** | how many generations are behind it |
| **Mutations** | how many mutations it has accumulated |
| **Age** | cycles of life |
| **DNA length** | how many instructions its DNA has |
| **Genetic distance** | how much its DNA differs from the picked bot's |

With any data that isn't the species, a legend appears with a color scale and the
minimum and maximum values among the living. **Genetic distance** is measured
against the picked bot; with no bot picked, the legend says so. The inspector has
a button that turns it on in one go ([[app/inspector#acciones]]).

## The Live panel {#en-vivo}
<!-- lib/observar/PanelVivo.svelte (VENTANA 1000, tarjetas); i18n observar.panel.*, observar.tarjeta.* -->

The **Live** tab of the side panel shows the current cycle and four cards:

| Card | What it says |
|---|---|
| **Live bots** | how many there are, and how much it has gone up or down in the last 1000 cycles |
| **Species** | how many are alive and how many have gone extinct |
| **Mean energy** | the average [[.nrg]] per bot |
| **Max. generation** | the highest generation among the living, and which species it's from |

### Population by species {#grafico}
<!-- lib/observar/GraficoPoblacion.svelte; metricas.js INTERVALO_MUESTRA 100, MAX_MUESTRAS 240 (al pasarse, una de cada dos e intervalo ×2), capasApiladas maxCapas 7 (más de 7: slice(0, 6) + otras); i18n observar.grafico.* -->

Below, a stacked area chart shows how many bots of each species there were over
the course of the run. It takes a point every 100 cycles, so it appears with the
second point. When the run gets long, it merges the points two by two so the chart
covers everything. With seven species or fewer it shows them all; with more, it
draws the six that reached the most bots and merges the rest into **Others**. The
legend says how many bots each one has now.

### Events {#eventos}
<!-- lib/observar/FeedEventos.svelte (max 40); detector-eventos.js (MIN_PICO 10, CAIDA_PICO 0.1, hitoGeneracion, especiesNuevas); i18n observar.evento.* -->

The **Events** list notes what's important in the run, the newest on top and with
its cycle:

- **what happens in the world**: a species going extinct, a population peak (of
  ten bots or more, noted once the population has already dropped), a record
  generation (each one up to the 10th, then every five up to the 50th and then
  every ten), a species arriving through a teleporter or a new species nobody
  seeded;
- **what you do**: a new run (with its seed), a seeding, a live parameter change,
  an order from the **World** bar, and every time you save, resume or open a file.

The **See full analysis** link opens [[app/analizar]] with a lot more: metrics,
species, the family tree and reports.

## Seeding {#sembrar}
<!-- lib/observar/DialogoSembrar.svelte (presets, elegirBot: 5 / 15 si vegetal, 3000; tope 500); corrida-nucleo.js sembrar (evento 'siembra'); i18n observar.sembrar.*, bots.selector.opcion -->

**Seed** adds bots of a species to the world that's running, without restarting
it. It's useful for dropping a predator into a quiet world, restocking a species
that went extinct or testing a new bot against the ones already there.

1. Click **Seed** in the bar.
2. Under **Bot**, pick where the DNA comes from:
   - **A bot from the library…**: look it up by name, file, tag or note. It takes
     its name, whether it's a vegetable, 5 copies (15 if it's a vegetable) and a
     color that isn't in use.
   - **Animal Minimalis (simple animal)** or **Alga Minimalis (vegetable)**: the
     usual two minimal bots.
   - **Paste the DNA…**: a box appears for pasting the code.
3. Check **Species name**, **Count** (from 1 to 500), **Starting energy** and
   **Color**, and tick **Vegetable (photosynthesizes)** if it applies (see
   [[simulacion/cloroplastos]]).
4. Click **Seed**.

The bots appear right away and the seeding is noted in **Events**. The seeded
species mutate at the factory rates, like the ones from the scenario (see
[[simulacion/mutaciones#quien-muta]]).

:::nota
The seeding is recorded in the run with its exact cycle: if you repeat the run
later, it's seeded again at the same moment. The same goes for the parameter
changes you make from [[app/experimentar]] and for the **World** bar's orders.
:::

## The World bar {#mundo}
<!-- lib/observar/objetos/BarraMundo.svelte; Mundo.svelte teclaBorrar (N, Mayús+N, Supr/Retroceso/Intro, Esc); i18n mundoObj.json -->

**World** opens, over the field, a bar for placing and removing obstacles and
teleporters while the simulation runs:

- **Size**: width × height of new shapes, as a fraction of the field (more than 0
  and up to 1).
- **Obstacle** adds a shape of that size at a random spot; **+10 random** adds
  ten; **−10 random** deletes ten.
- **Maze** adds the shapes of a maze: **Horizontal**, **Vertical**, **Spiral**,
  **Checkerboard**, **Polar** (drifting plates) or **Trash** (two walls that close
  in). **Corridor** and **Wall** set the width of the corridors and the thickness
  of the walls.
- **Teleporter** adds one at a random spot, up to the maximum the engine allows.
- **Delete** turns on delete mode: a click on a shape or a teleporter removes it.
  With the world focused, `N` and `Shift+N` step through the objects, `Delete`
  removes the highlighted one and `Esc` leaves the mode.
- **Delete all** removes **All shapes** or **All teleporters**, after asking.
- **Save to scenario** passes the current objects to the run's scenario, so that
  [[app/experimentar]] shows them and a new run places them again. A run opened
  from a file has no scenario to save them to.

Every order is recorded in the run and repeated on the same cycle when you repeat
it. How obstacles affect the bots is in [[simulacion/mundo]].

## Saving and resuming {#guardar}
<!-- revisor: engine/corridas.js MAX_CORRIDAS 20; marcar() existe en el motor pero ningún control de la app lo usa, por eso no se nombran las «marcadas» -->
<!-- lib/observar/DialogoGuardar.svelte, DialogoCorridas.svelte; Observar.svelte guardar/cargar/abrirArchivo/puedeDescartar; i18n observar.guardar.*, observar.corridas.*, observar.aviso.* -->

**Save** opens a dialog with a **Name** and these options:

- **Save in the browser**: saves the run in this browser, with its scenario, its
  seed and its events. The last 20 runs are kept; if you go over, the oldest are
  deleted and the app tells you how many.
- If the run was already saved, the button says **Update the saved run** and
  **Save as new** appears, which leaves a separate copy without touching the
  other.
- **Download .dbsim**: downloads the simulation's complete state to a file, to
  take it to another computer or share it.

**Runs** opens the list of what's saved, with a thumbnail, the cycle, the bots and
the date of each one. **Resume** loads it paused (click **Start** to go on),
**Delete** removes it and **Open a .dbsim file…** loads one from your computer.
The one that's loaded carries the **current** mark.

If the run on screen has unsaved changes, resuming another or opening a file asks
you before discarding them. What each format saves is in [[tecnico/formatos]];
where what you saved ends up, in [[app/tus-datos]].

## Find the best {#mejor}
<!-- Observar.svelte buscarMejor; engine/sim.js 'findbest' → api.fittest; core database.hpp SnapshotFitness (intFindBestV2); opciones.js opt:96 -->

**Find the best** picks the simulation's fittest bot and opens its inspector.
Fitness combines its offspring with its energy and its body; how much each part
weighs is set by the parameter [[param:opt:96]]. Vegetables don't count: if there
are only vegetables, the app warns that there are no candidates.

## Snapshot {#instantanea}
<!-- lib/observar/MenuInstantanea.svelte; inspector/veterano.js ARCHIVOS_MUERTOS, archivosVivos; opciones.js opt:111, opt:112; i18n observar.snp.* -->

The **Snapshot** menu downloads data from the run to your computer:

- **World image (PNG)**: the field as it looks right now.
- **Snapshot of the living (.snp)**: a record of each living bot, with its DNA, its
  generation, its mutations, its offspring and its fitness. With **With the
  mutation details** ticked, it also downloads a `_Mutations.txt` with each one's
  mutation history.
- **Record of the dead**: with **Record dead bots** turned on, the simulation
  keeps a record of each bot that dies; **Without vegetables** leaves the
  vegetables out. The menu says how many records it has accumulated;
  **Download** downloads them (`DeadRobots.snp` and `DeadRobots_Mutations.txt`)
  and **Reset** deletes them.

The two record-of-the-dead checkboxes are the parameters [[param:opt:111]] and
[[param:opt:112]], and clicking them is a live change: it's noted in the run.
During an F1 match they can't be changed. The `.snp` format is in
[[tecnico/formatos]].

## Player Bot {#jugador}
<!-- lib/observar/IndicadorJugador.svelte; lib/inspector/jugador.svelte.js; i18n observar.pb.* -->

From the inspector's **Control** tab you can drive a bot with the keyboard and
the mouse (see [[app/inspector#control]]). While the mode is on, an indicator
over the world says **Player Bot on** and whom you're controlling, with an
**Exit** button (or `Esc`). If no bot is under control, a click on one takes it.

What you do in this mode isn't kept in the run: when you repeat it, it isn't
repeated.

## Tournaments {#tv}
<!-- Observar.svelte (auto, bloqueado); lib/observar/tv/ (RotuloTv, PeleaTv, tv.svelte.js: pararTv, abandonarPelea, alTerminar; avance.js; FranjaTorneo.svelte: reanudarTv); i18n observar.tv.*, observar.auto.bloqueado; PLAN-TORNEO-EN-CURSO.md TC1 y TC2 -->

A tournament's fights are played in Observe: you start them with **▶ Play** in
[[app/competir#jugar]]. Before each fight, a break screen announces who fights
whom. During the fight the score is shown. When it ends, a short pause shows
the winner, and when the season closes, the champion.

Above the field are the tournament, the edition and the controls:

- **Break (s)**: the seconds of pause between fights (from 0 to 60).
- **When the fight ends**: what the tournament does when each fight ends. With
  **stop** it plays only that one; with **go on until the end of the season** it
  goes on until it announces the champion; with **go on with new editions** it
  then goes on with another edition, with a new draw, in a loop. It can be
  changed while playing.
- **Stop when the fight ends**: the fight in play goes on and is recorded; then
  the tournament doesn't advance any further. While it waits, **Keep going**
  cancels it. If no fight is in play (during the break screen, for example), the
  button says **Stop** and stops right away.
- **Abandon the fight**: cuts the fight in play without recording it, after you
  confirm, and the tournament stops advancing.

While the tournament lasts, the **Tournament** tab of the side panel shows the
tournament and how much of the season is left, the fight with its score (or,
between fights, the next one, the champion or the error that stopped it), the
season standings and the latest results, and links to the tournament in
Compete. With **▤ Data**, the standings are the full ones from Compete, and
below them is the structure of the format (the matchdays, the cup bracket, the
Swiss rounds…), read-only.

With **▣ Field**, without a panel, the fight card goes over the field, at the
bottom right: `M` hides or shows it, to watch with nothing on top. With
**▤ Data**, the thumbnail field doesn't carry the break screen or the
controls: you follow the fight in the **Tournament** tab, and **When the fight
ends**, **Stop** and **Abandon the fight** are on the
[[app/observar#franja|tournament strip]].

While the tournament advances, **Seed**, **World** and **Runs** are disabled: a
fight's world can't be changed. If you open another tournament in Compete, the
tournament stops advancing.

### The tournament strip {#franja}

The tournament goes on even if you go to another section. While it lasts, a
strip below the top bar shows, on every screen, the tournament, the edition,
how much of the season is left and what's happening: the break screen,
**LIVE**, the winner. It has **Watch**, which brings you to Observe, **When the
fight ends** and the same buttons to stop or abandon the fight.

If you reload the page with a tournament in progress, the fight that was being
played is cut off and isn't recorded. The tournament doesn't resume on its own:
the strip offers **Resume**, which goes on from the next fight, or **Dismiss**.

## If something goes wrong {#avisos}
<!-- Observar.svelte aviso (no error: 6 s); i18n observar.aviso.*, mundo.errorCarga.* -->

Notices appear over the bottom bar. The informational ones (run saved, run
resumed, DNA words that aren't recognized) go away by themselves after a few
seconds; errors stay until you close them with **✕**. If the simulation engine
doesn't load, check your connection and reload the page. If the browser runs out
of space to save, delete old runs from **Runs**.
