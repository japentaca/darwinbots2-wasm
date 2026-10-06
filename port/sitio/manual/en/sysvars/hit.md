---
titulo: .hit
resumen: "It is 1 in the cycle after a collision with another bot or with an obstacle, wherever it comes from."
etiquetas: [collision, touch, sense]
estado: revisada
---
<!-- sysvars.yaml .hit (Repel3 P1, EraseSenses paso 12); 30-FISICA §4.3, §4.4 -->
`.hit` is the general contact alert: the engine sets it to 1 when the bot
overlaps another bot (of any species, a vegetable or a corpse) or an obstacle,
regardless of the side. To know which side it came from there are [[.hitup]],
[[.hitdn]], [[.hitdx]] and [[.hitsx]], which turn on together with it.

The collision is detected in the physics step, after the DNA has run, so your DNA
reads it in the next cycle; right after that the engine sets it back to 0. If the
contact continues, it turns on again every cycle. What you write to `.hit` lasts
a short time: the engine clears it after your DNA even if there was no collision.

The edge of the world does not turn it on ([[.edge]] takes care of that), and the
shots the bot receives do not either: a shot is not a collision.

This bot keeps count of how many cycles it spent in contact with something, in
free memory cell 50:

```adn
cond
*.hit 0 !=
start
50 inc
stop
```

Along with a collision come the data of the bot that was touched, in the `ref*`
sysvars (see [[sysvars/contacto]]).
