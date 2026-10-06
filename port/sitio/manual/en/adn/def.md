---
titulo: Variables with def
resumen: "How to give a name to a memory address or to a number with def, how those names are resolved, and what traps they have."
etiquetas: [def, variables, names, memory]
estado: revisada
---
Writing `50 inc` to count something works, but by the third loose address you no longer know what each one was. The `def` line gives a name to a number: afterwards, anywhere in the bot, you write `.name` and the loader swaps it for that number.

```adn
' A counter in a variable of your own
def pasos 50

cond
start
.pasos inc
stop
```

This bot adds 1 to cell 50 every cycle: `.pasos inc` is exactly the same as `50 inc`. We checked it by running it: after five cycles cell 50 holds 5.

## How it's written {#sintaxis}
<!-- 20-VM §2.2 pasos 1-4 (comentario, tabs, def por sus tres primeras letras, sin tokens), §2.6 (DnaLen), §8.1 -->

The form is `def name number`, alone on its line:

- `def` in lowercase, at the start of the line. `Def` or `DEF` don't count: that line is read as ordinary DNA and its words become zeros (see [[adn/numeros]]).
- One space (or a tab) between `def` and the name, and another between the name and the number.
- The number is an integer between −32768 and 32767. A comment with `'` can follow.
- A `def` line produces no instruction: it takes up no slot in the DNA, costs no energy and doesn't count in [[.dnalen]].

Put the `def` lines at the very top, before the first gene, for a reason that follows.

## How names are resolved {#resolucion}
<!-- 20-VM §2.4 (SysvarTok: sysvars case-insensitive, privadas case-sensitive, última gana), §8.1-8.2; lint de db_dna_lint (nombre, def más abajo, mayúsculas, sin punto) -->

The loader reads the file from top to bottom and translates each word at the moment it reads it. When it finds `.something`:

1. It looks for a sysvar called `something`, ignoring case: `.UP`, `.Up` and `.up` are the same one.
2. Then it looks among your `def` lines **already read**, this time respecting case: `.Pasos` is not `.pasos`.
3. If there's a match on both sides, your `def` wins. If two `def` lines have the same name, the last one wins.
4. If it finds nothing, `.something` is 0. There's no error or warning on load.

Two practical consequences:

- **A `def` placed below its use is useless.** If a gene uses `.pasos` and the `def pasos 50` appears afterwards, that `.pasos` was already translated as 0.
- **The dot is required.** Without the dot, `pasos` is an unknown word and is 0. With an asterisk and a dot, `*.pasos`, you read what's stored in the cell (see [[op:*]]).

:::nota
The app's editor warns you about almost all of these cases: a name without a `def`, a `def` below its use, a case mismatch, or a word without a dot.
:::

A name "not existing" and being 0 seems harmless, but it isn't: in a store, address 0 does nothing, and in a read `*0` reads cell 1000. A typo in a name leaves the gene writing nowhere (see [[adn/numeros#cero]]).

## A def is just a number {#numeros}
<!-- 20-VM §8.2-8.3 (la privada es un número; normalización en ejecución); §8.1 (val del valor); Bestiario: LoveBot_F2_Moonfisher_-_30-03-08.txt -->

The loader doesn't know whether your `def` is an address or a constant: it stores a number and nothing more. That lets you use `def` for both. This bot uses `reloj` as an address and `giro` as a constant:

```adn
' Turns a quarter turn every 20 cycles
def reloj 60
def giro 314

cond
start
.reloj inc
stop

cond
*.reloj 20 >=
start
0 .reloj store
.giro .aimdx store
stop
```

`.reloj inc` increments cell 60; `*.reloj` reads its value; `.giro` pushes the number 314 directly, which is what gets stored in [[.aimdx]]. When you run it, cell 60 counts from 0 to 19, goes back to 0, and in that cycle the bot's [[.aim]] drops by 314 (a quarter turn to the right, because the full turn is 1256).

LoveBot F2, by Moonfisher, uses the same trick to leave a "key" for its children in genetic memory:

```adn
' Fragment of LoveBot F2 (Moonfisher, 2008)
def original 971
def origkey 1234

cond
*.robage 2 <
start
.origkey .original store
stop
```

