---
titulo: .velup
resumen: "The part of the bot's velocity that goes forward, in the direction it points; negative if it moves backward."
etiquetas: [velocity, sense, physics]
estado: revisada
---
<!-- sysvars.yaml .velup (alias .vel, UpdatePosition P3) -->
`.velup` (also written `.vel`) says how much the bot advances in the direction of
[[.aim]]: positive if it goes forward, negative if it goes in reverse. The sideways part
is in [[.veldx]] and the total speed in [[.velscalar]]. [[.veldn]] is the
same figure with its sign flipped.

The engine publishes it after moving and turning the bot, so it is measured relative to the
_new_ heading. If the bot turns without changing its velocity, the same movement passes
from `.velup` to `.veldx`: a bot going forward at 40 that turns a quarter
turn reads `.velup` 0 and the whole velocity sideways. In the first cycle of life it
is 0.

Its clearest use is braking: pushing against your own velocity.

```adn
' brakes: pushes against its own velocity, forward and sideways
cond
*.velscalar 0 >
start
*.velup .dn store
*.veldx .sx store
stop
```

<!-- 30-FISICA §2.1; probado: de 40 a 14, 4, 2 y 0 -->
Since the actual push is a little smaller than the number written, the bot doesn't
stop dead: it loses about two thirds of its velocity per cycle and in about four
cycles reads 0. The velocity sysvars are rounded to the nearest integer, so
a drift of less than half a point per cycle may remain that you can no longer see.
