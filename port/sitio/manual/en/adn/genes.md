---
titulo: "Genes: cond, start, else and stop"
resumen: "How a gene is built with cond, start, else and stop, which parts of the DNA run, and how genes are numbered."
etiquetas: [gene, cond, start, else, stop, flow]
estado: revisada
---
A bot's DNA is a long list of words that is traversed in full, from
left to right, once per cycle. Its order comes from four flow
markers: [[op:cond]], [[op:start]], [[op:else]] and [[op:stop]]. With them you
build _genes_: pieces of DNA that run only if certain
conditions are met.

There's no nesting and there are no blocks: the four markers are flat, and each one
changes the interpreter's state as it passes. This page covers what each
one does, with examples we ran in the port.

## Anatomy of a gene {#anatomia-de-un-gen}
<!-- 20-VM §5.1-5.4; core vm.hpp ExecuteFlowCommands (else corregido, A2-1) -->

The typical form is this:

```adn
' Goes forward the first 10 cycles of life and then goes back
cond
 *.robage 10 <
start
 10 .up store
else
 10 .dn store
stop
```

- `cond` opens the gene and starts the _condition section_.
- `start` closes the conditions and opens the _body_, which runs if they all
  came out true.
- `else` opens a second body, which runs if any came out false.
- `stop` closes the gene.

This bot pushes forward with [[.up]] while its age ([[.robage]]) is
less than 10, and then pushes backward with [[.dn]]. Running it, the bot
moves forward about 400 units, brakes by inertia around cycle 16 and retraces
its steps.

## The condition section {#la-zona-de-condiciones}
<!-- 20-VM §1 (tabla: stores solo en body/ELSEBODY), §5.1-5.2 (AddupCond, vacío = verdadero), §6.6 -->

Between `cond` and `start`, everything runs **except stores**: numbers, memory
reads, operators and comparisons. So you can compute before
comparing:

```adn
' In the condition section you can compute, but not write
cond
 2 3 add 5 =
 7 87 store
start
 1 88 store
stop
```

Here the condition is `2 3 add 5 =` (true) and the body writes 1 to
address 88. The `7 87 store` in the condition section writes nothing: a
[[op:store]] only acts inside a body.

Comparisons, such as [[op:<]] or [[op:=]], leave their result on the boolean
stack (see [[adn/pilas]]). What happens to that stack at each marker is the
key to everything:

- `cond` **empties** the boolean stack at the start.
- `start` (and `else`, when it comes right after the conditions) does a **logical AND
  of everything on the boolean stack** and leaves it empty. If everything is
  true, the body runs.
- If there was no comparison at all, the stack is empty and counts as
  **true**: `cond start … stop` always runs.

You don't need to write [[op:and]] between conditions: three comparisons
in a row are already combined with AND. For an OR, use an explicit [[op:or]].

## A start without cond {#un-start-sin-cond}
<!-- 20-VM §5.2 paso 2, §5.5 -->

A `start` that doesn't come after a `cond` opens a gene **with no conditions**:
it runs every cycle. It's the same as `cond start`, and many bots
begin that way. Bardus, by Moonfisher, is an entire bot made of a single
`cond start … stop` gene that solves everything with arithmetic, without a single
comparison.

## The else {#else}
<!-- 20-VM §5.4 describe el original (else tras start muerto); core vm.hpp ExecuteFlowCommands: elseok/elsecond (A2-1); README del port, «Bugs del original corregidos» -->

In this version, `else` works the way you'd expect:

```adn
' Gene with else: writes 1 or 2 to address 60 depending on *50
cond
 *50 0 >
start
 1 60 store
else
 2 60 store
stop
```

With address 50 at 0, the bot writes 2 to 60; with 50 at 5, it writes
1. The `else` uses the result of the conditions that opened the previous
`start`.

:::cuidado
In the original DarwinBots 2.48.32, the body of an `else` that came after
a `start` **never ran**, whether the condition was true or false, even though
the program's help said otherwise. The port fixes it, and that's why old
bots that use `start … else` (Lionfish or Zer0Bot, among others) behave
differently than in the original. See [[tecnico/diferencias]].
:::

An `else` **attached to the conditions**, without a `start`, also works. Its body
runs only if the conditions come out false, and there's no body for the true case:

```adn
' else without start: runs when the condition is false
cond
 *50 0 >
else
 9 83 store
stop
```

With 50 at 0 it writes 9 to 83; with 50 at 3 it does nothing.

An `else` that doesn't have a `cond … start` right before it **never runs**:
after a `start` without `cond`, after a `stop` or after another
`else`. In this bot only address 84 gets written:

