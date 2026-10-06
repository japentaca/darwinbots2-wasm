---
titulo: clear
resumen: "Empties the integer stack in one go; it does not touch the boolean stack."
etiquetas: [stack, emptying, basic]
estado: revisada
---
<!-- 20-VM §3, §4 (pila entera no se limpia entre genes), §6.1 (clear); opcodes.yaml alias clearint -->

`clear` throws away everything in the integer stack. You can also write
`clearint`. The boolean stack stays as it was; for that one there is
[[op:clearbool]].

Why empty the stack, if every bot starts its turn with empty stacks? Because
**between genes of the same cycle the integer stack is not emptied**: a number
left over in one gene is found by the next. `clear` at the start of a body
makes sure the gene works only with its own values.

```adn
start
  7
stop

cond
start
  clear 50 store
stop
```

The first gene leaves a forgotten 7. Without the `clear`, the second gene would
store it in cell 50; with the `clear`, the stack is empty, [[op:store]] pops a 0
and cell 50 ends up at 0. More on this in [[adn/pilas#cuando]].
