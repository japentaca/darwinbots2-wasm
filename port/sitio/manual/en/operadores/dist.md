---
titulo: dist
resumen: "Gives the straight-line distance from the bot to a point x y."
etiquetas: [geometry, distance, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (dist: multiplica por Divisor, unidades de mundo; asimetría con angle); comprobado en el port, también en campo 64000×48000 -->

`x y dist` pops a point (the `x` below, the `y` on top) and pushes the distance
from the bot to it. `*.refxpos *.refypos dist` is the distance to whatever it
is looking at; with [[op:angle]] on the same point you also know which way it
lies.

This bot notes where it was at the start ([[.xpos]] and [[.ypos]] in cells 50
and 51) and, every time it moves more than 300 away from that place, it aims
back toward it:

```adn
cond
  *.robage 1 =
start
  *.xpos 50 store
  *.ypos 51 store
stop

cond
  *.robage 1 >
  *50 *51 dist 300 >
start
  *50 *51 angle .setaim store
stop

cond
start
  10 .up store
stop
```

The position is noted with [[.robage]] at 1 and not at 0 because in the first
cycle `*.xpos` is still 0.

:::nota
In a world wider or taller than 32000, the positions you read in `.xpos` and
`.ypos` come scaled down to fit in memory, but `dist` returns the distance at
the real size of the world. In a world 64000 wide, a point 1000 units to the
right according to `.xpos` gives a distance of 2000. In normal-size worlds the
two scales coincide.
:::
