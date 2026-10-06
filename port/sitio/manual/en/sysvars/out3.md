---
titulo: .out3
resumen: "Output channel number 3 through sight: what you write here is read in its .in3 by the bot that is looking at you."
etiquetas: [communication, out, in]
estado: revisada
---
It works the same as [[.out1]]: what you store in `.out3` the engine copies into
the [[.in3]] of any bot that has you in its focus eye, or that collides with you,
and it reads it in the next cycle. The engine never clears it: the value stays
published until you change it. A child is born with `.out3` at 0.
<!-- sysvars.yaml .out3 (borra: no); 32-VISION §4 (lookoccurr en visión y en colisión); 21-MEMORIA §3 (in*: latencia 1); 36-REPRO §2 (el hijo no hereda mem) -->

Having ten channels lets you publish several things at once without mixing them up. For
example, a bot can publish here what it sees ahead ([[.eye5]]), so whoever is looking at it knows whether it has something in front of it:

```adn
start
*.eye5 .out3 store
stop
```

If what you publish changes, you have to write it again every cycle, as here:
the engine doesn't update it on its own. See [[sysvars/entradas-salidas]].
