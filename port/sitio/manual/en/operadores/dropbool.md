---
titulo: dropbool
resumen: "Pops and discards the value on top of the boolean stack. Inside the body, it ends the effect of an inline condition."
etiquetas: [boolean stack, conditions, discarding]
estado: revisada
---
<!-- 20-VM §6.5 (dropbool), §4 (gate de stores); comprobado en el port -->

`dropbool` pops the value on top of the boolean stack and throws it away. If
the stack is empty, nothing happens.

Its place is the body of a gene, after an inline condition. That condition
blocks or lets through all the stores that follow it; `dropbool` removes it and
the stores go back to depending on whatever is left underneath, or on nothing
if the stack is empty (empty counts as true).

```adn
cond
start
  *.robage 5 <
  10 .up store
  dropbool
  *.robage 50 store
stop
```

This bot pushes forward ([[.up]]) only in its first cycles, but copies its age
([[.robage]]) into cell 50 in all of them: after the `dropbool` the condition no
longer blocks anyone.

The difference with [[op:clearbool]] shows up when there is more than one
value: `dropbool` pops only the top one and lets the one below take charge. That
makes it possible to nest conditions, as seen in [[op:dupbool]]. The bot
_Alga_Pair 1.1.1_, from the Bestiary, uses it at the end of a line so that a
condition affects a single store; it is in [[adn/pilas#en-el-cuerpo]].

To discard a number from the integer stack there is [[op:drop]].
