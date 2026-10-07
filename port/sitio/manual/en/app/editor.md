---
titulo: The DNA editor
resumen: "The DNA tab of a bot's profile: the text with colors and autocomplete, the warnings about what the engine reads differently, the gene view, versions, Test and the gene Lab."
etiquetas: [editor, dna, warnings, versions, test, lab]
estado: revisada
---
The DNA editor is the **DNA** tab of each bot's profile (see [[app/bots]]). There
you write the bot's program, see what the engine will read differently than it
looks, save versions and test each change against the previous one without
leaving the page.

This page explains the tool. How to write a DNA is in the language chapter,
starting with [[adn/estructura]].

## Your own bots and forum bots {#solo-lectura}
<!-- Editor.svelte (lectura = soloLectura || !esPropio; duplicar en línea: editor.duplicar.*) -->

Only your bots can be edited. Forum bots (the Bestiary) open in read mode, with
the notice “Forum bots are read-only: to change this one, duplicate it as your own
bot”. You can still read them, go through them gene by gene, test them and look at
the Lab.

To modify one:

1. Click **Duplicate to edit**, at the top right.
2. Type the **Name of the new bot**, or leave it empty: it gets the same name with
   “ 2” at the end.
3. Click **Duplicate**. The copy opens, already editable.

## The top bar {#barra}
<!-- Editor.svelte barra: seg Texto/Por genes; chip v{n}; editor.sinGuardar; editor.avisos; editor.laboratorio; nota + Guardar v{n} -->

From left to right:

