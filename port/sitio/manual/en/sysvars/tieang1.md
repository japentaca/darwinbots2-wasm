---
titulo: .tieang1
resumen: "Angle of a multicellular bot's first tie relative to the way the bot points (0 to 1256); writing it sets that angle."
etiquetas: [ties, multicellular, angle]
estado: revisada
---
It is a read-write cell for the bot's **first tie** (the oldest one it
has left; if one breaks, the following ones shift up a slot), and it only works if the
bot is multicellular ([[.multi]]) and that tie is stiffened.

<!-- sysvars.yaml .tieang1 (bidi: store de dos operandos marca TieAngOverwrite; P3 publica el ángulo real ·200, 0..1256; solo multibot con tie 1 endurecida) -->

**Reading.** Every cycle the engine publishes the direction of the partner as seen from the
bot, on the scale of 1256 per full turn and always positive: 0 is straight ahead. It is
the same angle as [[.tieang]] with the sign flipped and brought into the range 0 to
1256 (a `.tieang` of −300 is a `.tieang1` of 300), and the same scale that
[[.fixang]] uses. It is published before the bots are moved,
so it can differ a little from the final angle of the cycle.

<!-- port/core ties.hpp Update_Ties (tieang1 = angnorm(ángulo − aim)·200; .tieang = −AngDiff·200); 10-CICLO §2 (Update_Ties antes de UpdatePosition en P3); comprobado con probar-adn: .tieang −333 con .tieang1 333 -->

**Writing.** A value written with [[op:store]] (or with another two-operand
store, such as [[op:addstore]]) sets that tie's angle, just like
[[.fixang]] but without having to pick it with [[.tienum]]. Afterwards the engine
writes the measurement back into the cell. Careful: [[op:inc]], [[op:dec]] and the
one-operand stores change the number but don't tell the tie (see [[adn/stores]]).

<!-- 20-VM §7 (TieAngOverwrite solo en los stores de dos operandos) -->

If the bot isn't multicellular or the first tie isn't stiffened, the engine doesn't touch
the cell. It doesn't touch it either if [[.tienum]] and [[.tiepres]] are both 0.

```adn
' make the first tie rotate around the bot
cond
*.multi 1 =
start
40 .tieang1 addstore
stop
```

The step has to exceed the 5-degree slack (about 17) with which the engine
holds the angle: with `10 .tieang1 addstore` the tie doesn't move, because every
cycle you ask for 10 more than what it measures and that difference falls within the slack.

<!-- 30-FISICA §3.2 (holgura de 5°); comprobado con probar-adn: con 10 .tieang1 queda fijo; con 40 el lazo da vueltas (~23 por ciclo) -->

The other three ties have [[.tieang2]], [[.tieang3]] and [[.tieang4]]; the length
is handled with [[.tielen1]].
