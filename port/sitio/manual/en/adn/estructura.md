---
titulo: The structure of a bot
resumen: "A bot is a text file with its DNA: genes one after another, comments, def and words separated by spaces."
etiquetas: [dna, bot, gene, tokens, comments, def]
estado: revisada
---
A DarwinBots bot is a text file. Inside it is its DNA: a program
written with words separated by spaces, which the engine reads once, when loading
the bot, and turns into a list of _tokens_. From then on the text no longer matters:
every cycle the bot runs that list from start to finish (the details are in
[[adn/ejecucion]] and [[simulacion/ciclo]]).

This page shows you the general shape of a bot. What the file looks like on the
inside (line endings, headers, what's lost when exporting) is in
[[adn/formato]].

## A minimal bot {#un-bot-minimo}
<!-- 20-VM §4, §5.1-5.3, §5.5; sysvars.yaml .up -->

This is a complete bot. You can paste it into the [[app/editor]] and seed it:

```adn
' My first bot: always moves forward
cond
start
10 .up store
stop
```

It moves forward every cycle, faster and faster. Line by line:

- The first line is a comment: it starts with `'` and the engine ignores it.
- [[op:cond]] opens a gene. Conditions go between `cond` and `start`; here
  there are none, and a gene with no conditions always runs.
- [[op:start]] marks where what the gene does begins.
- `10 .up store` puts the number 10 at address [[.up]]: that's the command to
  push forward. [[op:store]] takes two numbers from the stack (the value and
  the address) and writes one into the other; [[adn/pilas]] and
  [[adn/stores]] each have their own page.
- [[op:stop]] closes the gene.

A `start` with no `cond` in front also works and always runs:
`start 10 .up store stop` does the same as the bot above.

## Genes, one after another {#genes-uno-tras-otro}
<!-- 20-VM §4 (sin anidamiento), §5.5; §2.2 (end agregado al cargar) -->

A real bot has several genes, written one after the other. They don't nest:
`cond`, `start`, [[op:else]] and `stop` are flat markers that switch execution on and
off while the bot goes through its list. The usual form is
this:

```adn
cond
  *.nrg 5000 >
start
  50 .repro store
stop

cond
  *.nrg 1000 <
start
  10 .up store
stop
```

The first gene reproduces when energy goes above 5000; the second pushes
forward when it drops below 1000. The exact rules for each marker, including
an inherited quirk of `else`, are in [[adn/genes]].

Two things worth knowing right away:

- Whatever you write **before** the first `cond` or `start` never runs.
- The word [[op:end]] ends the program: whatever comes after it is loaded
  but not run. You don't need to write it, because the engine adds an `end`
  at the end of every bot.

## Comments {#comentarios}
<!-- 20-VM §2.2 pasos 1-3 y 5 -->

There are two ways to comment:

- **The quote mark `'`** comments from where it appears to the end of the line.
  It works for a whole line or for jotting something next to the code.
- **The slash `/`** comments only if it's the first thing on the line (not counting
  spaces). Many old bots from the forum use it to draw boxes. This
  fragment is from _Robottus Fisannis_, in the Bestiary:

```adn
/******************/
/* REPRODUCTION */
/******************/

cond
*.nrg
5000
>
start
50
.repro
store
stop
```

In the middle of a line, the slash comments nothing: `stop // done` leaves two
extra words (`//` and `done`) that the loader turns into zeros. The fragment
above also shows that line breaks have no meaning: writing
one word per line or the whole gene on a single line gives the same bot.

## def, at the start {#def-al-principio}
<!-- 20-VM §2.2 paso 4, §2.4, §8.1-8.2 -->

A line that starts with `def` gives a name to a memory address:

```adn
' Counter: pushes for 5 cycles and then coasts
def pasos 50

cond
  *.pasos 5 <
start
  10 .up store
  .pasos inc   ' adds 1 to address 50
stop
```

