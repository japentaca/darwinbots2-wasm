---
titulo: The inspector
resumen: "A bot's panel in Observe: its summary, what it senses, its memory, its DNA, its console, its family, the eye designer and the Player Bot for driving it with the keyboard."
etiquetas: [inspector, memory, senses, console, eyes, player bot]
estado: revisada
---
The inspector is the **Bot** tab of the side panel in [[app/observar]]:
picking a bot jumps to it. It shows what it has, what it sees, what's in its memory and
which genes of its DNA ran, and it lets you touch a few things: write to its
memory, move its eyes or drive it with the keyboard.

## How to open it {#abrir}
<!-- web2/src/screens/Observar.svelte (inspectorVisible → Inspector, si no PanelVivo); Mundo.svelte alSoltar; Inspector.svelte cerrar, morir; i18n/es/inspector.json inspector.cerrar, inspector.murio* -->

- **A click on a bot** in the world.
- **Find the best**, in Observe's bar, picks the fittest one and opens it.
- From the inspector itself, the numbers of the mother, the children or the
  ancestors are links: they open that relative's inspector.

To close it, click **×** (**Close the inspector**) or click an empty spot in the
world; the panel goes back to the previous tab (**Live**, or **Tournament**
if a tournament is in progress). If the bot dies while you're watching,
**The bot died** appears: the data stays as it was in its last cycle and
**Close** closes the panel.

The panel updates on its own several times a second while the simulation runs.
When paused, **One cycle** moves it forward one step at a time.

## The header {#cabecera}
<!-- Inspector.svelte (subtitulo, estados); i18n inspector.gen, inspector.mut.*, inspector.edad, inspector.estado.*, inspector.sinVistaRica -->

At the top are the color and name of its species, its number (the one that
identifies it throughout the run), its generation, how many mutations it has
accumulated and its age in cycles. Below, some tags mark its status when
applicable:

| Tag | What it means |
|---|---|
| **vegetable** | it photosynthesizes ([[simulacion/cloroplastos]]) |
| **fixed** | it doesn't move ([[.fixed]]) |
| **paralyzed** | venom hit it ([[.paralyzed]]) |
| **poisoned** | poison hit it ([[.poisoned]]) |
| **infected** | it has a virus incubating ([[.vtimer]], see [[simulacion/virus]]) |
| **fertilized** | it received sperm ([[.fertilized]]) |

The species, the lineage and the relatives need the enriched view. With the
classic one, the inspector warns you and offers **Turn on the enriched view**.

## Follow, Family and Genetic distance {#acciones}
<!-- Inspector.svelte (acciones: onSeguir, alternarFamilia, alternarGendist); Familia.svelte (TOPE 12); render-clasico.js dibujarFamilia; i18n inspector.seguir*, inspector.familia*, inspector.gendist* -->

Three buttons below the header:

- **Follow** / **Stop following**: the camera stays with the bot. Dragging the
  world releases it.
- **Family**: highlights the bot's descendants in the world and draws the lines
  that join them. It opens a card with how many living descendants it has, its
  **Mother**, its **Living children** and its **Living ancestors**; each number
  is a link to that bot. **Remove the highlight** closes it.
- **Genetic distance**: colors every bot by how much its DNA differs from this
  one's. It's the enriched view's **Color by** ([[app/observar#color-por]]); if
  you were in the classic view, it switches it.

## Summary {#resumen}
<!-- lib/inspector/Resumen.svelte (RECURSOS, chispa VENTANA 1000, ojos, genes, linaje); i18n inspector.recurso*, inspector.energia*, inspector.vision*, inspector.genes*, inspector.linaje* -->

The first tab gathers what's looked at most:

- **Reserve bars**: **Energy** ([[.nrg]]), **Body** ([[.body]]), **Venom**
  ([[.venom]]), **Shell** ([[.shell]]) and **Waste** ([[.waste]]), with their
  value. Each bar fills in proportion to the maximum among the living bots, so a
  full bar says “the one with the most”, not “the cap”.
