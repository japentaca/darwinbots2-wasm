---
titulo: .dx
resumen: "Pushes the bot sideways to its right, without changing where it points."
etiquetas: [movement, thrust, command, lateral]
estado: revisada
---
<!-- sysvars.yaml .dx; 30-FISICA §2.1 -->
`.dx` is the twin of [[.sx]]: it pushes the bot to its right, at a right angle to
[[.aim]], without turning it. A bot facing the right of the screen (`.aim` 0)
moves down. The engine computes `.sx − .dx`, so a negative `.dx`
pushes to the left, and writing the same value to both cancels out.

It works like [[.up]]: the engine applies it in the same cycle and leaves it at 0, the
push is added to the velocity the bot already had and shares the cap of [[.maxvel]].
The resulting lateral velocity is read in [[.veldx]].

A typical use is compensating for drift: if the bot is going off sideways, push
the other way.

```adn
' corrects lateral drift: if it goes left, push right
cond
*.velsx 0 >
start
*.velsx .dx store
stop
```
