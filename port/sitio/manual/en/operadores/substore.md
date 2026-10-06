---
titulo: substore
resumen: "Subtracts a number from what's already in a cell: the cell minus the value."
etiquetas: [substore, subtraction, write, timer]
estado: revisada
---
<!-- 20-VM §7 (substore: mod32000(mem-v), d=0 deja v en la pila, cost /5, flags de lazo); comprobado en el port -->

`v d substore` leaves in cell `d` what it held minus `v`. It is
`*d v sub d store` in two words, at a fifth of the cost of a
[[op:store]].

| Word | Stack afterwards |
|---|---|
| `3` | 3 |
| `50` | 3 50 |
| `substore` | (empty); cell 50 holds 3 less |

```adn
' counts down in steps of 3, from 30
cond
 *.robage 0 =
start
 30 50 store
stop
cond
 *50 0 >
start
 3 50 substore
stop
```

In the first cycle [[.robage]] is 0: the first gene loads 30 and the second
already subtracts 3 from it. The cell goes through 27, 24, 21… and in cycle 10
it reaches 0, where the condition stops it.

:::cuidado
The order is value first, address on top, as in all stores. If you write it
the other way around, `50 3 substore` subtracts 50 from cell 3, which is
[[.sx]].
:::

With address 0 the value is left on the stack unused, and the result is clipped
to ±32000. Subtracting 1 is cheaper with [[op:dec]], but on [[.tieang1]] or
[[.tielen1]] you should use `substore`, which notifies the tie system.
Addition is [[op:addstore]].
