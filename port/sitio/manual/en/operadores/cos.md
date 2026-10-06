---
titulo: cos
resumen: "Gives the cosine of an angle in .aim units, multiplied by 32000: 0 cos gives 32000."
etiquetas: [trigonometry, cosine, angle, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (cos: Cos(a/200)·32000, redondeado); comprobado en el port -->

`angle cos` leaves the cosine of the angle multiplied by 32000 and rounded. It
works just like [[op:sin]]: the angle in [[.aim]] units (about 1256 per turn)
and the result between −32000 and 32000.

| Angle | `cos` |
|---|---|
| 0 (to the right) | 32000 |
| 314 (up) | 25 (almost 0: 314 is not exactly a quarter turn) |
| 628 (to the left) | −32000 |

The cosine gives the _horizontal_ part of a movement. This bot computes how far
it advances to the right for every 100 it moves toward where it is aiming, and
stores it in cell 50 (negative if it aims left):

```adn
cond
start
  *.aim cos 100 mult 32000 div 50 store
stop
```

Multiply before dividing: `*.aim cos 32000 div 100 mult` can only give 0, −100
or 100, because the division rounds to an integer before scaling.
