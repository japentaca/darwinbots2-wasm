---
titulo: .tmemloc
resumen: "Chooses which cell of the tied bot's memory gets copied into .tmemval."
etiquetas: [memory, spying, ties, configuration]
estado: revisada
---
<!-- sysvars.yaml .tmemloc (persiste, reset comentado adrede); 21-MEMORIA §3; ejemplo comprobado con probar-adn -->
It is the address the engine spies on in the tied bot to fill [[.tmemval]]. Like
[[.memloc]], it is a configuration sysvar: it is never cleared, not even when you lose the
tie, so you only need to write it once. Only addresses 1 to 1000 are valid, with no
range adjustment.

Besides recognizing species, it lets the cells of an organism read each other without
spending channels: each one leaves its state in a cell of its own and the other one
spies on it.

```adn
' Reproduces at 10 cycles and spies on cell 61 of the tied bot
cond
*.robage 10 =
start
50 .repro store
61 .tmemloc store
stop

' Everyone writes down their age in cell 61
cond
start
*.robage 61 store
stop
```

From the cycle after birth, the parent reads in `.tmemval` what its child wrote in
cell 61 the cycle before: 0, 1, 2… The child, on the other hand, spies on nothing: it is
born with `.tmemloc` at 0, because a newborn's memory starts empty.
To send data instead of reading it, there are [[.tout1]] and [[.tieloc]].
