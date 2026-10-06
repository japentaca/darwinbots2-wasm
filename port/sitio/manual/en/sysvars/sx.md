---
titulo: .sx
resumen: "Pushes the bot sideways to its left, without changing which way it points."
etiquetas: [movement, thrust, command, lateral]
estado: revisada
---
<!-- sysvars.yaml .sx; 30-FISICA §2.1; probado: con .aim 0, 10 .sx sube 6,6 por ciclo y .velsx da 7 -->
`.sx` pushes the bot to its left, at a right angle to [[.aim]], without turning it.
A bot facing the right of the screen (`.aim` 0) moves
up. Its opposite is [[.dx]]: the engine computes `.sx − .dx` and pushes with the
difference, so a negative value in `.sx` pushes to the right.

Like [[.up]], it is an acceleration that the engine applies in the same cycle and clears; it
adds to the speed the bot already had, shares the cap of [[.maxvel]] and costs the same
per unit. If you write `.up` and `.sx` at the same time, the bot goes diagonally.

Lateral movement is useful for dodging without taking your eyes off the target, or for
circling something while aiming at it. Sideways speed is read in
[[.velsx]] and [[.veldx]].

```adn
' while it sees something, it moves left without taking its eyes off it
cond
*.eye5 0 >
start
15 .sx store
stop
```
