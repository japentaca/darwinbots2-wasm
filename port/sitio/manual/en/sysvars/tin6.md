---
titulo: .tin6
resumen: "Tie input channel number 6: the value that the bot at the other end of the tie you're reading publishes in its .tout6."
etiquetas: [communication, ties, tin, tout]
estado: revisada
---
It works like [[.tin1]]: it brings in whatever the bot at the other end of the tie
you're reading (the one you choose with [[.readtie]] or, if you didn't choose, the
most recently created one) has written in its [[.tout6]]. It arrives one cycle late,
and the engine reloads it every cycle for as long as the tie exists; it goes back to
0 when you run out of ties. All the `.tin` channels come from the same tie in the
same cycle.
<!-- sysvars.yaml .tin6 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

If your partner publishes in `.tout6` the type of the shot that just hit it, you read it like this:

```adn
' if my partner got hit, I store the alert in 56
cond
*.tin6 0 !=
start
*.tin6 56 store
stop
```

See [[sysvars/entradas-salidas]].
