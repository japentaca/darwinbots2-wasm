---
titulo: debugint
resumen: "Notes the number on top of the integer stack so you can look at it from the bot's console, without popping it and at no cost."
etiquetas: [debugging, console, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (debugint: round-trip por Single, sin coste), §1 (ADCMDCOST solo value < 13), §4 (dbgstring se vacía en cada ExecuteDNA); comprobado en el port -->

`debugint` looks at the number on top of the integer stack and notes it, along
with the position of the word in the DNA, in the bot's trace. The stack stays
the same. It is the way to see what value a calculation has halfway through
without changing what the bot does.

```adn
cond
start
  *.nrg debugint 10 div debugint .up store
stop
```

To see the trace, open the bot's console in the [[app/inspector|inspector]] and
use the `debug` command: it shows each noted value with its position. The trace
is cleared at the start of each bot's turn, so you always see the one from the
last cycle.

It costs no energy, unlike the rest of the advanced operators, so it can be
left in the DNA while you test. With one caveat: with numbers above 16,777,216
(which only come from big calculations, never from memory) it can change the
value by a few units when noting it. For the boolean stack there is
[[op:debugbool]].
