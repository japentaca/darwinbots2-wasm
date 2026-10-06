---
titulo: .depth
resumen: "The bot's vertical position: 0 at the top edge, growing downward, like a depth."
etiquetas: [position, sense, coordinates, pond]
estado: revisada
---
<!-- sysvars.yaml .depth (WriteSenses P5, doble Mod 32000, yDivisor) -->
`.depth` (also written `.ypos`) is the vertical coordinate of the bot's center,
measured from the top edge of the world and growing downward. That's why it is
called depth: in worlds that imitate a pond, the bigger the
number, the deeper the bot is. Its partner is [[.xpos]]. The engine publishes it at the end
of every cycle and in the first cycle of life it is 0.

Like [[.xpos]], past 32000 it starts again from 0, and the configuration
can divide it by a factor.

<!-- 50-MUNDO (luz LightIntensity/depth^Gradient en pondmode) -->
In a pond the light arrives weaker the farther down you go, and chloroplasts
yield less (see [[simulacion/cloroplastos]]). A bot can use `.depth` to avoid
sinking; this one goes up when it passes 1000:

```adn
cond
*.depth 1000 >
start
314 .setaim store
20 .up store
stop
```

The 314 points to the top of the screen (see [[.aim]]). Since the push is added to
the velocity, the bot doesn't stop when it reaches 1000: if the simulation has no
friction, it keeps rising to the edge. To stay in a band you have to
brake, as shown in [[.velup]].
