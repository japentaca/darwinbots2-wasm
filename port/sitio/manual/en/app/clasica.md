---
titulo: The classic interface
resumen: "The port's first web page, at /classic/: what it is, what it has that the new app doesn't (Internet Mode, skins, RGB monitor, the original's charts), how to seed, save and set up tournaments, and how to move your data to the app."
etiquetas: [classic, interface, internet mode, inventory, lab]
estado: revisada
---
The **classic interface** is the first web page the port had, before the current
app. It lives at `/classic/` and opens from the **Classic interface** link in the
app's top bar. It runs the same engine, so the simulation is identical. What
changes is how you use it: a single page with the world, a button bar and a long
side panel, close to how the original program was.

<!-- PLAN.md decisión 5 (congelada en /classic/, comparte el wasm); web2/src/lib/BarraSuperior.svelte (app.clasica.enlace); port/README.md «Página web» -->

Two things to know before opening it:

- **It is in English**, like the original program. This page names each control
  by its English text and explains what it does.
- **It is frozen.** It gets no new features: new things go into the app. It stays
  for those who prefer the original's layout and for what the app doesn't have yet.

<!-- README: «La interfaz de la página está en inglés desde el 2026-09-26» -->

## What it has that the app doesn't {#solo-clasica}
<!-- PLAN.md decisión 5 (excluidos a propósito: monitor RGB, skins, imagen de fondo, ventanas de gráfico posicionadas y .gsave), C22 (Internet Mode → E13); web/index.html view-toggles, Graphs, View menu (extras), im-panel -->

| Feature | Where it is in the classic interface |
|---|---|
| **Internet Mode**: sending and receiving organisms between simulations | **Internet** panel → **Internet Mode** |
| **Skins**: the silhouette the DNA gives each bot | The **skins** checkbox on the bar |
| **RGB monitor**: colors each bot according to three positions of its memory | The **RGB monitor** checkbox and **Settings for RGB Memory Monitor...** |
| Your own **background picture** behind the field | **Import Background Picture** / **Remove Background Picture** |
| The original's **18 chart series**, in floating windows, with three customizable queries and the `.gsave` dump | **Recording and analysis** → **Graphs (18 series)** |

Internet Mode will come to the app when the site has a server to connect the
simulations. The rest was left out on purpose: the app has its own charts, with
CSV export (see [[app/analizar]]).

Everything else also exists in the app, in another form: the inventory is the
[[app/bots|Library]], the hybrid lab is a panel of the
[[app/editor|DNA editor]], tournaments are in [[app/competir]], and the eye
designer, the bot console and player mode are in the
[[app/inspector|inspector]].

## The top bar {#barra}
<!-- web/index.html <header>: btn-run, btn-step, btn-reset, btn-tournaments, btn-tv, speed, seed, view-toggles, view-mode, lens, btn-cam, btn-save, btn-load, btn-teleporter, stats; btn-fs -->