| Control | What it is |
|---|---|
| **Text** / **By gene** | The two ways of viewing the DNA ([[app/editor#texto|text]] or [[app/editor#genes|gene by gene]]). |
| `v3` | The last saved version. |
| **unsaved** | Shows up when the text has changed since that version. |
| **4 warnings** | How many warnings there are below the text. |
| **Lab** | Switches the right-hand panel to the one with [[app/editor#laboratorio|Bestiary genes]]. |
| **Version note** and **Save v4** | Save the text as a new version (see [[app/editor#versiones|Versions]]). |

To the right of the text are the **Test** panel and, on your own bots,
**Versions**. With the **Lab** turned on, that spot is taken by the genes panel.

## Text mode {#texto}
<!-- AreaAdn.svelte (textarea + capa de resaltado, números de línea, líneas marcadas); resaltado.js (clases r-flu, r-cmd, r-sys, r-num, r-ref, r-def, r-com, r-off, r-err, r-otra); textarea.js (cambios por botón con deshacer) -->

It is an ordinary text field, with line numbers and colors. Typing, selecting,
copying, pasting and undoing work as in any browser field. Long lines aren't
wrapped: the text scrolls sideways.

The colors tell each class of word apart:

- flow-control ones (`cond`, `start`, `else`, `stop`, `end`);
- the other commands and operators ([[op:add]], [[op:store]], `>`…);
- sysvars and your `def` variables (`.up`, `*.eye5`);
- numbers, and separately, reads of an address written as a number (`*50`);
- `def` lines, whole;
- comments, in italics, and struck through the [[app/editor#genes|disabled
  genes]];
- underlined with a wavy line, the words that [[app/editor#avisos|a warning]]
  marks.

A word that doesn't fit in any class stays uncolored: it is usually a mistake, and
the matching warning says so.

The colors follow the rules of the engine's loader. For example, a line that
starts with `def` is painted as a definition even if it says `defensa`, because
that is how the engine reads it (see [[adn/def]]).

### Undo {#deshacer}

**Ctrl+Z** (the browser's undo) undoes what you typed and also what the buttons do
while you are in text mode: completing a sysvar, using **Fix** on a warning, adding a
gene from the Lab or restoring a version. Each one goes into the undo history as if
you had typed it. What you change in the gene view (turning a gene off or on)
doesn't.

## Sysvar autocomplete {#autocompletar}
<!-- autocompletar.js (palabraEnCurso: .xx o *.xx fuera de comentarios; sugerencias: exacta, empiezan, contienen; privadas antes; MAX_SUGERENCIAS 12; esExacta); AreaAdn.svelte tecla() -->

When you type a dot followed by letters (`.ey`, or `*.ey` to read), a list opens
with up to 12 matching names. Each one shows its address; your `def` variables
appear first and say **private**.

The list puts the exact name first, then the ones that start with what you typed
and finally the ones that contain it. With `.aim` typed, `.aim` goes before
`.aimdx`.

| Key | What it does |
|---|---|
| **↓** / **↑** | Move through the list. |
| **Tab** | Accepts the picked name. |
| **Enter** | Also accepts, unless what you typed is already a full name: then it closes the list and inserts the line break. So typing `.up` and pressing Enter leaves `.up`. |
| **Escape** | Closes the list. |

A click on a name in the list also accepts it. Inside a comment the list doesn't
appear.

Autocomplete is only for names with a dot. Operators and commands are typed out in
full: if one ends up misspelled, a warning marks it.

## The hover summary {#resumen}
<!-- AreaAdn.svelte (tarjeta al mover el mouse: hover.js palabraBajo y entradaDe, métrica de la fuente mono, tabulador cada 4 columnas; lib/manual.js vocabularioManual baja manual/vocabulario.json una vez por idioma; los comentarios no dan tarjeta, como el autocompletado) -->

Without typing anything, hover over a sysvar or an operator in the text: a card
appears with its summary from the manual and the **Open in the manual** link,
which opens its page in another tab. It is useful for reading what `.shootval`
does without leaving the editor. Comments give no card, and if the site's manual
isn't available, it doesn't appear (the editor works the same).

## Warnings {#avisos}
<!-- Editor.svelte (lista .avisos: dónde, qué, veces, Corregir); lint.js describirLint; wasm/dbcore_api.cpp db_dna_lint (lint_detail::Lint); linter.js (worker, debounce 350 ms) -->

The engine rejects almost nothing: a word it doesn't understand is 0, silently,
and the bot loads anyway (see [[adn/errores]]). That is why the editor checks the
text as you type, with the same rules and the same word tables the engine uses
when it loads a bot, and shows you below the text every word the engine will read
differently than it looks.

Each warning has three parts:

- **Where**: “Line 12 · gene 3”, or “Whole DNA” if it is about the entire file. A
  click takes you to that line. Line numbers with warnings are also marked.
- **What is going on**, with the word and, if it repeats, how many times (“(3
  times)”).
- **Fix**, when there is a safe repair: it replaces that word with the suggested
  one throughout the DNA, outside comments.

The check waits until you stop typing for a moment. If the engine couldn't load,
the editor says so (“The DNA check is not available”) and there are no warnings.

These are all the warnings, with an example of each:

| Example | Warning | What it means |
|---|---|---|
| `.upp` | “.upp is not a sysvar: the engine reads it as 0. Did you mean .up?” | A name with a dot that doesn't exist, similar to a sysvar. **Fix** puts in the suggested name. |
| `.zzqq` | “.zzqq is not a sysvar and has no def: the engine reads it as 0.” | A name with a dot that doesn't look like anything. |
| `.50` | “.50 is not a sysvar […]. Did you mean address 50? Addresses go without a dot.” | A number with a dot. **Fix** removes the dot (`*.50` becomes `*50`). |
| `.otra`, with its `def` further down | “.otra is defined further down: the engine reads the DNA in order and here it is 0. Move the def up.” | The engine resolves names as it reads: a later `def` doesn't work. See [[adn/def#resolucion]]. |
| `.Paso`, with `def paso` | “.Paso does not match its def: private variables are case-sensitive and here it is 0.” | Sysvars are not case-sensitive; your variables are. |
| `up` | “up is 0: missing dot? .up” | The name of a sysvar without the dot. **Fix** adds it. |
| `swapp` | “swapp is not a command or a number: it is 0. Did you mean swap?” | A word one letter away from a command, or with two neighboring letters swapped (`sotre`), only for words of 4 letters or more. If two commands fit, it suggests the one that starts the same: `stor` gives `store`, not `stop`. |
| `hola` | “hola is not a command or a number: it is 0 (text without the ' comment mark?).” | Any other loose word. Often it is a comment missing its `'`. |
| `store` with an invisible character in the middle | “… has an invisible character: it is not recognized as store and is 0.” | It happens when copying from web pages or word processors. **Fix** cleans it. |
| `ññ` | “… has invisible or encoding characters: it is 0.” | Letters outside basic English, or a broken encoding. |
| `50store` | “50store reads as 50: “store” is lost (missing space?).” | A number with something stuck to it. The engine takes the number and discards the rest. **Fix** inserts the space. |
| `def nrg 5` | “The private variable nrg hides the sysvar .nrg in the whole bot.” | A variable with the name of a sysvar wins over it across the whole DNA. See [[adn/def#sombra]]. |
| `defensa 50` | “Every line that starts with “def” is a definition: defensa defines the variable nsa. […]” | The engine reads as `def` any line that starts with those letters. If it was text, it is missing the `'`. |
| `def x .up` | “The value of a def must be a number: in def x, “.up” reads as 0.” | The value of a `def` is written with digits. See [[adn/def#numeros]]. |
| A DNA with `def` that starts with `10` | “With defs, the first word (10) is not flow control and is lost.” | A quirk inherited from the original. See [[adn/estructura#cero-inicial]]. |
| `40000`, or `def pasos` with no value | “The engine rejects this DNA (error 6: a number outside ±32767 or a malformed def).” | The only case where the bot doesn't load. See [[adn/estructura#rechazos]]. |

This DNA puts several of those mistakes together:

```adn sin-lint
def paso 30
cond
*.nrgg 100 >
start
.paso .up store
30 .upp store
30 up store
10 50store
stop
end
```

The editor marks `*.nrgg` (suggests `*.nrg`), `.upp` (suggests `.up`), `up` (missing
the dot) and `50store` (missing a space). Fixed:

```adn
def paso 30
cond
*.nrg 100 >
start
.paso .up store
30 .up store
30 .up store
10 50 store
stop
end
```

:::nota
Warnings tell you what the engine _reads_, not whether the bot does what you want.
A DNA with no warnings can have an empty stack, a `store` that never runs or an
inverted condition. That is what [[adn/errores]] and [[app/editor#probar|Test]]
are for.
:::

Below the engine's warnings come the Lab's, which are explained in
[[app/editor#laboratorio|its section]].

## The gene view {#genes}
<!-- VistaGenes.svelte (Gen, Nombre, Origen, Activo; plegar/desplegar; avisos por gen); engine/lab.js (bloquesAdn, nombreArriba, apagarGen/encenderGen, PREFIJO_APAGADO = "'#off ") -->

**By gene** shows the DNA as a table, one row per gene:

| Column | What it shows |
|---|---|
| **Gene** | The gene's number, counted the way the engine counts it (see [[adn/genes]]). |
| **Name** | The comment line right above the gene, if there is one. If not, “(unnamed)”. |
| **Origin** | Where the gene came from, if it came from the Lab: “← Bot name, gene 4”. |
| **Active** | **yes** or **no**. A click toggles it. |

Each gene expands to show its code, and a button at the top collapses or expands
all of them. Genes with warnings carry a mark with the count.

**Turning a gene off** turns it into a comment: each of its lines starts with
`'#off `. The engine doesn't run it, but it stays in the text and turns back on
with a click. It is useful for trying out what happens without a gene without
having to delete it:

```adn
' Move
cond
start
10 .up store
stop
' Turn
'#off cond
'#off *.eye5 0 =
'#off start
'#off 30 .aimdx store
'#off stop
end
```

Here the “Turn” gene is off: the bot only moves.

:::nota
A disabled gene is just a comment: it doesn't count as a gene, doesn't take up a
number and doesn't pay DNA cost. If you turn it on, the numbers of the genes that
follow it change, and that matters if some gene uses [[.delgene]] or [[.mkvirus]]
with a fixed number.
:::

## Saving versions {#versiones}
<!-- Editor.svelte guardar (texto exacto; editor.guardar.*); borrador.js (por bot, localStorage, base); beforeunload; PanelVersiones.svelte (Restaurar, Comparar); DiffGenes.svelte (editor.diff.*); engine/bots.js guardarVersion/restaurarVersion -->

Your bots keep their complete history. To save:

1. If you want, type a **Version note** (“turns faster”, “without the shooting
   gene”).
2. Click **Save v4** (the number is that of the version about to be created).

A version stores the exact text: a change in a comment or in the indentation is
also a change. If you didn't touch anything, the app doesn't create another
version and tells you so.

### What you haven't saved isn't lost {#borrador}

While you type, the editor keeps a draft of the bot in this browser. If you switch
tabs, pick another bot or reload the page, when you come back you find your
changes with the notice “You have unsaved changes from last time: they were
restored”, and a **Discard the changes** button in case you don't want them.

If in the meantime the bot changed somewhere else (for example, you restored a
version from the profile), the editor doesn't mix anything: it offers you
**Recover the changes** or **Discard the changes**. And if you try to close the
page with unsaved changes, the browser asks you to confirm.

### The Versions panel {#panel-versiones}

The panel on the right lists the versions, from newest to oldest, with their note
and their date:

- **Restore** brings back an earlier version _by saving it as a new version_: the
  history is never lost. If you have unsaved changes, it asks first (with
  **Restore anyway** you go ahead); in text mode, those changes come back with
  Ctrl+Z.
- **Compare** shows how two versions differ: the starting one and the ending one,
  which you pick in the two dropdowns. The comparison goes gene by gene: it counts
  the equal, changed, added and removed genes, and shows the changed ones side by
  side.

## Test {#probar}
<!-- PanelProbar.svelte; lib/trabajos/prueba.js (POR_DEFECTO copias 10, ciclos 5000, semillas 3, modo algas, base f1, semilla 1; LIMITES; 15 algas «Alga minimalis 3.0»; métricas); engine/opciones.js BASES (clasica: sin costos, 32000²; f1: costos, física, 9237×6928 toroidal) -->

**Test** runs your bot without drawing it, at full speed, and tells you how it did.
If it has an earlier version, it runs that one too with the same seeds, so the
comparison is fair.

| Field | What it is | Default |
|---|---|---|
| **Copies** | How many identical bots are seeded (from 1 to 50). | 10 |
| **Cycles** | How long each run lasts (from 10 to 200,000). | 5000 |
| **Seeds** | How many runs, each with different chance (from 1 to 16). | 3 |
| **Rules** | **F1**: the F1 league settings, with costs. **No costs**: the values the classic interface starts with. | F1 |
| **Seed** | The first seed; the others derive from it. With the same one, the test gives the same result. | 1 |
| **Scenario** | **With algae**: 15 algae to eat. **Alone (no algae)**: your copies by themselves. | With algae |

The button says what is being tested and against what:

- With no unsaved changes: **Test v4** against v3. If the bot has only one version,
  **Test v1** runs with no comparison.
- With unsaved changes: **Test changes** against the last saved version.
- On a forum bot: **Test this DNA**, with no comparison.

The test runs in the background: you can keep editing, switch bots or close the
editor, and it keeps going. While it runs you see the percentage and a **Cancel**
button. When it finishes, the panel shows a table with the two versions side by
side, averaged over the seeds:

| Row | What it measures |
|---|---|
| **Survive** | How many of the initial copies are still alive at the end. |
| **Offspring per copy** | Direct offspring of each founding copy, on average (without grandchildren). |
| **Births per copy (with grandchildren)** | All the births of the species, divided by the copies. |
| **Alive at the end** | The size of the population when it finishes. |
| **Mean energy** | The energy per living bot when it finishes. |
| **Extinctions** | In how many seeds the species disappeared. |

Each test is recorded in the bot's [[app/bots#historial|history]].

:::cuidado
With the **F1** rules the DNA costs energy (see [[adn/ejecucion#costos]]): a bot
that does fine with no costs can starve in F1. If your bot doesn't survive, test it
with **No costs** too, to find out whether the problem is what it does or what it
spends.
:::

## The Lab {#laboratorio}
<!-- PanelGenes.svelte (editor.lab.*: por capacidad / de un bot, solo autónomos, Ver el código, +); engine/lab.js avisosLab (dep → agregar-gen; col → remapear 971-990; gl → renumerar / agregar-gen; info sin-repro / sin-energia solo si todo el ADN viene del Bestiario); PLAN.md decisión 19 -->

The **Lab** is for building a bot out of other bots' genes. When you turn it on,
the right-hand panel becomes **Bestiary genes**, with the genes of all the forum
bots.

There are two ways to search:

- **by capability**: you pick one (venom, photosynthesis, sexual reproduction…)
  and the genes that have it appear, from any bot. **Filter by bot…** narrows it
  by name.
- **from one bot**: you type the bot's name and all its genes appear.

**self-contained only** leaves just the genes that don't use own memory: they can be
transplanted without dragging dependencies along or overwriting other genes'
addresses.

Each gene in the list says which bot it is from, how many words it has, whether it
uses own memory and which capabilities it contributes. A click on the gene shows
its code below the list; the **+** button adds it to the end of your DNA. The gene
remembers where it came from: you see it in the **Origin** column of the
[[app/editor#genes|gene view]] and it is saved with each version.

### Lab warnings {#avisos-laboratorio}

Putting together genes from different bots has traps, and the Lab warns about them
below the text, with a one-click fix when there is one:

| Warning | What is going on | Fix |
|---|---|---|
| “Gene 3 (from X) reads address 52, which in its bot is written by gene 1.” | The gene depends on a piece of data that, in its original bot, another gene prepared. | **+ gene 1**: adds the missing gene. |
| “Address 60 is used by X, Y for different things […].” | Two genes from different bots use the same memory cell for different things. | **Remap addresses**: moves those of the following genes to free addresses, starting at 971-990. |
| “Gene 2 (from X) uses literal gene numbers in .delgene/.mkvirus that no longer point to the genes of its bot.” | When moved, the gene numbers written by hand point to another gene (see [[.delgene]] and [[.mkvirus]]). | **Renumber**, or add the missing genes. |
| “No gene reproduces: the bot will leave no offspring.” | Informational. | — |
| “No gene gets energy (neither hunting nor photosynthesis).” | Informational. | — |

The last two only appear when the whole DNA comes from the Bestiary: for genes you
wrote yourself, the Lab doesn't know what capabilities they have.

On a forum bot the Lab can be browsed, but **+** is off and the fixes don't
appear: first you have to [[app/editor#solo-lectura|duplicate it]].
