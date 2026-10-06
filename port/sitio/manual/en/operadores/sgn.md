---
titulo: sgn
resumen: "Replaces the top number of the stack with its sign: −1 if negative, 0 if zero and 1 if positive."
etiquetas: [arithmetic, sign, basics]
estado: revisada
---
<!-- 20-VM §6.1 (sgn) -->

`x sgn` leaves −1, 0 or 1 depending on the sign of `x`. It's useful for
keeping the _direction_ of something and forgetting the size: which side it's
on, whether it went up or down, whether there is any or not.

| `x` | `x sgn` |
|---|---|
| −250 | −1 |
| 0 | 0 |
| 37 | 1 |

Combined with [[op:mult]] it gives a fixed-size step in whichever direction is
needed. This bot keeps its energy in cell 51 and, in cell 50, +5 or −5
depending on whether the energy went up or down since the previous cycle (0 if
it didn't change):

```adn
cond
start
  *.nrg *51 sub sgn 5 mult 50 store
  *.nrg 51 store
stop
```

To find out only whether a number is nonzero (1) or not (0), regardless of
sign, use `sgn abs`; if it's for a condition, `x 0 !=` ([[op:!=]]) is enough.
If what you want is to write the sign into a cell, there is
[[op:sgnstore]].
