---
titulo: .veldx
resumen: "The part of the bot's velocity that goes sideways toward its right; negative if it slides to the left."
etiquetas: [velocity, sense, physics, lateral]
estado: revisada
---
<!-- sysvars.yaml .veldx (UpdatePosition P3) -->
`.veldx` measures how much the bot slides sideways, at a right angle to [[.aim]]:
positive toward its right, negative toward its left. Together with [[.velup]]
it describes the whole velocity; [[.velsx]] is the same figure with its sign flipped, and
[[.velscalar]] is the total speed.

Since it is measured relative to the heading, a turn changes the split: a bot that moves
straight ahead and turns a quarter turn to the left ends up sliding toward its
right. The engine publishes it after moving and turning the bot; in the first cycle
it is 0.

It's useful for canceling sideways drift by pushing the other way with
[[.sx]] or [[.dx]]:

```adn
' if it slides to the right, pushes to the left
cond
*.veldx 0 >
start
*.veldx .sx store
stop
```
