---
titulo: .tin4
resumen: "Tie input channel number 4: the value that the bot at the other end of the tie you're reading publishes in its .tout4."
etiquetas: [communication, ties, tin, tout]
estado: revisada
---
It works like [[.tin1]]: it brings in whatever the bot at the other end of the tie
you're reading (the one you choose with [[.readtie]] or, if you didn't choose, the
most recently created one) has written in its [[.tout4]]. It arrives one cycle late,
and the engine reloads it every cycle for as long as the tie exists; it goes back to
0 when you run out of ties. All the `.tin` channels come from the same tie in the
same cycle.
<!-- sysvars.yaml .tin4 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

If your partner publishes in `.tout4` the horizontal position of what it has in front of it, you read it like this:

```adn
' I store in 54 the x of what my partner sees
cond
*.tin4 0 !=
start
*.tin4 54 store
stop
```

See [[sysvars/entradas-salidas]].
