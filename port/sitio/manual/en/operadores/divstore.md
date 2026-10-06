---
titulo: divstore
resumen: "Divides what is in a cell by a number, rounding to the nearest integer; dividing by 0 leaves the cell at 0."
etiquetas: [divstore, division, writing, rounding]
estado: revisada
---
<!-- 20-VM §7 (divstore: v=0 -> 0; mem/v real con redondeo bancario; sin mod32000; d=0 consume v; cost /5, flags de lazo); comprobado en el port -->

`v d divstore` leaves in cell `d` what it held divided by `v`. It gives the same
as `*d v div d store`, with fewer words and at one fifth of the cost of a
[[op:store]].

| Word | Stack after |
|---|---|
| `2` | 2 |
| `50` | 2 50 |
| `divstore` | (empty); cell 50 holds half of what it did |

The division **rounds** to the nearest integer, it does not truncate, and on an
exact tie it goes to the even one. You can see it well by halving over and over:

```adn
' halves cell 50 every cycle
cond
 *.robage 0 =
start
 100 50 store
stop
start
 2 50 divstore
stop
```

The cell goes through 50, 25, 12, 6, 3, 2, 1 and 0. Note the ties: 12.5 gives
12, 1.5 gives 2 and 0.5 gives 0.

Two traps:

- **Dividing by 0 does not leave the cell as it was: it sets it to 0.** If the
  divisor comes from a reading that can be 0, guard it with a condition.
- With address 0, unlike [[op:store]], the value **is** popped from the stack
  and lost.

Like [[op:store]], it notifies the tie system if you write to [[.tieang1]] or
[[.tielen1]]. Division on the stack, without storing, is [[op:div]].
