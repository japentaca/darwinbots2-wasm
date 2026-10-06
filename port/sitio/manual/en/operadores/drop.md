---
titulo: drop
resumen: "Pops the number on top of the integer stack and discards it."
etiquetas: [stack, discarding, basic]
estado: revisada
---
<!-- 20-VM §6.1 (drop); opcodes.yaml alias dropint -->

`a b drop` leaves `a`: it throws away the top one. You can also write
`dropint`. With an empty stack it does nothing.

It is useful for cleaning up a leftover value that, if it stayed on the stack,
would be taken by the next operator or the next gene (the integer stack passes
from one gene to the next within the cycle, see [[adn/pilas#cuando]]).

```adn
cond
start
  ' stack: 5 7   drop   stack: 5
  5 7 drop 50 store
stop
```

Cell 50 ends up at 5: the 7 was discarded and the [[op:store]] used the 5.

To empty the whole integer stack at once there is [[op:clear]], and to throw
away the top of the boolean stack, [[op:dropbool]].
