---
titulo: ++
resumen: "Adds 1 to the number on top of the integer stack, without touching memory: 5 ++ leaves 6."
etiquetas: [bits, counting, integer stack]
estado: revisada
---
<!-- 20-VM §6.3 (++ con acarreo; edge 2147483647 ++ → 0); Bestiario: 1_6.txt (Guardian-0.9); comprobado en el port -->

`x ++` pops a number and pushes that number plus 1. `5 ++` gives 6, `-1 ++`
gives 0. For the numbers you will be handling it is the same as `1 add`,
written shorter.

:::cuidado
`++` is not [[op:inc]]. `inc` is a store: it adds 1 to a _memory cell_ and only
runs if the conditions allow it. `++` adds 1 to the number on the _stack_ and
stores nothing. `50 inc` counts in cell 50; `50 ++` leaves a 51 on the stack.
:::

The bot _Guardian-0.9_ (Trafalgar), from the Bestiary, uses it in a trick to
turn any number into an “is zero” flag: `x sgn abs - ++` leaves 1 if `x` is 0
and 0 if not. Step by step, with `x` = −9 and with `x` = 0:

| Word | Stack (x = −9) | Stack (x = 0) |
|---|---|---|
| [[op:sgn]] | −1 | 0 |
| [[op:abs]] | 1 | 0 |
| [[op:-]] | −1 | 0 |
| `++` | 0 | 1 |

Multiplied by a value, it lets you write something only when a cell is at 0,
without using conditions. This gene stores 700 in cell 80 only if it was
empty:

```adn
cond
start
  700 *80 sgn abs - ++ mult *80 add 80 store
stop
```

If cell 80 held 0, the flag is 1 and 0 + 700 is stored; if it already held
something, the flag is 0 and what was there is stored again.

One inherited quirk, only at the edge of 32 bits: `++` on the largest number
that fits on the stack (2147483647) gives 0 instead of wrapping around to the
most negative number (−2147483648). With an empty stack it operates on 0 and leaves 1.
Its opposite is [[op:--]].
