---
titulo: .hitdn
resumen: "It is 1 in the cycle after a collision from behind, with something the bot had at its back."
etiquetas: [collision, touch, sense, direction]
estado: revisada
---
<!-- sysvars.yaml .hitdn; umbrales del tacto en el core (touch, senses.hpp): 2,36 a 3,92 rad -->
`.hitdn` turns on when the bot collides with something behind it: the center of
the other one falls inside a cone of about 45 degrees on each side of the
direction opposite to its heading ([[.aim]]). It is the direction of [[.hit]]
opposite to [[.hitup]]; the other two are [[.hitdx]] and [[.hitsx]].

Like all touch, the engine writes it in the physics step and your DNA reads it in
the next cycle, only once.

It is the typical “something caught me from behind” alert, where the eyes do not
reach. The classic response is to turn around to look at it:

```adn
cond
*.hitdn 0 !=
start
628 .aimsx store
stop
```

A half turn is 628. In the cycle after the turn, the bot has it in front and can
see it with [[.eye5]].
