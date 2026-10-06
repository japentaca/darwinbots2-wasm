---
titulo: Collisions and hits
resumen: "The sysvars that report that the bot collided with another, and on which side: the sense of touch."
etiquetas: [collision, touch, contact, senses]
estado: revisada
---
<!-- sysvars.yaml .hit .hitup .hitdn .hitdx .hitsx; 30-FISICA §4.3, §4.4 -->
Eyes see at a distance; these sysvars are touch. When the bot overlaps
another bot (alive, a vegetable or a corpse) or an obstacle, the engine turns on
[[.hit]] and, in addition, one of the four directions depending on which side the
contact came from: [[.hitup]] from the front, [[.hitdn]] from behind, [[.hitdx]] from the right and
[[.hitsx]] from the left, always relative to where the bot is pointing
([[.aim]]). They are all 1 or 0.

All five follow the senses rule with a one-cycle delay: the engine
writes them in the physics step, after the DNA has run, your DNA reads them in the
next cycle, and right after that they are cleared. So a collision is visible for a
single cycle. The edge of the world doesn't count as a collision: that's what [[.edge]] is for.

<!-- 30-FISICA §4.3 (lookoccurr cruzados en Repel3); 10-CICLO §2 -->
A collision also fills the `ref*` sysvars with the data of the bot that was touched, as if it
had seen it (see [[sysvars/ref]]). If at that moment the bot sees nothing with its
eyes, the `ref*` of the next cycle describe the one that collided with it, even if it was
behind.

The most common way to use them is to turn toward the side of the hit to look at what it was.
This bot turns around when it is touched from behind:

```adn
cond
*.hitdn 0 !=
start
628 .aimsx store
stop
```

<!-- sysvars.yaml .hitang (nadie la escribe) -->
[[.hitang]] completes the group in name only: the engine never writes it.
