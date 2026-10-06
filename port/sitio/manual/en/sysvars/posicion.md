---
titulo: Position and surroundings
resumen: "Where the bot is in the world, whether it touches the edge, whether it is day and how many bots there are: the senses that locate it."
etiquetas: [position, world, sun, population]
estado: revisada
---
<!-- sysvars.yaml .xpos .depth .edge .daytime .sun .totalbots .totalmyspecies -->
These sysvars tell the bot where it is standing and what the world around it is
like. The engine writes all of them; writing to them is pointless, because the engine
publishes them again every cycle. And since it publishes them after the DNA runs,
in the first cycle of life they are 0.

- **Where it is.** [[.xpos]] and [[.depth]] (also `.ypos`) are its coordinates:
  the horizontal and the vertical, with 0 at the top left and depth
  growing downward.
- **The edge.** [[.edge]] is 1 when the bot is leaning against the edge of the
  world.
- **The light.** [[.daytime]] says whether it is day (or, for a bot with chloroplasts, whether
  the sun is shining on it). [[.sun]], despite its name, has nothing to do with light:
  it is 1 when the bot points upward.
- **The population.** [[.totalbots]] counts all the bots in the world and
  [[.totalmyspecies]] those of its own species.

The most used are `.edge`, to avoid getting stuck against the wall, and
`.totalmyspecies`, to regulate reproduction: no more children once the
species has filled the world. This bot only reproduces while its species has
fewer than 50 members:

```adn
cond
*.totalmyspecies 50 <
*.nrg 5000 >
start
50 .repro store
stop
```

Position is useful for staying in a zone (for example, the lit part of
a pond, see [[simulacion/cloroplastos]]) or, together with [[.refxpos]] and
[[.refypos]], for working out which way what it sees is.
