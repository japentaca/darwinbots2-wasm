---
titulo: .robage
resumen: "The bot's age in cycles: 0 in its first cycle of life, it goes up by 1 and stops at 32000."
etiquetas: [age, sense, clock]
estado: revisada
---
<!-- sysvars.yaml .robage (Ageing P5, tope 32000); comprobado: sembrado e hijo leen 0 en su primer ciclo -->
It counts how many cycles the bot has been alive. The engine publishes it at the end of every cycle,
so in the first cycle of life the DNA reads 0, in the second 1, and so on. It is the
same for a freshly loaded bot as for a newborn child. On reaching 32000
it stays there: it doesn't start over.

The most common use is to do something just once, at birth:

```adn
' At birth, just once, it does a half turn
cond
 *.robage 0 =
start
 628 .aimdx store
stop
```

This bot turns 628 (a half turn) in its first cycle and never turns again after that.
It is also useful for waiting before reproducing (`*.robage 10 >`) or for giving
a child a few cycles of grace.

You can't change it: if you write to `.robage`, the engine overwrites your value in the same
cycle (see [[adn/stores]]). If you need a clock that you can reset to zero, or that
parent and child keep sharing, use [[.timer]]. The age of what you are looking at
is in [[.refage]].
