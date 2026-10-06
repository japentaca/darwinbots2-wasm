---
titulo: multstore
resumen: "Multiplies what's in a cell by a number and stores the result right there."
etiquetas: [multstore, multiplication, write]
estado: revisada
---
<!-- 20-VM §7 (multstore: mod32000(mem · mod32000(v)), d=0 deja v en la pila, cost /5, flags de lazo); comprobado en el port -->

`v d multstore` leaves in cell `d` what it held multiplied by `v`. It is
`*d v mult d store` in two words, at a fifth of the cost of a
[[op:store]].

| Word | Stack afterwards |
|---|---|
| `2` | 2 |
| `50` | 2 50 |
| `multstore` | (empty); cell 50 holds double |

```adn
' doubles cell 50 every cycle, starting at 1
cond
 *50 0 =
start
 1 50 store
stop
start
 2 50 multstore
stop
```

The cell goes through 2, 4, 8… up to 16384. The next cycle it doesn't give
32768 but **768**: the result is clipped to ±32000 in a circular way, as in
all stores (see [[adn/numeros#recorte]]). With multiplications it's easy to
go over, so if the number can grow, put a ceiling on it with
[[op:ceilstore]] before it reaches the edge.

Some uses: `-1 50 multstore` changes the sign (so does
[[op:negstore]], more cheaply), and `0 50 multstore` sets it to 0.

With address 0 the value is left on the stack unused. Like
[[op:store]], it notifies the tie system if you write to [[.tieang1]] or
[[.tielen1]].
