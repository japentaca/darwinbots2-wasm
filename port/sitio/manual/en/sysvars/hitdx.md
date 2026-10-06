---
titulo: .hitdx
resumen: "It is 1 in the cycle after a collision on the bot's right side."
etiquetas: [collision, touch, sense, direction]
estado: revisada
---
<!-- sysvars.yaml .hitdx; umbrales del tacto en el core (touch, senses.hpp): 0,78 a 2,36 rad, lado derecho -->
`.hitdx` turns on when the bot collides with something on its right: the center
of the other one falls inside a quarter turn centered on the right side (about
45 degrees to each side), looking from its heading ([[.aim]]). It is one of the
directions of [[.hit]]; its opposite is [[.hitsx]] and the other two are
[[.hitup]] and [[.hitdn]].

Like all touch, the engine writes it in the physics step and your DNA reads it in
the next cycle, only once.

To look at what touched it on the right, the bot turns a quarter turn to that
side with [[.aimdx]]:

```adn
cond
*.hitdx 0 !=
start
314 .aimdx store
stop
```
