---
titulo: .veldn
resumen: "The bot's backward velocity: it is .velup with its sign flipped."
etiquetas: [velocity, sense, physics]
estado: revisada
---
<!-- sysvars.yaml .veldn = −.velup -->
`.veldn` is exactly [[.velup]] with its sign flipped: positive when the bot
moves in reverse relative to its heading and negative when it moves forward. It adds no
information; it exists so that conditions read more naturally, like
“if it is backing up” instead of “if the forward velocity is negative”.

The engine publishes it after moving and turning the bot, and it is 0 in the first cycle.

```adn
' if it's going in reverse, thrusts forward to compensate
cond
*.veldn 0 >
start
*.veldn .up store
stop
```
