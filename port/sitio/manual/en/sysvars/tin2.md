---
titulo: .tin2
resumen: "Tie input channel number 2: the value that the bot at the other end of the tie you're reading publishes in its .tout2."
etiquetas: [communication, ties, tin, tout]
estado: revisada
---
It works like [[.tin1]]: it brings in whatever the bot at the other end of the tie
you're reading (the one you choose with [[.readtie]] or, if you didn't choose, the
most recently created one) has written in its [[.tout2]]. It arrives one cycle late,
and the engine reloads it every cycle for as long as the tie exists; it goes back to
0 when you run out of ties. All the `.tin` channels come from the same tie in the
same cycle.
<!-- sysvars.yaml .tin2 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

If your partner publishes in `.tout2` how much energy it lost in the last cycle, you read it like this:

```adn
' if my partner is losing energy, I store how much in 52
cond
*.tin2 0 >
start
*.tin2 52 store
stop
```

See [[sysvars/entradas-salidas]].