- **Energy**: a curve of its energy over the last 1000 cycles.
- **Vision**: one column per eye, from [[.eye1]] to [[.eye9]], that grows with
  what that eye sees; the focus eye is highlighted.
- **Genes active this cycle**: one little square per gene, lit if the gene ran in
  the last cycle, with the count (“3 of 7”). Hover to see each gene's number.
  It's the most direct way to know which part of the DNA the bot is using: with
  the simulation paused and **One cycle**, you watch it change step by step. What
  makes a gene run is in [[adn/genes]].
- **Lineage**: its mother, how many living children it has and the founding
  ancestor of its line.

## Senses {#sentidos}
<!-- lib/inspector/Sentidos.svelte (PERIODO 500), Abanico.svelte; memoria.js SENTIDOS; i18n inspector.sentidos.* -->

What the bot perceives, reread every half second.

**Eyes**. A fan draws the nine eyes as the bot sees them: each one's direction
and width, and its range; the focus one is in red. Below, a table with each eye:
what it sees (**Value**), its **Direction** ([[.eye1dir]] and so on), its
**Width** ([[.eye1width]] and so on) and its **Range**. How what each eye sees is
calculated is in [[simulacion/vision]].

**Touch**: the contact hits on each side ([[.hitup]], [[.hitdn]], [[.hitsx]],
[[.hitdx]]), the total [[.hit]] and the angle [[.hitang]].

**Taste (hits received)**: the shots that hit it, by side ([[.shup]], [[.shdn]],
[[.shsx]], [[.shdx]]), their type [[.shflav]] and their angle [[.shang]].

**Other**: [[.pain]], [[.pleas]] and [[.daytime]].

## Memory {#memoria}
<!-- lib/inspector/Memoria.svelte (PERIODO 500, consultas), memoria.js GRUPOS_MEMORIA, normalizarConsulta, privadas con `? .nombre`; i18n inspector.memoria.* -->

