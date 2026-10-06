---
titulo: .out1
resumen: "First output channel through sight: the number you write here is read in its .in1 by any bot that is looking at you."
etiquetas: [communication, out, in, species]
estado: revisada
---
What you store in `.out1` is published for everyone else. When another bot has
you in its focus eye (normally [[.eye5]], the one in front; you can change it with
[[.focuseye]]), the engine copies your `.out1` into its [[.in1]]. The same happens when
you collide with it, even if it isn't looking at you. The other bot only reads it in the next cycle.
<!-- sysvars.yaml .out1; 32-VISION §4 (lookoccurr en visión y en colisión); 21-MEMORIA §3 (in*: latencia 1) -->

The engine never clears it: writing it once is enough, and the value stays until
you change it. That's why many bots write it only at the start of their lives. A child,
on the other hand, is born with `.out1` at 0 and has to write it itself.
<!-- sysvars.yaml .out1 (borra: no); 36-REPRO §2 (el hijo no hereda mem) -->

Its classic use is a species code, so you don't attack your own kind. That's how
_Artemis Minimalis_, from the Bestiary, does it:

```adn
cond
*.robage 5 <
start
555 .out1 store
stop
```

Then, before shooting, it compares `*.in1 *.out1 !=`. Use a code other than 0,
which is what any bot that doesn't use the channel publishes. Keep in mind that the
channel is public: any bot that looks at you reads it, whether it's of your species or not.

<!-- Artemis_Minimalis.txt: 555 .out1 store con *.robage 5 <, y *.in1 *.out1 != antes de -1 .shoot -->

There are ten identical channels, from `.out1` to [[.out10]]; see
[[sysvars/entradas-salidas]].
