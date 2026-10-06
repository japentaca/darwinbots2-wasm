---
titulo: sqr
resumen: "Replaces the top number of the stack with its rounded square root; if it isn't positive, it gives 0."
etiquetas: [math, square root, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (sqr: a > 0 → Sqr redondeado, si no 0); Bestiario: Pacifist v0.01 (1_5.txt); comprobado en el port -->

`x sqr` leaves the square root of `x`, rounded to the nearest integer:
`100 sqr` gives 10, `10 sqr` gives 3 and `2 sqr` gives 1. Careful, the name
is misleading: it doesn't square (for that, `x dup mult` or `x 2 pow`).

With a negative number, or with 0, it gives **0**. That, which seems like a
detail, is exploited by several bots in the Bestiary: `x sqr dup div` is 1 if
`x` is positive and 0 if not, because [[op:div]] by zero gives 0.
_Pacifist v0.01_ uses it to load venom only when it has more than 100 energy:

```adn
cond
start
  ' the address ends up at 824 if *.nrg − 100 is positive, and at 0 if not
  40 .strvenom *.nrg 100 sub sqr dup div mult store
stop
```

Look at what gets multiplied: not the 40, but the address of [[.strvenom]],
which ends up at 824 or at 0. And a [[op:store]] to address 0 does nothing
(see [[adn/numeros#cero]]), so the 40 is only written when there's energy to
spare.

For the length of a vector, which is the root of a sum of squares, there is
[[op:pyth]]; for other roots, [[op:root]].
