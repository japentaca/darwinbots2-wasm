---
titulo: .maxvel
resumen: "The maximum speed the simulation allows; no bot can go faster."
etiquetas: [speed, physics, configuration]
estado: revisada
---
<!-- sysvars.yaml .maxvel; 30-FISICA §6 (MaxVelocity forzado a 40 fuera de (0,200]), §2.1 -->
`.maxvel` reports the simulation's speed limit. It is a fact about the world, the
same for all bots: it is set by the configuration ([[param:opt:11]]; 40 by
default) and the engine publishes it every cycle. Writing to it changes nothing.

That cap acts twice. No bot can go faster than `.maxvel` ([[.velscalar]] never
exceeds it), and the push of one cycle, after being multiplied by the mass, is
also clipped to that value. That is why pushing with [[.up]] much harder than
`.maxvel` is wasteful.

<!-- sysvars.yaml .maxvel (UpdatePosition P3); probado: 0 en el primer ciclo -->
Since the engine publishes it at the end of the cycle, in the bot's first cycle
of life it is 0.

A reasonable use is to push only while there is still speed to gain:

```adn
' accelerates up to the cap and then stops pushing
cond
*.velup *.maxvel <
start
*.maxvel *.velup sub .up store
stop
```
