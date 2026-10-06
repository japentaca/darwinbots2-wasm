---
titulo: rndstore
resumen: "Replaces what's in a cell with a random number between 0 and that value, with the same sign."
etiquetas: [rndstore, random, chance, write]
estado: revisada
---
<!-- 20-VM §7 (rndstore: Random(0, Abs(mem))·Sgn(mem), consume 1 RNG, sin mod32000, cost /7, sin flags de lazo); core vm.hpp DNArndstore; comprobado en el port: -5 da -5..0 (200 ciclos) -->

`d rndstore` pops the address `d` and replaces what's in the cell with a
random integer between 0 and that number, both included. It takes no value
from the stack: the top of the draw is whatever was already stored.

| Word | Stack afterwards |
|---|---|
| `50` | 50 |
| `rndstore` | (empty); if cell 50 held 20, it now holds something between 0 and 20 |

That's why it almost always comes after a [[op:store]] that loads the top:

```adn
' turns after a random wait of 0 to 20 cycles
cond
 *50 0 =
start
 100 .aimdx store
 20 50 store
 50 rndstore
stop
cond
 *50 0 >
start
 50 dec
stop
```

Each time the count reaches 0, the bot turns with [[.aimdx]] and draws a new
wait, which [[op:dec]] counts down. If the draw gives 0, it turns again in the
next cycle.

With a negative number the draw is symmetric: if the cell holds −5, it ends
up with something between −5 and 0. That's what sets it apart from
[[op:rnd]], which with `-5` gives −4 to −1. On a cell holding 0 it always
gives 0.

If you only want a random number to use right away, [[op:rnd]] is more
direct: `20 rnd 50 store` draws in the same range, 0 to 20, as
`20 50 store 50 rndstore`. With negatives, as seen, the ranges differ.
