---
titulo: .tout9
resumen: "Tie output channel number 9: what you write here is read in its .tin9 by the bot tied to you."
etiquetas: [communication, ties, tout, tin]
estado: revisada
---
It works like [[.tout1]]: what you store in `.tout9` the engine copies into the
[[.tin9]] of the bot at the other end of the tie, as long as it is reading
that tie (the one it chooses with [[.readtie]] or, if it didn't choose, the most
recently created one). It reads it in the next cycle. The engine doesn't clear it:
the value stays published until you change it, and a child is born with `.tout9` at 0.
<!-- sysvars.yaml .tout9 (borra: no); 34-TIES §2 (readtie → ReadTRefVars en P1); 36-REPRO §2 (el hijo no hereda mem) -->

With ten channels you can send your partner several things at once. For example,
a bot can publish here the energy of what it has in front of it ([[.refnrg]]):

```adn
start
*.refnrg .tout9 store
stop
```

See [[sysvars/entradas-salidas]] and, for what the partner perceives through the tie
without you publishing anything, [[sysvars/tref]].
