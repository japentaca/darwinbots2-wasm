---
titulo: The integer and boolean stacks
resumen: "The DNA computes with two stacks, one of numbers and one of true or false: how much they hold, what happens when they fill up or run empty, and when they start from zero."
etiquetas: [stack, boolean, conditions, store, DNA]
estado: revisada
---
The DarwinBots DNA is a _stack-based_ language: there are no variables or parentheses,
and every word leaves something on a stack or takes it off. If you have ever used an
RPN calculator, you already know the idea: operands first, then
the operation.

There are **two stacks**, and each word knows which one it works with:

| Stack | Holds | Filled by | Emptied by |
|---|---|---|---|
| Integer | numbers | bare numbers, reads such as `*.nrg`, operators such as [[op:add]] | operators, conditions and stores |
| Boolean | true or false | conditions such as [[op:>]], [[op:true]], [[op:false]] | logic operators such as [[op:and]], the `start` of a gene, [[op:dropbool]] |

## The integer stack {#entera}
<!-- 20-VM §3, §6 (convención a b, b en el tope), §6.1 (rango ±2·10⁹), §7 -->

A number written in the DNA is pushed. An operator pops the ones it needs and
pushes the result. A store pops an address and a value and writes to the
bot's memory. This bot adds 3 and 4 and stores the 7 at address 50, a
free memory cell:

```adn
cond
start
  3 4 add 50 store
stop
```

Step by step, the integer stack ends up like this (top on the right):

| Word | Stack afterwards |
|---|---|
| `3` | 3 |
| `4` | 3 4 |
| `add` | 7 |
| `50` | 7 50 |
| `store` | (empty): it wrote 7 to address 50 |

Order matters in operations that aren't commutative: `10 3 sub` is
10 − 3, and `*.nrg 1000 >` asks whether the energy is greater than 1000. The rule is
always the same: the one lower down is the first operand. That is why a
store is written _value address_ [[op:store]], with the address on top.

The integer stack can hold numbers much larger than memory can (up to
about two billion); the clipping to ±32000 only happens when storing. We
cover it in [[adn/numeros]].

## The boolean stack {#booleana}
<!-- 20-VM §5.2 (AddupCond: AND de toda la pila), §6.4, §6.5, §6.6 -->

Conditions pop two numbers from the integer stack and push a result onto
the boolean one. `*.nrg 1000 >` pops the energy and the 1000 and pushes _true_ or
_false_. The logic operators ([[op:and]], [[op:or]], [[op:not]], [[op:xor]]) work
only on the boolean stack.

Several conditions in a row between `cond` and `start` are combined with an implicit
_and_: `start` does the _and_ of everything on the boolean stack and leaves it
empty. For an _or_ you have to write it. In this bot the first condition is
true and, of the other two, only one is; with [[op:or]] the gene runs and
writes 9 to address 57:

```adn
cond
  1 1 =
  2 2 = 3 4 = or
start
  9 57 store
stop
```

Everything about a gene's conditions is in [[adn/genes]], and the operators one
by one are in [[adn/operadores]].

## Size: 101 slots {#tamano}
<!-- 20-VM §0.1, §3 (push sobre lleno descarta el fondo, igual en las dos pilas) -->

Each stack has room for **101 values**. If you push one more, the stack doesn't
raise an error: **the oldest value is lost**, the one at the bottom, and the new one goes in on top.

We checked this by pushing a 1000 and then 101 ones: when you add everything up, the
result is 101, not 1101, because the 1000 at the bottom fell off when the
last 1 went in. In practice you won't reach 101 except through a bug (a number
that gets pushed on every pass and nobody pops), but it is worth knowing that it gives no warning.

## Popping from an empty stack {#vacia}
<!-- 20-VM §0.1, §3 (pop vacío: 0 / centinela −5 = verdadero; dup, dupbool, over, overbool, swap), §6.5 -->

There is no error when popping from an empty stack either. Each stack has its own rule:

- **The integer one gives 0.** An operator that finds no operands works with
  zeros.
- **The boolean one, when empty, counts as true.** This is the rule with the most
  consequences.

For example, this bot pushes nothing before the store: it pops the address 52
fine, but the value comes off the empty stack and is 0. If address 52 held
another number, it ends up at 0:

```adn
cond
start
  52 store
stop
```

And by the rule of _empty = true_:

- A gene with no conditions (`cond start`, or a bare `start`) always
  runs.
- A store runs if the boolean stack is empty (see below).
- [[op:not]] on the empty boolean stack pushes _false_ (the opposite of
  true).
