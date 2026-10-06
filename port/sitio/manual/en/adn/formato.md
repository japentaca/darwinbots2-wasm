---
titulo: The .txt format
resumen: "What a bot's .txt file looks like on the inside: lines, comments, the '# header, the encoding, and what changes when the engine exports it."
etiquetas: [format, txt, file, export, header, hash]
estado: revisada
---
All bots are saved as text files with a `.txt` extension: the ones in the
Bestiary, the ones you write yourself and the ones the app exports from a simulation.
This page covers how the loader reads that file, line by line, and what
the engine writes when it sends it back out. The shape of the DNA itself (genes,
tokens, `def`) is in [[adn/estructura]]; the app's other formats, such as
saved simulations, are in [[tecnico/formatos]].

## Lines {#lineas}
<!-- 20-VM §2.2 (decisión RV-04: corta en LF, quita el CR final, no corta en CR suelto; tabs y Trim) -->

The loader reads the file one line at a time:

- It accepts Windows (CR+LF) and Unix (LF only) line endings, and mixed ones. A lone
  CR, as in old Mac files, does **not** end the line: the whole
  file becomes a single line and the bot does nothing.
- Tabs count as spaces, and spaces at the edges don't
  matter. You can indent the code however you like.
- An empty line is ignored.

Within a line, words are separated by one or more spaces. Line
breaks have no other meaning: where you break the code is up
to you.

## What the loader ignores {#comentarios}
<!-- 20-VM §2.2 pasos 1-5, §8.3 -->

| Line | What the loader does |
|---|---|
| Starts with `'` (after any spaces) | Ignores it: it's a comment |
| Starts with `/` | Ignores it: it's a comment |
| Has a `'` in the middle | Reads up to the quote mark and discards the rest |
| Starts with `'#` or `/#` | It's a header line (below) |
| Starts with `def` | Defines a variable; adds no tokens ([[adn/def]]) |
| Anything else | It's split into words and each one is a token |

Watch out for two details. The slash only comments at the start of the line: a `//`
in the middle is words that are 0. And any line that starts with the letters
`def` is taken as a `def`, even if the word is a different one: `defensa 50` defines
a variable called `nsa`.

## Encoding {#codificacion}
<!-- 20-VM §0.4 (palabra desconocida = 0); lint de db_dna_lint (caracteres invisibles o de codificación) -->

The app reads the file as UTF-8 text. In comments you can write
whatever you want, accents and all. In the code, though, only the ordinary
characters of an English keyboard count: a word with an odd character (an
accent, a non-breaking space copied from a web page, an invisible character) isn't
recognized and is 0. For example, a `stop` with a non-breaking space in the middle
no longer closes the gene. The [[app/editor]] warns you when it finds a word
like that.

## The '# header {#cabecera}
<!-- 20-VM §2.2 paso 3 (getvals; hash sobre el texto anterior; si no coincide se resetean generation y OldMutations); 60-FORMATOS §1; core formats.hpp (tag de 45 caracteres); comprobado en el port: tag acentuado e ida y vuelta del hash -->

Lines that start with `'#` (or `/#`) carry data about the bot, in
the form `'#name: value`. The loader understands four:

| Line | What it stores |
|---|---|
| `'#generation: 7` | The bot's generation |
| `'#mutations: 3` | How many mutations its lineage has accumulated |
| `'#tag: text` | A free-form tag, up to 45 characters |
| `'#hash: …` | A 20-character signature of the preceding text |

Any other `'#` line, or one with a value that isn't understood, is ignored
without rejecting the bot. In the tag, letters outside basic English
become question marks: `'#tag: Acción` ends up as `Acci??n`.

The `'#hash` is a check against hand editing. The engine computes it over
all the text that comes before it, and recomputes it on loading. If it doesn't
match, the generation and the mutations go back to 0; the DNA loads anyway. So,
if you touch anything in an exported file (the code, the generation, or
even if you add a comment at the top), the bot loses its history and goes back to
generation 0. Changing line endings from CR+LF to LF doesn't break it. A
file with no `'#hash` keeps whatever its header says.

## How the engine exports a bot {#exportar}
<!-- 60-FORMATOS §0.5, §1; 20-VM §9 (destokenización, VOID); core formats.hpp SalvarobText (UseEpiGene apagado en la app); comprobado en el port con el ejemplo -->

In the app, the text of a living bot is in the DNA tab of the
[[app/inspector]], with the **Copy** button. That text isn't the original
file: the engine rebuilds it from the tokens, just like the
original DarwinBots when saving a bot. If the bot has mutated since you opened it,
**Reload** brings in the current version.

With this starting bot:

```adn
'#generation: 7
'#mutations: 3
' Turns 10 per cycle for 5 cycles
def pasos 50

cond
  *.pasos 5 <
start
  .aim * 10 add .setaim store
  .pasos inc   ' adds 1 to address 50
stop
```

what the engine exports is this (the lines of quote marks are gene
comments that it adds):

```adn
'#generation: 7
'#mutations: 3

 cond
 *50 5 <
 start
 18 * 10 add .setaim store
 50 inc
 stop
''''''''''''''''''''''''  Gene:  1 Ends at position  14  '''''''''''''''''''''''

'#hash: …
```

Compare them and you'll see everything that changes:

- **The comments disappear.** Yours aren't saved in the DNA.
- **The `def` lines disappear** and the numbers are left in their place: `*.pasos` comes out
  as `*50`.
- **Sysvars get their name back in only two places:** after a `*`
  (`*.nrg`) and right before a `store` or another word that writes to memory
  (`.setaim store`). Anywhere else the number comes out: `.aim`
  became `18`.
- **The format is always the same:** a space at the start of each line and
  a line break after each condition, each logical operator, each write and
  each flow marker.
- **Gene comments are added** with the position where each one starts and ends
  (positions count tokens, starting at 1).
- **The header is added:** `'#generation`, `'#mutations` (the bot's own plus
  the ones it came with), a blank line and the `'#hash`; and `'#tag` if the bot has
  a tag.

Loading that text again gives the same bot, with the same generation. The only
exception comes from [[simulacion/mutaciones]]: they can leave tokens that have
no written form, and the engine exports them as `VOID`, a word that is 0 when
reloaded. DNA like that doesn't come back identical.

:::nota
The original DarwinBots could add, on export, an extra gene that restores the
bot's epigenetic memory (see [[adn/memoria]]). The app doesn't add it: the
text you copy has only the DNA.
:::

## Your bots, the Bestiary and files {#archivos}
<!-- procedencia del Bestiario: port/web/bots/bots.json (673 enlaces al foro, 10 al wiki) -->

- **To bring a `.txt`** into a simulation, on [[app/inicio]] use "From a
  file": it seeds the bot into a world with algae.
- **Your bots** live in the app's library ([[app/bots]]). The editor
  saves the text just as you wrote it, with comments and `def`, and each
  version separately; the engine's reconstruction is only what you copy from
  the inspector.
- **The Bestiary bots** are files published on the DarwinBots forum and wiki.
  That's why some have gene comments and a header with a `'#hash`: they are
  bots that someone exported from a simulation.
- **To back up** your whole library, the app exports it as a `.json` file
  (see [[app/tus-datos]]).

:::cuidado
If you want to keep your comments and your names, save your own text. What
you copy from the inspector is good for studying or reusing an evolved bot,
but it no longer has anything that the loader ignores.
:::
