---
titulo: "Bots: library and profile"
resumen: "The Bots section: the library with the forum bots and your own, how to search, mark and seed them, and each bot's profile with its summary, its DNA and its history."
etiquetas: [bots, library, bestiary, profile, seed, tags]
estado: revisada
---
The **Bots** section of the top bar is your collection of bots. On the left is
the **Library**, with all the bots you can use; on the right, the profile of the
bot you picked. From here you create new bots, copy forum bots to modify them,
seed them into a simulation and enter them in tournaments.

If you haven't picked one yet, the right side invites you to: “Pick a bot from
the library to see its summary, its DNA and where it took part”.

## Two kinds of bots {#clases}
<!-- web2/src/lib/bots/Biblioteca.svelte (meta: bots.fila.foro / bots.fila.propio); engine/biblioteca.js; port/web/bots/bots.json (684 bots, campo board); PLAN.md decisión 18 -->

The library gathers two kinds of bots:

| | From the forum (the Bestiary) | Your own |
|---|---|---|
| Where they come from | The 684 bots published on the DarwinBots forum and wiki, which come with the app | The ones you create, duplicate or import |
| Can be edited | No: they are read only | Yes, and each saved change is a new version |
| The list shows | The source forum and the genes (`F1 bots · 6 genes`) | `mine`, the version and the genes (`mine · v3 · 4 genes`) |
| Capability profile | Yes, computed in advance | No |
| Where they are stored | They come with the app | In this browser |

