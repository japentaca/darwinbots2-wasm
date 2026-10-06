---
titulo: .tin3
resumen: "Tie input channel number 3: the value that the bot at the other end of the tie you're reading publishes in its .tout3."
etiquetas: [communication, ties, tin, tout]
estado: revisada
---
It works like [[.tin1]]: it brings in whatever the bot at the other end of the tie
you're reading (the one you choose with [[.readtie]] or, if you didn't choose, the
most recently created one) has written in its [[.tout3]]. It arrives one cycle late,
and the engine reloads it every cycle for as long as the tie exists; it goes back to
0 when you run out of ties. All the `.tin` channels come from the same tie in the
same cycle.
<!-- sysvars.yaml .tin3 (ReadTRefVars P1; borra: EraseTRefVars); 34-TIES §2 -->

If your partner publishes in `.tout3` what it sees straight ahead, you read it like this:

```adn
' if my partner sees something and I don't, I note it in 53
cond
*.tin3 0 >
*.eye5 0 =
start
*.tin3 53 store
stop
```

See [[sysvars/entradas-salidas]].
