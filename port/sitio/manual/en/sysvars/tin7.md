---
titulo: .tin7
resumen: "Tie input channel number 7: the value that the bot at the other end of the tie you're reading publishes in its .tout7."
etiquetas: [communication, ties, tin, tout]
estado: revisada
---
It works like [[.tin1]]: it brings in whatever the bot at the other end of the tie
you're reading (the one you choose with [[.readtie]] or, if you didn't choose, the
most recently created one) has written in its [[.tout7]]. It arrives one cycle late,
and the engine reloads it every cycle for as long as the tie exists; it goes back to
0 when you run out of ties. All the `.tin` channels come from the same tie in the
same cycle.
<!-- sysvars.yaml .tin7 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

If your partner publishes in `.tout7` the species code of what it has in front of it, you read it like this:

```adn
' if my partner has someone in front of it who isn't one of ours, I count it in 57
cond
*.tin7 0 !=
*.tin7 *.out1 !=
start
57 inc
stop
```

See [[sysvars/entradas-salidas]].