```adn
' else after a start without cond, or after stop: never runs
start
 1 84 store
else
 2 85 store
stop
else
 3 86 store
stop
```

## Code outside the genes {#codigo-fuera-de-los-genes}
<!-- 20-VM §4 (CLEAR suprime token a token; tipo 9 sin gate y con FLOWCOST), §5.5 -->

What's left before the first marker, or between a `stop` and the next
marker, **does not run**. Not even numbers get pushed:

```adn
' What's left outside a gene does not run
5 70 store
start
 1 71 store
stop
7 72 store
cond
 3 73 store
start
 4 74 store
stop
```

Of the five writes, only the one to 71 and the one to 74 happen. The one to 73 doesn't,
because it's in the condition section.

Markers, on the other hand, are always processed, even if the gene is being skipped,
and they charge their cost every time (see [[adn/ejecucion]]). That's why a `cond`
anywhere opens a new gene: it closes the previous body even if its
`stop` is missing.

```adn
' A cond closes the previous gene even if the stop is missing
cond
 1 2 >
start
 1 90 store
cond
start
 2 91 store
stop
```

The first gene doesn't run (1 isn't greater than 2) and the second does: 91 holds 2.

The DNA ends at the first [[op:end]]; whatever follows doesn't exist for the bot.

## Several starts in a row {#varios-start-seguidos}
<!-- 20-VM §5.5 («start tras start») -->

A second `start` isn't an "and also": it opens **another gene, with no conditions**.

```adn
' The second start opens a new gene with no conditions
cond
 *50 0 >
start
 1 75 store
start
 2 76 store
stop
```

With 50 at 0, the condition is false and 75 stays at 0, but 76 gets 2
anyway. If you want two bodies with the same condition, repeat the `cond`.

## The boolean stack carries over from one gene to the next {#la-pila-booleana-pasa-de-un-gen-al-siguiente}
<!-- 20-VM §4 (gate de stores CondStateIsTrue), §5.1 (solo cond limpia), §5.3 -->

Only `cond` clears the boolean stack: neither `stop` nor a `start` with no conditions
does. That's why a condition written inside a body (see
[[adn/condiciones]]) can keep blocking the stores of the next gene if that
gene doesn't begin with `cond`. The example is in [[adn/pilas#rareza]].

If a gene has to run no matter what, begin it with `cond start`, or
clear the stack at the end of the previous gene with [[op:clearbool]] or
[[op:dropbool]].

## Gene numbering {#la-numeracion-de-los-genes}
<!-- 20-VM §2.6, §5.6, §9 (comentarios de gen al exportar); sysvars.yaml 336, 339, 341 -->

Genes are numbered from 1, in order. A new gene is counted for:

- each `cond`;
- each `start` or `else` that does **not** come right after the conditions of
  a `cond`.

Watch out for the second rule: in `cond … start … else … stop`, the `else` counts
as a separate gene. This bot records the number of its gene in each body:

```adn
' Each gene records its number with .thisgene
cond
start
 *.thisgene 61 store
stop
start
 *.thisgene 62 store
stop
cond
 1 2 >
start
 *.thisgene 63 store
else
 *.thisgene 64 store
stop
```

Result: 61 holds 1, 62 holds 2 and 64 holds 4 (the `start` for 63 is
gene 3, which didn't run). [[.genes]] is 4.

| Sysvar | What it holds |
|---|---|
| [[.genes]] | How many genes the DNA has. It updates itself. |
| [[.thisgene]] | The number of the current gene. It changes at every marker, even if the gene is skipped, so at the end of the cycle it holds the last gene's. |
| [[.dnalen]] | The length of the DNA in words. |

That same numbering is used by [[.delgene]], which deletes a gene from the bot's own DNA, and
[[.mkvirus]], which builds a virus from a gene (see [[simulacion/virus]]). When the
engine exports a bot as text it adds comments of the style
`Gene: 5 Begins at position 97`, with the same count (see [[adn/formato]]);
many Bestiary bots include them.

## Summary {#resumen}

| Situation | What happens |
|---|---|
| `cond C start A stop` | A runs if all the conditions in C are true. |
| `cond start A stop` or `start A stop` | A always runs. |
| `cond C start A else B stop` | A if C is true; B if it's false. They are two genes. |
| `cond C else B stop` | B runs if C is false. |
| `else` after `stop`, after another `else` or after a `start` without `cond` | Never runs. |
| `start A start B` | B is another gene, with no conditions. |
| Stores between `cond` and `start` | They don't write. |
| Code outside a gene | It doesn't run. |

<!-- Resumen: 20-VM §4, §5.1-5.6, §2.6; core vm.hpp ExecuteFlowCommands (else corregido A2-1) -->
