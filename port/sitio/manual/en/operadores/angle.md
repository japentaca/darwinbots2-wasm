---
titulo: angle
resumen: "Gives the angle from the bot to a point x y, in the same units as .aim: ready to store in .setaim."
etiquetas: [geometry, angle, aiming, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (angle: pos/Divisor, Y invertida, ×200); comprobado en el port: (1496,100) desde (1496,1107) da 314; Bestiario: 4-d_Swarmer.txt, gen «Turn to a veg»; ejemplo probado con otro bot a la vista -->

`x y angle` pops a point (the `x` first, the `y` on top) and pushes the angle
you have to look at to go from the bot to that point. The result is in the
units of [[.aim]]: from 0 to about 1256, with 0 pointing right, 314 up, 628
left and 942 down.

The coordinates are the same ones that [[.xpos]], [[.ypos]], [[.refxpos]] and
[[.refypos]] give, so the typical use is to aim at whatever is being seen and
store the result in [[.setaim]]. That is what _4-d Swarmer_, from the
Bestiary, does in its gene for turning toward the vegetables; simplified, it
looks like this:

```adn
cond
  *.eye5 0 >
start
  *.refxpos *.refypos angle .setaim store
  10 .up store
stop
```

It also works with a fixed point: `3000 2500 angle .setaim store` aims toward
(3000, 2500) from wherever the bot is.

Note that the angle is computed from the bot's _current_ position, but reads
such as `*.refxpos` arrive one cycle late; if the other bot moves fast, you
aim at where it was. To know how much is left to turn from the current
heading, combine it with [[op:anglecmp]]; for the distance to the same point,
[[op:dist]].
