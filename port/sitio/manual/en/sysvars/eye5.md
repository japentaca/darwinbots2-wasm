---
titulo: .eye5
resumen: "The front eye: 0 if there is nothing ahead, and the closer what the bot has in front, the higher the value; it is the most used sense in bot DNA."
etiquetas: [eyes, vision, senses, eye5]
estado: revisada
---
The middle one of the nine [[sysvars/ojos|eyes]]: with the factory configuration
it looks right where the bot points ([[.aim]]), with a field of 10
degrees. It is 0 if it sees nothing; if it sees something, a number that grows as it gets closer: 1
at the edge of the range (about 1440 units), 100 at about 134 units edge
to edge and 32000 when they touch. The full table is in
[[sysvars/ojos#valor]].
<!-- 32-VISION §0.2, §0.3, §0.4; sysvars.yaml .eye5 -->

It is also the factory focus eye: as long as [[.focuseye]] is 0, its value
is repeated in [[.eyef]] and what it sees is what the cells in
[[sysvars/ref|what it sees]] describe, such as [[.refeye]] or [[.refnrg]]. That is why almost all
bots use it to decide: advance if there is something, shoot if it is close,
eat if it belongs to another species.
<!-- 32-VISION §2.6; sysvars.yaml .focuseye -->

The engine writes it at the end of every cycle, after moving all the bots,
so it comes with a one-cycle delay: if you turn now, you read what is in the new
direction in the next cycle. It sees live bots, vegetables and corpses
alike; to find out what it is, look at the `ref*` cells.
<!-- 32-VISION §0.1, §2 (notas: los cadáveres se ven) -->

The example pushes toward what it has in front while it is far and stops
pushing when the value reaches 100. Careful: stopping the push is not braking; the bot
keeps the velocity it had and may end up crashing:

```adn
' approach what is seen ahead
cond
*.eye5 0 >
*.eye5 100 <
start
20 .up store
stop
```

The front eye can also be repointed with [[.eye5dir]] and widened with
[[.eye5width]].
