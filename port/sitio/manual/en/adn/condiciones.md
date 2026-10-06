---
titulo: Inline conditions
resumen: "Comparisons leave trues and falses on the boolean stack; this page covers how they combine with and, or and not, and how they decide which stores run, before and after start."
etiquetas: [conditions, boolean stack, and, or, not, cond]
estado: revisada
---
A bot makes decisions by comparing numbers. Each comparison pops numbers off the integer stack
and leaves a _true_ or a _false_ on the [[adn/pilas|boolean stack]]. What's on
that stack then decides which writes to memory happen and which don't.

Conditions can go in two places in a gene: between `cond` and `start`, where they
decide whether the body runs (see [[adn/genes]]), or inside the body, after
`start`. The latter are the _inline_ conditions, and they give this page its
name.

## The comparisons {#las-comparaciones}
<!-- 20-VM §6.4 (incluido el intervalo invertido de %= y ~= con referencia negativa, §12.4) -->

They all read the stack from left to right: `a b >` asks “is `a` greater than
`b`?”. So `*.nrg 5000 >` is true when the energy is above 5000.

There are ten: [[op:<]], [[op:>]], [[op:<=]], [[op:>=]], [[op:=]], [[op:!=]] and the
“approximate” ones [[op:%=]], [[op:!%=]], [[op:~=]] and [[op:!~=]]. The table of what
each one asks is in [[adn/operadores#comparaciones]].

The two “approximate” ones take `a` as the reference. `100 109%=` is true
(109 is within 10 of 100) and `100 111%=` is false. `~=` pops a third number,
the percentage: `100 120 25 ~=` is true and `100 130 25 ~=` is not.

:::cuidado
A quirk inherited from DarwinBots 2.48.32: with a negative reference, `%=` and `~=`
are **always false**, even if both numbers are equal (`-100 -100%=` gives
false). If you compare values that can be negative, such as a speed, use
[[op:abs]] first, or a subtraction and `<`.
:::

If the integer stack runs short of numbers, the comparisons use zeros: `=` on an
empty stack compares 0 with 0 and gives true. The complete list, with the details of
each one, is in [[operadores/comparaciones]].

## In the cond section {#en-la-seccion-cond}
<!-- 20-VM §1 (stores solo en body/ELSEBODY), §5.1-5.2 (AddupCond; vacío = verdadero) -->

Between `cond` and `start` you can put as many conditions as you like. When it reaches
`start`, the engine joins them all with an _and_: the body runs only if all of them are
true. A gene with no conditions at all always runs, because an empty boolean stack
counts as true.

In that section, numbers and comparisons are computed, but stores never
run. This gene writes nothing to cell 50:

```adn
cond
 5 50 store
start
stop
```

## and, or and not {#and-or-y-not}
<!-- 20-VM §6.5 (operando ausente = verdadero), §6.6; Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt, gen 3 -->

If you want something other than the _and_ of all of them, combine them yourself with the
logical operators, which work on the two booleans at the top of the stack:

| Word | Leaves |
|---|---|
| [[op:and]] | true if both are true |
| [[op:or]] | true if either one is |
| [[op:xor]] | true if one is and the other isn't |
| [[op:not]] | the opposite of the top one |
| [[op:true]] / [[op:false]] | a true / a false, without looking at anything |

This gene, the third gene of _Animal Minimalis_ (Numsgil), from the Bestiary, turns at random
if it sees nothing **or** if what it sees is of its own species:

```adn
' turns if it sees nothing or if what it sees is its own species
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 314 rnd .aimdx store
stop
```

Without that `or`, the two conditions would be joined with _and_ on reaching `start`, and the gene
would do something else. Read it like a stack calculator: [[.eye5]] `0 =` leaves one
boolean, [[.refeye]] [[.myeye]] `=` leaves another on top, and `or` replaces the
two with a single one.

When a logical operator is missing an operand, it substitutes true: a lone
`or` on an empty stack leaves true; a lone `not` leaves false (the opposite of “empty”, which
is true).

## Conditions inside the body {#en-linea}
<!-- 20-VM §4 (tipo 7: CondStateIsTrue mira el tope sin consumir), §5.5, §6.6 -->

After a `cond … start`, the boolean stack starts out empty, that is, true, and
all the stores run. If you put a condition in the middle of the body, its result stays on top
of the stack and **every store that comes after it checks it**: if it's true, the store
runs; if it's false, it's skipped. The store looks at the top without popping it, so the same
condition governs all the following stores, until something else changes it.

With [[op:not]] that gives you an “else” inside the same gene:

```adn
' goes forward for the first few cycles and then backward
cond
start
*.robage 5 <
20 .up store
not
20 .dn store
stop
```

While [[.robage]] is less than 5, the condition is true: it writes to [[.up]] and
the `.dn` is skipped. From the sixth cycle on it's the other way around and the bot pushes backward;
because of inertia, it takes a couple of cycles to brake and turn around.

Inline conditions govern **only stores** (including `inc`, `dec` and the
rest of the family in [[adn/stores]]). The numbers, the arithmetic and the other
comparisons in the body always run, whether what's on
the stack is true or false.

## Chaining conditions {#encadenar-condiciones}
<!-- 20-VM §6.5 (and), §6.6 -->

A new condition doesn't add to the previous one: it's pushed on top and rules alone. If
you want a store to depend on two things, join them with `and`:

```adn
start
 1 2 =
 3 3 =
 1 50 store
 and
 1 51 store
stop
```

The first store runs, even though `1 2 =` is false, because `3 3 =` is on top, and it's
true. After the `and`, a false is left on top, and the second store is skipped: cell
50 ends up as 1 and cell 51 as 0.

## Enabling stores again {#volver-a-habilitar-los-stores}
<!-- 20-VM §6.5 (true, dropbool, clearbool); Bestiario: Animal_Minimalis_Antivirus_Shasta.txt, gen 1 -->

To make the stores that follow run unconditionally again, you have three options:

- [[op:true]] pushes a true on top. What's underneath is still there, but no longer rules.
- [[op:dropbool]] pops the top one and lets the previous one rule.
- [[op:clearbool]] empties the stack, and empty counts as true.

The _Animal_Minimalis Antivirus_ variant (Shasta), from the Bestiary, writes all its
conditions inline and uses the first one. Its food-seeking gene moves the bot only if it
sees something that isn't of its own species, and at the end it records the gene number no matter what
(in the original, address 71 has a name set with [[adn/def]]):

```adn
' Gene 1 of Animal_Minimalis Antivirus: looks for food
cond
start
 *.eye5 0 >
 *.refeye *.myeye != and
 *.refveldx .dx store
 *.refvelup 30 add .up store
 true
 *.thisgene 71 store
stop
```

If you run it on its own, with no food in sight, the bot doesn't move, but cell 71 gets
filled anyway: the `true` left the last store enabled.

## Two traps {#dos-trampas}
<!-- 20-VM §4 (el gate va antes de ExecuteStores: un store salteado no hace pops), §5.1 -->

**A skipped store pops nothing from the integer stack.** Its value and its address
stay there, and the next store that runs may find them:

```adn
start
 false
 5 50 store
 true
 60 store
stop
```

The first store is skipped and leaves the 5 and the 50 on the stack. After the `true`, the
`60 store` pops the 60 as the address and the 50 as the value: cell 60 ends up as 50,
not 5. If a store can be skipped, make sure there are no “half-done” stores after it
that count on a tidy stack.

**A `start` without `cond` doesn't clear the boolean stack.** Only `cond` empties it. If a
gene leaves a false inline and the next one starts directly with `start`, that false
keeps blocking its stores (the example is in [[adn/pilas#rareza]]). To be safe,
end your inline conditions with a `clearbool` or open every gene with `cond`.
