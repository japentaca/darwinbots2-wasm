---
titulo: .tout1
resumen: "First tie output channel: the number you write here is read in its .tin1 by the bot tied to you."
etiquetas: [communication, ties, tout, tin]
estado: revisada
---
`.tout1` is like [[.out1]], but instead of reaching whoever is looking at you, it reaches whoever
is tied to you: the engine copies your `.tout1` into the [[.tin1]] of the bot at the other
end of the tie, and it reads it in the next cycle. If you have no ties, nobody
reads it.
<!-- sysvars.yaml .tout1; 34-TIES §2 (readtie → ReadTRefVars en P1, después del ADN) -->

The engine doesn't clear it: the value stays published until you change it. A child is born
with `.tout1` at 0.
<!-- sysvars.yaml .tout1 (borra: no); 36-REPRO §2 (el hijo no hereda mem) -->

There is a condition on the listener's side: each bot reads **only one tie** per
cycle, the one it chooses with [[.readtie]] or, if it didn't choose any, the most recently
created one ([[.tiepres]]). If you are tied to several bots, your `.tout1` only reaches those that
happen to be listening to exactly the tie that joins them to you.
<!-- 34-TIES §2 (readtie: tie readtie o, si vale 0, tiepres) -->

The simplest case is parent and child: at birth they are joined by a tie that
lasts about 100 cycles, and both listen to it without doing anything. The child, though,
only receives something once its [[.robage]] reaches 3: before that, its `.tin1` is 0.
This bot publishes its age plus 1000 and notes in 50 whatever reaches it from the other side:

```adn
cond
*.robage 2 =
start
50 .repro store
stop

start
*.robage 1000 add .tout1 store
*.tin1 50 store
stop
```

The parent sees in `.tin1` the child's age (plus 1000) and the child sees the parent's,
always one cycle late.
<!-- 34-TIES §1 (tie de nacimiento: last = 100), §2 (newage ≥ 2); comprobado con probar-adn: el padre lee 1000, 1001…; el hijo ve 0 con robage 0 a 2 -->

There are ten identical channels, from `.tout1` to [[.tout10]]; see
[[sysvars/entradas-salidas]].
