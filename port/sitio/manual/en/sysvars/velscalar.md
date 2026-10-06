---
titulo: .velscalar
resumen: "The bot's speed: the size of its velocity, regardless of which direction it is going."
etiquetas: [velocity, sense, physics]
estado: revisada
---
<!-- sysvars.yaml .velscalar (UpdatePosition P3, iceil = CInt); 30-FISICA §6 -->
`.velscalar` is the size of the bot's velocity, rounded to the nearest integer: 0
if it is still or nearly so, and at most [[.maxvel]]. It doesn't say where it is going; for that there are
[[.velup]], [[.veldn]], [[.veldx]] and [[.velsx]], which break it down relative to the
heading. The engine publishes it after moving the bot, so your DNA reads the
velocity it moved with in the previous cycle, and in the first cycle it is 0.

<!-- 30-FISICA §5 (borde rígido: clamp de posición, vel·0,05) -->
:::cuidado
It is the velocity the bot _carries_, not the one it achieves. A bot pushing against the
edge of the world can end up pinned in the corner and still read
`.velscalar` 40: the edge stops it in place, but doesn't erase its velocity. To
tell whether it is stuck, look at [[.edge]] or compare [[.xpos]] and [[.depth]] between
cycles.
:::

It's useful for metering the thrust (not spending on [[.up]] when it is already going fast) or for
detecting that something pushed it:

```adn
' only pushes if it is slow
cond
*.velscalar 10 <
start
10 .up store
stop
```
