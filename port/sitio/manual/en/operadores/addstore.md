---
titulo: addstore
resumen: "Adds a number to what is already in a cell, without having to read it first."
etiquetas: [addstore, addition, writing, accumulator]
estado: revisada
---
<!-- 20-VM §7 (addstore: mod32000(mem+v), d=0 deja v en la pila, cost /5, flags de lazo); comprobado en el port -->

`v d addstore` adds `v` to cell `d`. It is equivalent to
`*d v add d store`, with fewer words and at one fifth of the cost of a
[[op:store]].

| Word | Stack after |
|---|---|
| `2` | 2 |
| `50` | 2 50 |
| `addstore` | (empty); cell 50 ends up 2 higher |

It is good for accumulating: adding up what an eye sees, keeping a total, or
growing a command a little at a time.

```adn
' speeds up gradually: asks for 2 more each cycle, up to 40
cond
start
 2 50 addstore
 40 50 ceilstore
 *50 .up store
stop
```

Cell 50 holds 2, 4, 6… and from cycle 20 on it stays at 40, the ceiling set
by [[op:ceilstore]]. [[.up]] receives that value every cycle.

With a negative `v` it subtracts, so `-3 50 addstore` does the same as
`3 50 substore`. The result is clipped to ±32000, just like in [[op:store]],
and with address 0 the value stays on the stack unused.

Unlike [[op:inc]], `addstore` does notify the tie system when you write to
[[.tieang1]] or [[.tielen1]]: to add 1 to a tie's angle, `1 .tieang1 addstore`
is the right way.
