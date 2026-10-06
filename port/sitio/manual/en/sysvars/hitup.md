---
titulo: .hitup
resumen: "It is 1 in the cycle after a head-on collision, with something that was in front of the bot."
etiquetas: [collision, touch, sense, direction]
estado: revisada
---
<!-- sysvars.yaml .hitup; umbrales del tacto en el core (touch, senses.hpp): de frente ±0,78 rad -->
`.hitup` turns on when the bot collides with something in front of it: the center
of the other one falls inside a cone of about 45 degrees on each side of its
heading ([[.aim]]). It is one of the four directions of [[.hit]], along with
[[.hitdn]] (behind), [[.hitdx]] (right) and [[.hitsx]] (left); [[.hit]] turns on
whenever any of them does.

Like all touch, the engine writes it in the physics step and your DNA reads it in
the next cycle, only once: after that it is cleared.

A head-on collision is usually what the bot was looking for (or what it bumped
into for not looking). What it touched is described in the `ref*` sysvars, so the
bot can react depending on what it is. This bot backs off if what is in front of
it is bigger than it is:

```adn
cond
*.hitup 0 !=
*.refbody *.body >
start
30 .dn store
stop
```
