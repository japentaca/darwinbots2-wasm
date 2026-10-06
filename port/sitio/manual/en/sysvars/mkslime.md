---
titulo: .mkslime
resumen: "Command to make slime: each 1 of energy gives 10 of slime, up to 200 per cycle."
etiquetas: [defenses, slime, energy, ties]
estado: revisada
---
Write how much slime you want to add this cycle. The engine makes it at the end of
the cycle, charges 1 energy for every 10 of slime and sets the command to 0. It is
the only one of the four defenses with a cap of 200 per cycle instead of 100.

<!-- sysvars.yaml .mkslime (MakeStuff P5, ±200/ciclo, =0 al consumir); 31-ENERGIA §0.3 -->

Slime evaporates: it loses 2% per cycle. To keep a stable layer you have to
replenish it every cycle, and the thicker the layer, the more is lost. With 200
per cycle the layer settles near 10000 (2% of 10000 is exactly 200).

<!-- 31-ENERGIA §1 (Upkeep P1: slime ×0.98) -->

As with [[.mkshell]], a negative value takes slime apart but still charges
energy, a transaction cost that goes to waste is added (in a multicellular bot,
the part you pay in energy is divided by the number of ties plus one) and with
energy at 0 or less the command stays written without running.

<!-- 34-TIES §3 (costes divididos por numties+1); port/core robots.hpp makeslime (guarda nrg > 0, Cost/(numties+1) si Multibot) -->

The result is read in [[.slime]].

```adn
' a slime layer thick enough that nobody ties to me
cond
*.slime 150 <
start
50 .mkslime store
stop
```