A table with the bot's most-used sysvars, their address and their value,
reread every half second. They're grouped: **Body and energy**, **Movement**,
**Actions**, **Vision**, **Ties** and **Counters and free memory**. Each name has
its profile in the sysvar reference (for example [[.nrg]], [[.aim]], [[.shoot]],
[[.refeye]] or [[.numties]]), and in the table those names are links: a click
opens that sysvar's page in the manual (the same goes for the eye table and the
ones in [[app/inspector#sentidos|the senses]]). The **?** in the inspector's
header opens the inspector's page.

To look at something that isn't in the list, type it in the box at the top and
click **Query**. These are valid:

- a sysvar name, with or without the dot (`nrg` or `.nrg`);
- a memory address, from 1 to 999;
- the name of a variable the bot's DNA defined with `def` (see [[adn/def]]);
  those are case-sensitive.

The query stays in the **Queries** group, at the top, until you remove it with
**×**. If the name isn't anything the bot knows, the table says “does not
exist”.

## DNA {#adn}
<!-- lib/inspector/Adn.svelte (barra, bloque-gen con disparo y evaluado, PanelPila en modo trazador sin memoria de ejemplo, pasar, abrir en el editor); LineaTiempoGenes.svelte (200 ciclos); adn.js claseDeGen, segmentosAdn, pendientePila, CLAVE_PILA_PENDIENTE; Inspector.svelte (traceOn con la pestaña abierta, REFRESCO_TRAZA 500, HISTORIAL_GA 200, abrirEnEditor pide memDump); worker 'bot-text' (cabecera '#generation, '#mutations); i18n inspector.adn.* -->

The bot's DNA as it has it now, with its mutations, colored and with the line
count. It starts with a few comments with its generation and its mutations.
**Copy** puts it on the clipboard, to paste into the [[app/editor|DNA editor]] or
a `.txt`. **Reload** asks for it again: the DNA may have changed if the bot
mutated during its life ([[simulacion/mutaciones]]).

Each gene has its own box, with its number (**Gene 3**, counted the way the
engine counts it: see [[adn/genes]]). What's marked is what happened in the
bot's last cycle:

- **fired** (colored box): the gene ran in that cycle.
- **condition evaluated** (dashed border): the engine ran the gene's condition,
  but it was false, so the `start` block didn't run.
- No mark: the gene didn't fire and didn't get to evaluate its condition.

Click a gene's header and its [[app/editor#pila|step-by-step stack]] opens below,
with the values the bot had in that cycle, not example values. Only one gene is
open at a time.

The bar above runs the simulation:

- **Pause** appears while the simulation runs and stops it.
- **1 cycle** and **10 cycles** pause the simulation and advance it one or ten
  cycles.

While the simulation runs, the genes update every half second. When it's paused,
they're requested when you open the tab and after each step. The trace is the one
of the focused bot, the one you're watching. If no cycle has run since you opened
the tab, the bar says “No trace yet” and no genes are marked.

**Genes over time**, below the text, has one row per gene and one cell per cycle
for the last 200 (the newest, on the right). A lit cell is a cycle in which that
gene fired. On a phone the grid scrolls sideways.

**Open in the editor** (with the bot alive) takes this DNA to a new bot in the
[[app/editor|DNA editor]], with the stack turned on and the bot's real memory as
example values. [[app/editor#valores|How those values are used]] is explained there.

What ran in the last cycle is also seen in **Summary**
([[app/inspector#resumen]]), with one square per gene, and in more detail, with
`debug` in the console.

## Console {#consola}
<!-- lib/inspector/Consola.svelte (ATAJOS, historial ↑↓), consola.js COMANDOS; engine/sim.js consoleCmd; i18n inspector.consola.* -->

The console is the original's debugging tool: it reads and changes this bot's
memory with text commands. Type the command and click **Send** (or Enter); the ↑
and ↓ arrows go through previous commands. The buttons at the top send the most
common ones with a single click, and **Clear** wipes the output.

| Command | What it does |
|---|---|
| `printeye` | eye status: what each one sees, [[.eyef]], [[.focuseye]], directions and widths |
| `printtouch` | touch on the four sides |
| `printtaste` | taste (hits received) on the four sides |
| `printmem .var` or `? .var` | the value of a sysvar or an address (`? 310`) |
| `set .var v` | stores `v` in a sysvar or an address |
| `energy e` | sets the bot's energy to `e` |
| `cycle n` | runs `n` cycles |
| `execrob` | runs every bot's DNA without advancing the cycle |
| `play` / `pause` | starts or pauses the simulation |
| `showdna` | points to the DNA tab |
| `debug` | the interpreter trace of this bot in the last cycle |
| `help` | the list of commands |
| `clear` | wipes the output |

After every command, the active genes in **Summary** are updated.

```
? .nrg
set .up 30
energy 5000
cycle 1
debug
```

This example isn't DNA, it's console lines: it checks the energy, pushes the bot
forward with [[.up]], gives it 5000 energy, runs a cycle and shows the trace.

:::cuidado
What you type in the console (`set`, `energy`) changes this bot's memory and
isn't kept in the run: if you repeat the run, it isn't repeated.
:::

With a tournament in progress the console is read-only: `set`, `energy`,
`cycle`, `execrob`, `play` and `pause` aren't sent, because they would change
the fight (see [[app/competir#en-curso]]). The other commands work as usual.

## Control {#control}
<!-- revisor: probar-adn con 0 .setaim: 20 .sx store sube al bot (y 1107 → 1000), .up lo lleva a la derecha (x 1496 → 1602): .sx es la izquierda del bot, como sysvars/sx.md; el tooltip y los juegos de teclas de la app lo tenían al revés (corregido el 2026-10-04). veterano.js lineasAdnOjos (Cond / *.robage 0 = / Start / pares dir-width con ' / Stop); jugador.svelte.js CLAVE_LS (teclas en localStorage) -->
<!-- lib/inspector/ControlJugador.svelte, jugador.svelte.js, veterano.js PRESETS_PB; DisenadorOjos.svelte, ACCESIBILIDAD (cost:54, opt:13), SETAIM; i18n inspector.pb.*, inspector.ojos.*, inspector.noReproducible -->

The last tab has two tools for stepping in: the Player Bot and the eye designer.
Neither can be used during an F1 match, and what they do to the bot's memory
isn't kept in the run. With a tournament in progress, the Player Bot doesn't
even show up and the eye designer only reads (see [[app/competir#en-curso]]).

### Player Bot {#player-bot}

It lets you drive the bot. With **Control this bot**, the bot always aims at the
mouse pointer over the world (the app writes to [[.setaim]]) and each key writes
a value to an address in its memory while you hold it down.

1. Pick the bot and open the **Control** tab.
2. Under **Keys**, pick a set: **Arrows and space**, **WASD and space**,
   **None** or your **Custom** ones.
3. Click **Control this bot**. **Player Bot on** appears over the world.
4. Move the mouse over the field and use the keys. `Esc` exits.

The built-in sets write this:

| Arrows | WASD | Address | Value |
|---|---|---|---|
| ↑ | W | 1 ([[.up]]) | 40 |
| ↓ | S | 2 ([[.dn]]) | 40 |
| → | D | 4 ([[.dx]]) | 40 |
| ← | A | 3 ([[.sx]]) | 40 |
| space | space | 7 ([[.shoot]]) | −1 |

With the bot facing the pointer, ↑ takes it toward the pointer and space shoots
toward it (−1 is the shot that steals the other bot's energy, see [[.shoot]]).
The side keys are relative to the bot: [[.dx]] pushes it toward _its_ right and
[[.sx]] toward its left, so → moves it to the right of where it's facing.

The key table is editable: click a row's key and press another to change it;
**Memory** accepts an address (1 to 999) or the name of a sysvar such as `.up`;
**Value**, an integer between −32000 and 32000; **Inverted** writes the value
while the key is _released_. **Add key** adds a row and each row's **×** removes
it. **Save preset** downloads your table to a `.pbkp` file and **Load preset…**
reads it back. The app remembers your keys in this browser.

Children born while you control the bot are highlighted and respond too; if the
bot dies, control passes to one of them. A click on another bot hands control to
it. When you exit, the highlights are removed.

### Eye designer {#ojos}

It shows the **Direction** and **Width** of the nine eyes ([[.eye1dir]] …
[[.eye9dir]], [[.eye1width]] … [[.eye9width]]). Each change is written to the
bot's memory instantly, and the fan above shows the effect. It's for trying out
a vision setup by eye before writing it into the DNA. **Reread** reads the bot's
values again. What directions and widths mean is in [[simulacion/vision]].
With a tournament in progress the fields, **Reset aim** and **Ease of access** are
off: you can read the eyes and use **Write to DNA**, but not change them.

When you like it, **Write to DNA** builds a gene that sets those eyes at birth,
to add at the end of the DNA. It starts like this (with your values) and goes on
the same way, eye by eye, up to 9; here it's cut short after eye 2:

```adn
Cond
*.robage 0 =
Start
-70 .eye1dir store
100 .eye1width store
'
-50 .eye2dir store
100 .eye2width store
'
Stop
```

Since the condition is [[.robage]] equal to 0, the gene runs only once, in the
bot's first cycle, and the values stay in its memory. **Copy** puts it on the
clipboard and **Download eyes.txt** downloads it. If the bot is one of yours,
**Open the DNA of…** copies the gene and opens its DNA in the [[app/editor|DNA
editor]] for you to paste it.

**Ease of access** brings three shortcuts for testing at your leisure:

- **Disable costs** sets [[param:cost:54]] to 0.
- **Turn off Brownian motion** sets [[param:opt:13]] to 0.
- **Reset aim** writes 0 to this bot's [[.setaim]].

The first two are live parameter changes: they hold for the whole simulation and
are recorded in the run. The third only touches the bot's memory and isn't
recorded.
