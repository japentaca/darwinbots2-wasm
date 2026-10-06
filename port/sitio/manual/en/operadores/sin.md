---
titulo: sin
resumen: "Gives the sine of an angle in .aim units, multiplied by 32000: 314 sin gives 32000."
etiquetas: [trigonometry, sine, angle, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (sin: Sin(a/200)·32000, redondeado, sin normalizar); comprobado en el port -->

`angle sin` leaves the sine of the angle multiplied by 32000 and rounded. The
angle is in the units of [[.aim]] (200 per radian, about 1256 per turn), and
the result goes from −32000 to 32000 instead of −1 to 1, because the stack has
no decimals.

| Angle | `sin` |
|---|---|
| 0 | 0 |
| 157 (an eighth of a turn) | 22618 |
| 314 (straight up) | 32000 |
| 942 (straight down) | −32000 |

To use it as a fraction, multiply first and divide by 32000 at the end. The
sine gives the _vertical_ part of a movement: if the bot moves 100 in the
direction of the angle stored in cell 50, it goes up
`*50 sin 100 mult 32000 div`.

```adn
cond
start
  *.aim sin 100 mult 32000 div 51 store
  *.aim cos 100 mult 32000 div 52 store
stop
```

This bot stores in cells 51 and 52 how much it goes up and how much it goes
right for every 100 it moves in the direction it's aiming.

One detail: since a full turn is 1256.6 and not exactly 1256, `1256 sin` gives
−102, not 0. For angles that go around more than once it's best to reduce them
first with `1256 mod`. The cosine is [[op:cos]].
