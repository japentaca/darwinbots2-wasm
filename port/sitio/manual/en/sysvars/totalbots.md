---
titulo: .totalbots
resumen: "How many bots there are in the whole world, counting vegetables, other species and corpses."
etiquetas: [population, sense, world]
estado: revisada
---
<!-- sysvars.yaml .totalbots (contado en P2: todo bot que existe, cadáveres incluidos) -->
`.totalbots` counts all the bots that exist in the simulation: those of every
species, the vegetables and also the corpses. The bot that reads it is included.
The engine publishes it at the end of each cycle (in the first cycle of life it is 0) and
every bot reads the same number.

To count only your own there is [[.totalmyspecies]]; the difference between the
two gives how many bots that aren't yours (food, competition or remains) there are in
the world.

It's useful for measuring how crowded the world is. A bot can, for example, stop
reproducing when there are a lot of bots around, so as not to waste energy on children that
won't find room:

```adn
cond
*.totalbots 200 <
*.nrg 6000 >
start
50 .repro store
stop
```