To change a forum bot you have to duplicate it: the copy is yours and you can
edit it without touching the original (see [[app/bots#duplicar|Duplicate]]).

Your own bots and everything you mark (favorites, tags, notes, selections) are
stored in this browser. To move them to another computer or to have a backup,
export them (see [[app/bots#importar|Import and
export]] and [[app/tus-datos]]).

## Search and filter {#buscar}
<!-- web2/src/lib/bots/Biblioteca.svelte; i18n/es/bots.json bots.buscar*, bots.modo.*, bots.agrupar.*, bots.orden.*, bots.filtros.* -->

Above the list you have, from top to bottom:

- **The search box** (“Name, file, tag or note”). It filters as you type and also
  searches your tags and your notes.
- **All / Favorites / Mine**: a shortcut to see the whole library, only your
  favorites or only your bots.
- **Group by**: builds the list by **archetype** (the default), **forum**,
  **capability**, **tag**, **size**, **favorites**, **forum or mine**, or **No
  grouping**. Each group collapses with a click on its title and has a checkbox
  to pick the whole group.
- **Filters**: a dropdown with more controls. When any is set, the title counts
  them (“Filters (2)”).

Inside **Filters**:

| Control | What it does |
|---|---|
| **Forum** | Only the bots of one forum (F1 bots, Veggies, Multi-Bots…). |
| **Archetype** | Multicellular, vegetable, predator, defensive or passive. |
| **Size** | Small (up to 5 genes), medium (6 to 20), large (21 to 60) or huge (more than 60). |
| **Tag** | One of your tags, or “(no tags)”. |
| **Sort by** | By name, by number of genes or by number of capabilities. |
| **Picked only** | Leaves in the list only the bots you marked. |
| **Capabilities** | One chip per capability, with how many bots have it. |

Capability chips have three states. One click **requires** it (a `+` appears:
only the bots that have it remain), another **excludes** it (a `−`: the ones
that don't have it remain) and a third takes it out of the filter. That way you
can ask, for example, for bots that reproduce sexually and don't use venom.

**Clear filters** puts everything back to zero.

At the bottom of the list you see how many bots remain (“120 of 684 bots”) and
how many you have picked.

:::nota
The archetype, the size and the capabilities come from the Bestiary profile, so
those filters only find forum bots. Your bots have no profile.
:::

Some forum files have exactly the same DNA. When that happens, the footer shows
an ⓘ that explains it: those files share favorite, tags and notes, and are
picked together.

## Favorites, tags and notes {#marcas}
<!-- Biblioteca.svelte (alternarFav, tagASeleccion, favASeleccion); Resumen.svelte (notas onblur, tags); i18n bots.sel.*, bots.resumen.notas*, bots.resumen.tag* -->

There are three ways to mark a bot, so you can find it later. They work the same
for forum bots and for yours:

- **Favorite**: the star ☆ next to the name, in the list or in the profile. One
  click turns it on (★) and another turns it off.
- **Tags**: free words (`#cazador`, `#probar`, `#torneo-mayo`). You add them in
  the profile, with **+ tag**, and remove them with the × on each one.
- **Notes**: free text in the profile. It is saved on its own when you leave the
  field.

## Picking several bots {#elegir}
<!-- Biblioteca.svelte pie (bots.sel.*), selecciones con nombre (bots.seleccion.*, bots.confirmar.pisarSeleccion) -->

Each row has a checkbox. The picked bots can be marked, seeded or saved together
with the buttons at the bottom of the library:

| Button | What it does |
|---|---|
| **Pick visible** | Picks all the ones the current filter lets you see. |
| **None** | Unpicks everything. |
| **★** | Marks the picked bots as favorites. |
| **+ tag** and **− tag** | Add to or remove from all the picked bots the tag you type in the **Tag…** field. |
| **Seed batch** | Opens the seeding dialog with all the picked ones (see [[app/bots#sembrar|Seed]]). |
| **Save selection** | Saves the picked ones under a name. |

Saved selections appear at the top, next to **Selections:**, with their name and
how many bots they have. A click on one picks those bots again; the × deletes it
(the bots are not touched). If you save one under a name that already exists, the
app asks whether you want to replace it.

Selections are useful for putting together the lineup of an experiment or a
tournament and coming back to it with one click.

## A bot's profile {#ficha}
<!-- web2/src/lib/bots/Ficha.svelte (cabecera, acciones, pestañas); ruta.js (#/bots/<nombre>/adn, …/historial) -->

When you pick a bot in the list, its profile opens. At the top are the name and a
line of data: whether it is your own and where it came from (“copy of…”,
“imported”), the forum, whether it is a vegetable, the archetype, the number of
genes and instructions, the version and, for forum bots, a link to the **forum
topic** where it was published.

Next to it, the profile's buttons:

| Button | What it does |
|---|---|
| **Seed** | Puts it into a simulation (see [[app/bots#sembrar|Seed]]). |
| **Duplicate** (or **Duplicate to edit**, for forum bots) | Creates a copy of your own. |
| **Enter in a tournament** | Enters it in the quick match or in a tournament (see [[app/bots#torneo|below]]). |
| **Details** | Only on your own: changes the name, whether it is a vegetable and the description. |
| **Delete** | Only on your own: deletes it with all its versions, after asking you. It can't be undone. |
| ☆ | Favorite. |

Underneath there are three tabs: **Summary**, **DNA** and **History**. The **?**
next to them opens in the manual the page for the tab you are looking at
([[app/bots]] or the [[app/editor|editor]]).

## Summary {#resumen}
<!-- web2/src/lib/bots/Resumen.svelte; adn.js (descripcionAdn, leeYEscribe: lectura del texto sin compilar); etiquetas.js; profiles.json -->

The summary tells you what the bot is without having to read the DNA:

- **Description.** The one you wrote in **Details** or, if there isn't one, the
  comments the DNA starts with. That is why it is a good idea to open your bots
  with a couple of lines of comments explaining what they do (see
  [[adn/estructura]]).
- **Capabilities.** For forum bots, the archetype and the list of things it does,
  grouped into Movement, Attack, Defense, Energy, Social, Reproduction,
  Multicellular, Senses and Genome. Hovering over a capability shows what it
  means. **Capabilities per gene** breaks them down gene by gene. Your own bots
  don't have this profile.
- **What it reads and writes.** The sysvars the DNA reads (written as
  `*.name`), the ones it writes (`.name` followed by `store`, `inc` or `dec`)
  and, if it shoots, of what type: “−1 steals energy”, “−3 venom”, “−8 sperm” and
  the rest of those in [[.shoot]].
- **Notes** and **Tags** (see [[app/bots#marcas|above]]).
- **Versions**, only on your own: the table with each saved version, its date, its
  note and its hash. **Go back to this** recovers an old version _by saving it as
  a new version_: none is lost.
- **Details**: the DNA hash, the file (for forum bots), the number of genes and,
  for your own, when it was created.

:::nota
“What it reads and writes” comes from reading the text, not from running the bot.
If the DNA builds an address with a calculation (for example, with [[op:*]] or
with a number instead of the name), that read or write doesn't show up. The same
goes for shots: only the ones written as a number right before `.shoot store` are
listed.
:::

## DNA {#adn}
<!-- Ficha.svelte → editor/Editor.svelte -->

The **DNA** tab is the editor: the bot's text with colors, the warnings about what
the engine will read differently than it looks, the gene-by-gene view, the panel
to **Test** the bot and the **Lab** to add genes from the Bestiary to it.
All of that is in [[app/editor]].

On forum bots the text can be read and tested, but not modified.

## History {#historial}
<!-- web2/src/lib/bots/Historial.svelte; engine/biblioteca.js historialBot (cruce por el hash de TODAS las versiones del propio; los del foro también por nombre y archivo) -->

The history gathers everything you did with the bot in this browser, in three
tables:

- **Runs**: the saved simulations where it took part, with the date and the name
  of the species it had (“As”). **Analyze** opens that run in [[app/analizar]].
- **Tournaments**: each tournament where it was entered, with its result (“5 won
  of 8 matches · 2 seasons”) or the **quick match** mark. **View** opens it in
  [[app/competir]].
- **Quick tests**: every time you used **Test** in the editor, with its status
  (pending, running, done, failed or cancelled).

The bot is recognized by its DNA hash, that of any of its versions. If you seeded
the same DNA in a run under another name, it shows up too.

## Creating a new bot {#nuevo}
<!-- Biblioteca.svelte crearNuevo; DialogoBot.svelte (modo nuevo); adn.js ADN_NUEVO = 'cond\nstart\nstop\nend\n'; i18n bots.datos.*, bots.error.nombre-*, bots.confirmar.nombreForo -->

1. In the library, click **+ New bot**.
2. Type the **Name**. Check **It is a vegetable (photosynthesizes)** if it is
   going to live off light (see [[simulacion/cloroplastos]]).
3. If you want, type a **Description**.
4. **DNA** comes with an empty gene. You can leave it like that or paste a whole
   DNA, for example the one from a `.txt` you have.
5. Click **Create**. The app opens the bot in the DNA tab, ready to edit.

The empty gene it starts with is this one:

```adn
cond
start
stop
end
```

There can't be two of your own bots with the same name. If you pick the name of a
forum bot, the app warns you that in scenarios and runs the two will be told apart
only by their source, and lets you use it anyway with **Use that name anyway**.

The **Open in the app** button on the DNA blocks of this manual uses the same
dialog: it opens the app at the address `#/bots/nuevo?adn=…` with that DNA already
loaded, and you only pick the name.

## Duplicate {#duplicar}
<!-- Ficha.svelte duplicar (DialogoNombre: bots.duplicar.*); Editor.svelte duplicar (editor.duplicar.*) -->

**Duplicate** creates a copy of your own of the bot, with the same DNA. It is the
way to modify a forum bot and also to try a variant of one of yours without
touching the original.

1. In the profile, click **Duplicate** (on forum bots it says **Duplicate to
   edit**).
2. Type the **Name of the copy**, or leave it empty: the app uses the same name
   with a number.
3. Click **Duplicate**. The copy opens in the DNA tab.

The copy remembers where it came from: in its profile it says “copy of” and the
name of the original.

## Seed {#sembrar}
<!-- DialogoLote.svelte; lote.js (LOTE_INICIAL cantidad 5, cantidadVeg 15, energia 3000; CANTIDAD_MAX 10000; CANTIDAD_AVISO 500; ENERGIA_MAX 32000) -->

**Seed** (in the profile) and **Seed batch** (with several picked) open the same
dialog. First you define how each species enters:

- **With one bot**: the **Species name**, the **Color**, the **Number of bots** (5
  by default, 15 if it is a vegetable), the **Starting energy** (3000) and whether
  it enters as a **Vegetable (photosynthesizes)**.
- **With several**: the list of chosen bots, the **Bots per species** (5), the
  **Bots per vegetable species** (15) and the **Starting energy**. Each bot is a
  species; if two have the same name, the app renames one and tells you.

More than 500 bots per species is a lot and the app warns you, but it seeds them
anyway.

Then you pick where they go:

| Option | What it does |
|---|---|
| **Seed into the current run** | Adds the species to the world that is running in [[app/observar]]. Each seeding is recorded as an event of the run. If none is open, the button is off and **Go to Observe** appears. |
| **New scenario with these** | Creates a scenario of your own with those species in the default world, with the **Scenario name** you choose, and opens it in [[app/experimentar]]. From there you can adjust it and launch it. |

The scenario stays saved among your scenarios (see [[app/escenarios]]), so you can
repeat the experiment whenever you want.

## Entering a tournament {#torneo}
<!-- Ficha.svelte abrirInscribir/inscribir; i18n bots.inscribir.* -->

**Enter in a tournament** opens a list with the quick match and your tournaments,
each with its season and how many entrants it has. You pick one and click
**Enter**; the app opens that tournament in [[app/competir]].

Two things to keep in mind:

- **The DNA is frozen** when you enter it. If you edit the bot afterwards, the
  season keeps using the DNA it had when it was entered.
- **Vegetables don't fight in tournaments**: on a vegetable bot the button is off.

If the tournament has a round running, or its format no longer accepts new
entrants, the app doesn't enter it and tells you why.

## Import and export {#importar}
<!-- Biblioteca.svelte menú ⋯ (bots.menu.*): exportar → darwinbots2-biblioteca.json; importarTexto acepta la biblioteca nueva y el inventario de la clásica; migracion.svelte.js importarDesdeClasica; PLAN.md decisión 17; inicio.archivo.* (Desde un archivo, .txt) -->

The **⋯** button, next to **+ New bot**, has three actions:

- **Export my bots and marks (.json)** downloads a file with your own bots (with
  all their versions), your favorites, tags, notes and selections.
- **Import library (.json)…** reads a file like that, or the inventory exported
  from the classic interface. It adds what it brings to what you already have: new
  bots are added, the ones you already had receive the new versions, and if a name
  clashes, the incoming bot gets another one. Notes and selections with the same
  name may end up replaced by the ones in the file. When it finishes, the app tells
  you what it added, what it replaced and what it left as it was.
- **Import from the classic interface** copies whatever you have in the library of
  the [[app/clasica|classic interface]] in this same browser: favorites, tags,
  notes, named selections and hybrids. The first time you open the app it does this
  on its own and tells you what it brought; the classic interface is not touched.

The hybrids you built in the classic interface's lab arrive as your own bots, and
their profile says “lab hybrid”. In this app the lab is part of the editor (see
[[app/editor#laboratorio]]).

For single-bot `.txt` files (see [[adn/formato]]):

- **To add one to the library**, open it with a text editor, copy the contents and
  paste them into the **DNA** field of **+ New bot**.
- **To seed it directly**, without going through the library, use **From a file**
  in [[app/inicio]].
- **To take the DNA out of a bot of yours**, copy the text from the DNA tab.

## If something fails {#problemas}
<!-- screens/Bots.svelte avisos (bots.almacen.*, bots.foro.fallo, bots.error.almacen.*) -->

- **“Another tab with an older version of the app is blocking your data”**: there
  is another tab of the app open with an old version. Close it or reload it.
  Meanwhile you only see the forum bots.
- **“Another tab opened a newer version of the app”**: reload this one.
- **“Could not read your bots and marks”** or **“Could not read the list of forum
  bots”**: the library shows only the part it could read.
- **“There is no storage space left in this browser”**: delete runs or bots you
  don't use, or export them and free up room (see [[app/tus-datos]]).