From the `def` on, writing `.pasos` is the same as writing `50`, and `*.pasos`
reads what's at that address. The bot pushes for five cycles, address 50
reaches 5 and the gene stops running; the bot keeps moving by inertia.

`def` lines go **at the top**, before the first place where you use the name: the
loader resolves each name at the moment it reads it, and one defined further
down is 0. The value has to be a number; `def mov .up` doesn't copy the
address of `.up`, it leaves `mov` at 0. All of this, in more detail, in
[[adn/def]].

## The words of the DNA {#tokens}
<!-- 20-VM §1, §2.4 (val, redondeo bancario), §6.1 (*) -->

Outside of comments and `def` lines, the loader splits each line at
spaces (and tabs) and turns each word into a token. There are
only a few kinds:

| What you write | What it is | Example |
|---|---|---|
| A number | It's pushed as is | `10`, `-5` |
| `*` and a number | Reads that memory address and pushes what's in it | `*50` |
| `.` and a name | The address of a sysvar (or of a `def`): it's a number | `.up` is 1 |
| `*.` and a name | Reads that sysvar | `*.nrg` |
| An operator | Does arithmetic, compares or writes | `add`, `>`, `store` |
| A flow marker | Organizes the genes | `cond`, `start`, `else`, `stop`, `end` |

Numbers go from −32768 to 32767; one with decimals is rounded to the nearest
integer (on a tie, to the even one: `2.5` is 2). More on addresses and ranges in [[adn/numeros]], and the operators
grouped by family in [[adn/operadores]].

Note that `.up` without an asterisk reads nothing: it's only the address number,
ready for a `store` to use. To read the contents you need the `*`. A
loose `*` also reads: `.nrg *` is the same as `*.nrg` (see [[op:*]]).

## Uppercase and lowercase {#mayusculas-y-minusculas}
<!-- 20-VM §2.4 (LCase de comandos), §8.2 (privadas case-sensitive) -->

Operators, flow markers and sysvar names are recognized regardless of
case: `COND *.NRG 1000 > START 10 .Up STORE STOP` is a valid
bot. The names you invent with `def`, on the other hand, are case-sensitive: if you
defined `pasos`, `.Pasos` isn't the same thing.

## What the loader rejects {#rechazos}
<!-- 20-VM §0.4, §2.4, §2.5; core loader.hpp to_vb_integer/insertvar -->

Almost nothing. The loader doesn't reject words: any word it doesn't recognize is
turned into the number 0, and a `.name` that doesn't exist is 0 too. A typo
loads without complaint and does something else:

```adn sin-lint
' Deliberate error: .upp doesn't exist
cond
start
10 .upp store
stop
```

Here `.upp` is 0 and the `store` writes nowhere: the bot doesn't move.
That's why the [[app/editor]] checks the DNA and warns you about words it doesn't
recognize, with a suggestion (in this case, `.up`). The list of usual
stumbles is in [[adn/errores]].

The whole bot is rejected, and doesn't enter the simulation, in only two cases:

- **A number outside −32768…32767**, in the code or as the value of a `def`.
  For example, `40000 .up store`.
- **An incomplete `def`**, with no name or no value, such as `def pasos`.

Genes without a `stop`, an extra `stop` or stray conditions load anyway and
run under the usual rules.

## An inherited quirk: the first token and def {#cero-inicial}
<!-- 20-VM §2.3, §2.6; README del port: A2-2 conservado; lint "primero" -->

DarwinBots 2.48.32 has a quirk that the port preserves: if the bot has any
`def` and its first token is **not** a flow marker (`cond`, `start`, `else`
or `stop`), that first token is lost on loading. For example:

```adn sin-lint
def pasos 50
5 cond start 10 .up store stop
```

That `5` disappears. Since what comes before the first `cond` never runs,
the bot behaves the same; what changes is the count of its DNA:
[[.dnalen]] says 7 instead of 8 (it also counts the final `end`), and the [[simulacion/mutaciones]] work
on the already-trimmed list. The editor warns you when it happens. The fix is
simple: start the code with `cond` or `start`, as almost all
bots do.
