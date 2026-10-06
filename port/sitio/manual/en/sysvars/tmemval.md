---
titulo: .tmemval
resumen: "The contents of one cell of the tied bot's memory; you choose the cell with .tmemloc."
etiquetas: [memory, spying, ties, tref]
estado: revisada
---
<!-- sysvars.yaml .tmemval (= mem(tmemloc) del atado, solo si tmemloc en 1..1000; si no, no se toca); core ties.hpp ReadTRefVars; atraso comprobado con probar-adn -->
If you put an address between 1 and 1000 in [[.tmemloc]], `.tmemval` brings in what
that cell holds in the memory of the tied bot, over the same tie that the
[[sysvars/tref|tref*]] describe (the one you choose with [[.readtie]]). It is the per-tie version of
[[.memval]].

The snapshot is taken after the other bot's DNA has run: if your partner writes its
cell 61 in one cycle, you read that value in the next cycle.

```adn
' If the tied bot has the same DNA length as I do, cell 50 is 1
cond
*.numties 0 >
*.tmemval *.dnalen =
start
1 50 store
stop
```

(with `.dnalen .tmemloc store` written earlier in some gene). Two traps: if you put an
address outside 1..1000 in `.tmemloc`, `.tmemval` is not cleared; it keeps the
last value it read. And when the tie is broken, it only goes back to 0 one cycle
later, like the rest of the tref*.
