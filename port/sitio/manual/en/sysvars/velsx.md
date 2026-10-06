---
titulo: .velsx
resumen: "The bot's sideways velocity toward its left: it is .veldx with its sign flipped."
etiquetas: [velocity, sense, physics, lateral]
estado: revisada
---
<!-- sysvars.yaml .velsx = −.veldx -->
`.velsx` is [[.veldx]] with its sign flipped: positive when the bot slides
toward its left and negative when it goes toward its right. As with [[.veldn]], it
adds no information, but it makes left-side conditions more readable.

It is measured relative to the heading ([[.aim]]) after the cycle's movement and turn, and
is 0 in the first cycle of life.

Don't confuse it with [[.refvelsx]], which measures the same thing but for the bot you are
looking at.

```adn
' if it slides to the left, pushes to the right
cond
*.velsx 0 >
start
*.velsx .dx store
stop
```
