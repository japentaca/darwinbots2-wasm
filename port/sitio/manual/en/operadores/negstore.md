---
titulo: negstore
resumen: "Flips the sign of what's in a cell: 20 becomes −20 and −20 becomes 20."
etiquetas: [negstore, sign, write]
estado: revisada
---
<!-- 20-VM §7 (negstore: -mem, sin mod32000, cost /8, sin flags de lazo; §12.6); comprobado en el port -->

`d negstore` pops the address `d` and flips the sign of whatever is in that
cell. It takes no value from the stack.

| Word | Stack afterwards |
|---|---|
| `50` | 50 |
| `negstore` | (empty); if cell 50 held 20, it now holds −20 |

Applied every cycle, it makes a value swing between two extremes:

```adn
' moves forward wiggling: turns 20 to one side and 20 to the other, every other cycle
cond
 *50 0 =
start
 20 50 store
stop
start
 50 negstore
 *50 .aimdx store
 10 .up store
stop
```

The first gene loads 20 the first time. From then on cell 50 alternates
between −20 and 20, and the bot turns with [[.aimdx]] to one side and then the
other while moving forward with [[.up]].

It's the same as `-1 50 multstore` (see [[op:multstore]]), but cheaper: an
eighth of the cost of a [[op:store]]. Watch out for [[.tieang1]] and
[[.tielen1]]: `negstore` changes the number, but the tie doesn't find out;
there use `-1 .tieang1 multstore` (see [[adn/stores]]).