- [[op:and]] with a single value leaves that value; [[op:or]] with just one gives
  _true_.

Some stack operators have asymmetries inherited from DarwinBots 2.48.32
that the port preserves as they are:

| Operator | With an empty stack | With a single value |
|---|---|---|
| [[op:dup]] | pushes two zeros | duplicates it |
| [[op:dupbool]] | does nothing | duplicates it |
| [[op:over]] | does nothing | pushes a 0 on top |
| [[op:overbool]] | does nothing | pushes _true_ on top |
| [[op:swap]], [[op:swapbool]] | do nothing | do nothing |

## When they are emptied {#cuando}
<!-- 20-VM §4 (stacks limpiados al entrar cada bot), §5.1-5.3; 10-CICLO §3 -->

**At the start of each bot's turn, in every cycle, both stacks start
empty.** Nothing passes from one cycle to the next through the stacks: whatever you want to
remember you have to store in memory (see [[adn/memoria]]). This bot leaves
a 7 on the stack at the end of its turn; in the next cycle the store doesn't
find it and writes 0 to address 50:

```adn
cond
start
  50 store
  7
stop
```

Within a single cycle, however, **the integer stack is not emptied between
genes**. A number left over in one gene can be used by the next. Here the
first gene pushes a 7 and the second stores it at address 51:

```adn
start
  7
stop

start
  51 store
stop
```

It works, but it makes the bot fragile: if the first gene doesn't run, the second
finds something else. It is better for each gene to leave the stack as it found it.

The boolean stack has two moments of cleanup:

- **`cond`** empties it when opening the gene.
- **`start`**, when it comes after a `cond`, consumes all of it to decide whether the
  gene runs.

### An oddity: the boolean that survives {#rareza}
<!-- 20-VM §4 (gate CondStateIsTrue sin consumir), §5.1 (solo cond limpia), §5.2 (start sin cond no hace AddupCond); comprobado en el port -->

A gene that begins directly with `start` (without `cond`) doesn't clear the boolean
stack. If the previous gene left a _false_ on top, that _false_ blocks the
stores of the new gene, even though the gene runs. In this bot address 51
is never written:

```adn
start
  1 2 = 3 50 store
stop

start
  4 51 store
stop
```

Opening the second gene with `cond` is enough for the boolean stack to start
clean and the 4 to be stored. The false keeps ruling in all the genes that
come after, until the next `cond`. This is behavior from the original DarwinBots that the
port keeps so that old bots behave the same. If you write genes
with conditions in the body, open every gene with `cond`, or end the body with
[[op:clearbool]].

## Conditions inside the body {#en-el-cuerpo}
<!-- 20-VM §4 (tipo 7), §5.5, §6.6 -->

A condition can also be evaluated between `start` and `stop`. It doesn't decide whether the
gene runs, but **the top of the boolean stack governs all the stores that
follow**: if it is _false_, they don't write; if it is _true_ or the stack is empty,
they do. The store looks at the top without popping it, so the same result keeps ruling
until you pop it with [[op:dropbool]], cover it with another condition, or empty
the stack with [[op:clearbool]].

```adn
cond
start
  1 2 > 7 53 store
  dropbool
  8 54 store
stop
```

Since 1 is not greater than 2, the 7 isn't stored in 53; after the
[[op:dropbool]] the stack is left empty (true) and the 8 is stored in 54.
Careful: the condition only stops the stores. The numbers and operators in the body
run all the same.

The Bestiary bot “Alga_Pair 1.1.1” uses this technique in one line: it counts
one more generation only in the cycle in which it is born (when [[.robage]] is 0) and
immediately discards the condition so it doesn't stop the rest of the gene:

```adn
def generation 971

cond
start
  .generation *.robage 0 = inc dropbool
stop
```

Note that [[op:inc]] is also a store, which is why the condition stops it. The
full technique, with more examples, is in [[adn/condiciones]].

## Summary {#resumen}

| | Integer stack | Boolean stack |
|---|---|---|
| Size | 101 values | 101 values |
| On overflow | the oldest is lost | the oldest is lost |
| Popping when empty | gives 0 | counts as true |
| Emptied | at the start of the bot's turn | at the start of the turn, at every `cond` and when `start` decides |
| Passes from one gene to the next | yes, within the same cycle | only if the next gene doesn't open with `cond` |
| Passes to the next cycle | no | no |

<!-- Resumen: 20-VM §3, §4, §5.1-5.5, §6.5, §6.6 -->
