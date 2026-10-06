---
titulo: .xpos
resumen: "The bot's horizontal position in the world: 0 at the left edge and growing toward the right."
etiquetas: [position, sense, coordinates]
estado: revisada
---
<!-- sysvars.yaml .xpos (WriteSenses P5, doble Mod 32000, xDivisor) -->
`.xpos` is the horizontal coordinate of the bot's center, measured from the left
edge of the world, in the same units as the field size. Its partner is
[[.depth]], the vertical one. The engine publishes it at the end of each cycle; in the first
cycle of life it is 0.

A memory cell holds at most 32000, so in a world wider than that
the value starts again from 0. The simulation can also be configured to
divide the coordinates by a factor before publishing them.

It's useful for staying in one zone of the map, for a multibot to know where each
cell is or, together with [[.refxpos]], to tell whether what it sees is to the left or to
the right. This bot heads back toward the left half of a world 4000 wide
when it goes past the middle:

```adn
cond
*.xpos 2000 >
start
628 .setaim store
20 .up store
stop
```

The 628 points to the left of the screen (see [[.aim]]). Watch out for inertia:
when it is back below 2000 it stops pushing, but without friction it keeps
sliding to the opposite wall. To stay in the zone you have to brake, as
shown in [[.velup]].
