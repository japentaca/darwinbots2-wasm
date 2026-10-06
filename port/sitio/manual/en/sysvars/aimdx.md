---
titulo: .aimdx
resumen: "Turns the bot to the right (clockwise) by the amount you write, on a scale where 1256 is a full turn."
etiquetas: [turning, command, aim]
estado: revisada
---
<!-- sysvars.yaml .aimdx; 30-FISICA §7 -->
`.aimdx` turns the bot to its right. The number is the angle: 1256 is a full
turn, 314 a quarter turn, and about 3.5 is one degree. On the screen the turn goes
clockwise, so [[.aim]] goes down: a bot with `.aim` 160 that writes `100 .aimdx store`
ends up at 60.

The engine applies the turn in the same cycle, in the movement phase, and sets
the cell back to 0. Its opposite is [[.aimsx]]: the engine turns by `.aimsx − .aimdx`, so a negative
value turns left. The turn costs energy in proportion to the angle
(see [[adn/ejecucion#costos]]).

:::cuidado
If in the same cycle you write to [[.setaim]] a heading different from the current
one, `.setaim` wins and whatever you put in `.aimdx` and `.aimsx` is ignored.
:::

<!-- 30-FISICA §2.1 (VoluntaryForces en P1 usa el rumbo previo) y §7 (SetAimFunc en P3) -->
Since the push from [[.up]] is calculated with the heading from _before_ the turn,
a bot that turns and moves forward in the same cycle goes out with the old heading
and only moves toward the new one in the next cycle.

```adn
' sweeps the surroundings, turning bit by bit while it sees nothing
cond
*.eye5 0 =
start
50 .aimdx store
stop
```
