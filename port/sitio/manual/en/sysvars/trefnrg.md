---
titulo: .trefnrg
resumen: "The energy of the tied bot at the other end of the tie you're reading."
etiquetas: [tref, ties, energy]
estado: revisada
---
<!-- sysvars.yaml .trefnrg; 21-MEMORIA §9.3 (el original se congela con 32000 exactos); port/README A3-3 (el port topa en ±32000) -->
It holds the energy ([[.nrg]]) of the tied bot, rounded to an integer. It's what you look
at before passing energy to a partner or asking for some: together with your own `.nrg`
it tells you which of the two is better off. Transfers through a tie are done with
[[.tieloc]] and [[.tieval]] (see [[simulacion/lazos]]).

```adn
' If the tied bot has less than half my energy, cell 50 is 1
cond
*.numties 0 >
*.trefnrg 2 mult *.nrg <
start
1 50 store
stop
```

:::nota
In the original DarwinBots, a partner with exactly 32000 energy left this
sysvar frozen at its previous value. In this version it is capped: if the other has 32000 or more, you read 32000 (see
[[tecnico/diferencias]]).
:::
