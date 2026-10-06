---
titulo: sgnstore
resumen: "Replaces what's in a cell with its sign: −1 if negative, 0 if zero, 1 if positive."
etiquetas: [sgnstore, sign, write]
estado: revisada
---
<!-- 20-VM §7 (sgnstore: Sgn(mem), sin mod32000, cost /7, sin flags de lazo); comprobado en el port -->

`d sgnstore` pops the address `d` and leaves in the cell only the sign of what
it held: −1, 0 or 1. It takes no value from the stack.

| Word | Stack afterwards |
|---|---|
| `51` | 51 |
| `sgnstore` | (empty); if cell 51 held −77, it now holds −1 |

It's useful for keeping the _direction_ of a change and forgetting the size:

```adn
' cell 51 ends up at -1, 0 or 1 depending on whether energy went down, stayed the same or went up
cond
start
 *.nrg *50 sub 51 store
 51 sgnstore
 *.nrg 50 store
stop
```

Cell 50 keeps the energy ([[.nrg]]) from the previous cycle. The difference
goes to cell 51 and `sgnstore` reduces it to its sign. A bot that is spending
energy sees −1 there almost every cycle. The value, now turned into −1, 0 or 1,
can then be multiplied by whatever you like.

It's the same as `*51 sgn 51 store` (see [[op:sgn]]), with fewer words and at
a seventh of the cost of a [[op:store]].