| Control | What it does |
|---|---|
| **▶ Start** / **⏸ Pause** | Runs or pauses the simulation. |
| **Step** | Advances one cycle. |
| **Reset** | Starts a new simulation with the panel's options and the seed from **Seed**. |
| **🏆 Tournaments** / **📺 TV** | The tournaments window (see [[app/clasica#torneos|below]]). |
| **Speed** | Cycles per frame: from 1 to 32, or **max** (as fast as possible). |
| **Seed** | The seed of the new simulation. |
| **impacts**, **vision**, **vectors**, **gauges** | What is drawn over the field: impacts, vision, vectors and gauges. |
| **skins**, **RGB monitor** | See the table above. |
| **Player Bot** | The focus bot aims at the pointer; arrows = motor, space = shoot. |
| **View** | **Classic** (the original's drawing) or **Enriched** (shape, color and action rings), with **Color by** to pick what gets colored. |
| **⤢** | Puts the camera back at zoom 1, with no offset. The wheel zooms in and dragging pans. |
| **Save sim** / **Load sim** | Downloads the simulation as a `.dbsim` or loads one. |
| **+ Local teleporter** | Adds a teleporter to the world. |

On the right, the bar shows cycles per second, frames per second and drawing
time. The **⛶** button over the field puts it full screen; **Esc** exits. A click
on a bot selects it and shows it in **Bot inspector**, with its DNA and the
**follow** checkbox so the camera follows it.

## The world on opening {#al-abrir}
<!-- web/index.html onReady → newSim (alga de arranque PRESETS.alga, qty 15); OPT_GROUPS (Costs def 0); o-fw/o-fh 32000; seed 1234 -->

On opening, the classic interface starts a 32000 × 32000 world with seed 1234 and
15 algae (Alga Minimalis) as vegetables. There are no animals: you seed them.

:::cuidado
In the classic interface **costs start at 0**: bots spend no energy when moving,
shooting or running their DNA. For a world with costs, load the league ones with
**F1 settings** or set them by hand in the **Costs** group. What each cost is:
[[simulacion/energia]].
:::

## Seeding a species {#sembrar}
<!-- web/index.html «Seed species»: preset, dna, sp-name, sp-color, sp-veg, sp-qty, sp-nrg, btn-seed, seed-lint; showSeedLint -->

The **Seed species** panel, at the end of the right column:

1. In the list, pick **Animal Minimalis**, **Alga Minimalis (veg)** or **— Custom
   DNA —**. With the last one, paste your DNA into the text box.
2. Fill in **Name** and the color.
3. Check **vegetable** if it is a vegetable, and set the number in **qty** and the
   starting energy in **nrg** (5 and 3000 by default).
4. Click **Seed**. The bots appear in the running world, without restarting it.

If the DNA has words the engine doesn't recognize, the classic interface seeds it
anyway and shows the warnings under the button. It is the same analysis as the
app's [[app/editor|DNA editor]]; the most common warnings are in [[adn/errores]].

To seed bots from the Bestiary, use **📚 Inventory…** (see below).

## Saving and loading {#guardar}
<!-- btn-save → worker save → darwinbots-cycle<N>.dbsim; btn-load accept .dbsim,.sim -->

**Save sim** downloads the simulation as `darwinbots-cycleN.dbsim`, where _N_ is
the cycle. **Load sim** loads a `.dbsim`. It is the same format the app uses: a
file from one opens in the other (see [[tecnico/formatos]]).

The classic interface has no runs saved in the browser: to keep a world, download
it.

## Simulation options {#opciones}
<!-- web/index.html buildOptsPanel (Field and shape), OPT_GROUPS; applyF1Settings (F1_COSTS, F1_OPTS, F1_KEYS); README «Ajustes F1» -->

**Sim options** groups the parameters into collapsible sections: **Field and
shape**, **Physics**, **Light and day/night**, **Death and decay**, **Energy and
vegetables**, **Game modes (F1 / rounds)**, **Costs**, **Dynamic costs**,
**Restrictions** and **Shapes (vision and drift)**. They are the same parameters
the app shows in [[app/experimentar-avanzado]], where they are explained.

Most of them apply live. The field size, the vegetable economy and mutations apply
when you click **Reset**.

**F1 settings (league costs and field)**, in **Game modes**, loads the original's
F1 league settings: league costs, physics, light, vegetables, mutations off and a
9237 × 6928 toroidal field. Costs change right away; the field, the vegetables
and mutations, with the next **Reset**.

**Objects** adds shapes (**Shapes**), mazes (**Mazes**) and handles teleporters
(**Teleporters**).

## Inventory and lab {#inventario}
<!-- web/inventory.js (Bot inventory, filtros, group by, ficha: To the form / Seed / 🧬 Lab, Seed selection, Export/Import; IndexedDB darwinbots-inventario; invExport sin híbridos); web/lab.js (Hybrid lab: Available genes, by capability / from one bot, self-contained only, remap memory, Save, To the form, Seed) -->

**📚 Inventory…** opens the **Bot inventory** window with the Bestiary bots. You
can search and filter them by forum, archetype, size and capabilities (one click
requires the capability, another excludes it), group them with **group by** and
sort them. Each bot's profile shows its genetic profile and has **To the form**
(passes it to **Seed species**), **Seed** and **🧬 Lab**. You can also mark
favorites (★), add tags and notes and save named selections. **Seed selection**
seeds all the marked ones at once, with one color per species.

**🧬** opens the **Hybrid lab**, which builds a new DNA out of genes from
different bots. Genes are searched by capability across the whole Bestiary (**by
capability**) or you go through the ones of a single bot (**from one bot**). They
are ordered with ↑ and ↓, and the result can be saved (**Save**), passed to the
form (**To the form**) or seeded (**Seed**). With **remap memory**, if two bots
use the same own-memory address, the second one's is moved to a free one. To
understand why that is needed, see [[adn/memoria]].

## Tournaments {#torneos}
<!-- web/tournament.js (ventana 🏆 Tournaments: ⚡ Scratch, ＋ New, 💾 Save as tournament, 🗑, ⬇, ⬆; ⚙ Setup / ▶ Play; World rules: Load into the panel, Save the panel as rules, F1 preset, No-cost preset; Entrants; tn-drawmode; ▶ Play next, ✕ Abandon, 📅 New season, 📺 TV mode, Pause between fights); README «Torneos» -->

**🏆 Tournaments** opens a window with the same tournaments as
[[app/competir]]: the same six formats, seasons, Elo and Hall of Fame. The layout
differs:

- At the top you pick the tournament or the **⚡ Scratch** (the quick match, which
  isn't saved). **＋ New** creates one, **💾 Save as tournament** saves the Scratch,
  **⬇** exports and **⬆** imports.
- **⚙ Setup** has the format and the match values, the world rules and the
  entrants. In **World rules**: **F1 preset**, **No-cost preset**, **Save the
  panel as rules** (takes the **Sim options** panel just as it is) and **Load into
  the panel** (the other way around).
- **▶ Play** plays: **▶ Play next**, **✕ Abandon**, **📅 New season** and **📺 TV
  mode**, with **Pause between fights** in seconds.

The classic interface has no background rounds and no “Replay and analyze”: those
belong to the app.

## Internet Mode {#internet}
<!-- web/index.html im-panel (Nickname, Transport: Tabs of this browser / WebSocket relay, Relay, Room public, Connect/Disconnect Internet Mode, im-status, im-peers); worker.js imEnable (crea el puerto); README «Internet Mode (etapa E7)» -->

In the original, Internet Mode sent organisms from one simulation to others
through a special teleporter. In the classic interface it works like this:

1. Open **Internet** → **Internet Mode**.
2. Type a **Nickname**. It travels as the last owner of each organism that leaves;
   if left empty, one is drawn, “Newbie N”.
3. Pick the **Transport**:
   - **Tabs of this browser** connects tabs of the same browser. It needs no
     server.
   - **WebSocket relay** connects with other computers through a relay server,
     whose address goes in **Relay**. The site doesn't offer a public one yet.
4. Pick the **Room** (`public` by default): simulations in the same room see each
   other.
5. Click **Connect Internet Mode**.

When you connect, the simulation gains an Internet teleporter and the label
“Internet Mode” appears over the field. What enters that teleporter travels to
another simulation in the room, drawn from among the connected ones, and the
organisms that arrive come out through it. The panel shows the status, the peers
and the species of each one. **Disconnect Internet Mode** cuts the connection.

To try it without another computer, open the classic interface in two tabs,
connect both with **Tabs of this browser** in the same room and seed bots that
move. Teleporters are explained in [[simulacion/mundo#teleporters]].

## Your data in the classic interface {#datos}
<!-- inventory.js IndexedDB darwinbots-inventario (bots, sets, hybrids); league.js darwinbots-ligas; PLAN.md decisión 17 (la app copia, la clásica no se toca) -->

The classic interface stores the inventory (favorites, tags, notes and
selections), the lab hybrids and the tournaments in the browser, separate from
the app's. **Export** and **Import** of the inventory back up the marks and the
selections, but **not the hybrids**: those live only in the browser.

The app copies all of that the first time it opens, hybrids included, and after
that they are no longer synced. How to bring over later what you did in the
classic interface, and how to back everything up, is in [[app/tus-datos]].
