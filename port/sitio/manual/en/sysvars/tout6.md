---
titulo: .tout6
resumen: "Tie output channel number 6: what you write here is read in its .tin6 by the bot tied to you."
etiquetas: [communication, ties, tout, tin]
estado: revisada
---
It works like [[.tout1]]: what you store in `.tout6` the engine copies into the
[[.tin6]] of the bot at the other end of the tie, as long as it is reading
that tie (the one it chooses with [[.readtie]] or, if it didn't choose, the most
recently created one). It reads it in the next cycle. The engine doesn't clear it:
the value stays published until you change it, and a child is born with `.tout6` at 0.
<!-- sysvars.yaml .tout6 (borra: no); 34-TIES §2 (readtie → ReadTRefVars en P1); 36-REPRO §2 (el hijo no hereda mem) -->

With ten channels you can send your partner several things at once. For example,
a bot can publish here the type of the shot that just hit it ([[.shflav]]; 0 if none hit it), as an alarm for the rest of the organism:

```adn
start
*.shflav .tout6 store
stop
```

See [[sysvars/entradas-salidas]] and, for what the partner perceives through the tie
without you publishing anything, [[sysvars/tref]].