`original` is an address (971, which is inherited: see [[adn/memoria#memoria-genetica]]) and `origkey` is a constant. The gene stores 1234 in 971 during the first two cycles of life.

Since it's just a number, a `def` can be anything within ±32767. If you use it as an address and it falls outside 1..1000, it gets adjusted just like any address (see [[adn/numeros]]): `def x 1050` and `def x -50` both end up at cell 50. The value has to be a number written with digits: `def x .up` doesn't copy the address of `.up`, it's 0. The [[app/editor]] flags it.

## A def that overrides a sysvar {#sombra}
<!-- 20-VM §2.4, §8.2 (la privada sombrea a la sysvar homónima); lint «sombra» -->

If you give your variable the same name as a sysvar, your `def` wins throughout the bot. Here `.up` stops being the move-forward command:

```adn sin-lint
def up 50

cond
start
10 .up store
stop
```

The bot doesn't move: the `10` goes to cell 50, not to cell 1 ([[.up]]). And since `def` names are case-sensitive and sysvars are not, in that same bot `.UP` is still the real sysvar. It's a sure source of confusion; the app's lint flags it as a warning. Pick names that don't clash with [[sysvars/todas|the list of sysvars]].

## Names with no checking {#sin-validacion}
<!-- 20-VM §2.2 paso 4, §8.3 (defensa 50 define nsa) -->

The loader doesn't check the name. Dots, digits or symbols are all fine: `def a.b 70` or `def 5 70` define legal variables, used as `.a.b` and `.5`. Watch out for the last one: `.5` without a `def` is **not** address 5, it's 0 (addresses go without a dot).

Stranger still: any line that starts with the letters `def` is taken as a `def`. The loader discards the first four characters and reads what's left. A line like this one:

```adn sin-lint
defensa 50
```

defines a variable called `nsa` with the value 50. If a bot ever does inexplicable things, check that no line starts with "def" by accident. The editor also warns you when a line is read as a `def`.

## use: a dead word {#use}
<!-- 20-VM §8.5 -->

Some old bots from the forum include lines like `use NewMove`. In this version `use` does nothing special: each word is read as ordinary DNA and, since they're neither commands nor numbers, they're 0. If the line comes before the first gene, those zeros never run; if it's inside a gene, they push zeros. You can delete them without worry.

## Limits and errors that prevent loading {#limites}
<!-- 20-VM §2.5, §8.1 (error 5 malformado, 6 fuera de rango, 9 con el def 1001); core loader.hpp insertvar -->

| Case | What happens |
|---|---|
| `def x` without a number, or just `def` | The whole bot fails to load. |
| Number outside −32768…32767 (`def x 40000`) | The whole bot fails to load. |
| More than 1000 `def` lines | The whole bot fails to load. |
| Two `def` lines with the same name | Loads; the last one wins. |
| `def` with a number outside 1..1000 | Loads; used as an address, it's adjusted to 1..1000. |

## Quirks inherited from 2.48.32 {#rarezas}
<!-- 20-VM §2.3 (corrimiento del cero inicial, conservado como A2-2); core vm.hpp ExecuteDNA (ADN solo-defs: no-op, V-07); 60-FORMATOS §1 y 20-VM §9 (savingtofile: sin nombres privados) -->

Two curious behaviors of the original, one preserved and one fixed:

- **The first token is lost** (preserved). If the bot has any `def` and the first thing in the DNA isn't `cond`, `start`, `else` or `stop` (for example, a loose number before the first gene), that first token disappears. Since what comes before the first gene doesn't run, in practice you only notice it because [[.dnalen]] is one lower. If you start with `cond`, nothing happens. More in [[adn/estructura#cero-inicial]].
- **A bot made only of `def` lines** (fixed). In the original DarwinBots, a file with `def` and no gene stalled part of every simulation cycle. In this version the bot simply lives and does nothing.

Finally, the names exist only in your file. When the simulation saves a bot as `.txt` (see [[adn/formato]]), the DNA comes out already translated: every `.pasos` appears as `50`, with no `def` lines.
