---
titulo: .hitsx
resumen: "It is 1 in the cycle after a collision on the bot's left side."
etiquetas: [collision, touch, sense, direction]
estado: revisada
---
<!-- sysvars.yaml .hitsx; umbrales del tacto en el core (touch, senses.hpp): 3,92 a 5,49 rad, lado izquierdo -->
`.hitsx` turns on when the bot collides with something on its left: the center
of the other one falls inside a quarter turn centered on the left side (about
45 degrees to each side), looking from its heading ([[.aim]]). It is one of the
directions of [[.hit]]; its opposite is [[.hitdx]] and the other two are
[[.hitup]] and [[.hitdn]].

Like all touch, the engine writes it in the physics step and your DNA reads it in
the next cycle, only once.

To look at what touched it on the left, the bot turns a quarter turn to that
side with [[.aimsx]]:

```adn
cond
*.hitsx 0 !=
start
314 .aimsx store
stop
```
