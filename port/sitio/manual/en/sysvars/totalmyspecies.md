---
titulo: .totalmyspecies
resumen: "How many living bots there are of your own species, including the one reading it."
etiquetas: [population, sense, species, reproduction]
estado: revisada
---
<!-- sysvars.yaml .totalmyspecies (clamp 32000); especie por nombre, cadáveres fuera del conteo -->
`.totalmyspecies` counts the living bots of your species, including the one reading it;
corpses don't count. The species is recognized by name: all the
descendants that keep the species name count, even if they have mutated
(see [[simulacion/especies]]). The engine publishes it at the end of each cycle, and in the
first cycle of life it is 0.

It's the classic tool for keeping a species from choking itself: stop
reproducing once there are enough. [[.totalbots]], on the other hand, counts everyone
in the world.

```adn
' reproduces only while the species has fewer than 30 bots
cond
*.totalmyspecies 30 <
*.nrg 5000 >
start
50 .repro store
stop
```

The count has a cap of 32000, which in practice is never reached.
