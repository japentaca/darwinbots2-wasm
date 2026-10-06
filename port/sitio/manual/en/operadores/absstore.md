---
titulo: absstore
resumen: "Strips the sign from what is in a cell: a negative becomes positive."
etiquetas: [absstore, absolute value, writing]
estado: revisada
---
<!-- 20-VM §7 (absstore: Abs(mem), sin mod32000, cost /8, sin flags de lazo); comprobado en el port -->

`d absstore` pops the address `d` and leaves in the cell the absolute value of
what it held: −77 becomes 77, and a positive stays the same. It takes no value
from the stack.

| Word | Stack after |
|---|---|
| `50` | 50 |
| `absstore` | (empty); if cell 50 held −77, it now holds 77 |

It is handy for measuring a distance regardless of side:

```adn
' stores in 50 how far the energy is from 5000, above or below
cond
start
 *.nrg 5000 sub 50 store
 50 absstore
stop
```

With 3000 energy ([[.nrg]]) the cell ends up at 2000, just as with 7000.
After that a single comparison, such as `*50 500 <`, is enough to tell whether
the energy is close to 5000.

It is the same as `*50 abs 50 store` (see [[op:abs]]), with fewer words and at
one eighth of the cost of a [[op:store]]. To flip the sign instead of removing
it there is [[op:negstore]].
