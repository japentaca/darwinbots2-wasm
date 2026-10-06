---
titulo: .memloc
resumen: "Chooses which cell of the memory of the bot you are looking at gets copied into .memval."
etiquetas: [memory, spying, sight, configuration]
estado: revisada
---
<!-- sysvars.yaml .memloc (persiste; útil 1..1000); 21-MEMORIA §3 (configuración persistente); 20-VM §7 (el ajuste de dirección es del store, no de memloc); comprobado con probar-adn (1061 no espía la 61) -->
It is a configuration sysvar: you write an address and the engine uses it every
cycle to fill [[.memval]] with what that cell holds in the bot you are looking
at. It is never cleared, so writing it once is enough, for example with a gene
that runs only while it is 0.

Only addresses from 1 to 1000 work. Unlike a store, there is no adjustment to the
range here: with `1061 .memloc store` the cell holds 1061 and `.memval` stays at
0, it does not spy on cell 61.

```adn
' Only once: spy on the DNA length of the bot I see
cond
*.memloc 0 =
start
.dnalen .memloc store
stop
```

Note that `.dnalen` goes without an asterisk: what is stored is the _address_ of
[[.dnalen]] (336), not its value. With that, `*.memval *.dnalen =` asks whether
the bot you see has the same DNA length as yours. You can spy on any cell: a
sysvar of the other one, like its [[.eye5]], or one of its private variables. To
spy through a tie, use [[.tmemloc]].
