---
titulo: ceilstore
resumen: "Puts a ceiling on a cell: if what it holds is greater than the number, it lowers it to that number."
etiquetas: [ceilstore, ceiling, limit, writing]
estado: revisada
---
<!-- 20-VM §7 (ceilstore: mod32000(min(mem, v)); d=0 consume v; cost /5, flags de lazo); comprobado en el port -->

`v d ceilstore` leaves in cell `d` the smaller of what it held and `v`. If the
cell is already below `v`, it does not change; if it is above, it ends up at
`v`. It is a ceiling, like [[op:ceil]] but applied directly to memory.

| Word | Stack after |
|---|---|
| `30` | 30 |
| `.up` | 30 1 |
| `ceilstore` | (empty); [[.up]] is at most 30 |

Since stores are immediate, it is good for trimming a command you already wrote
in the same cycle:

```adn
' moves forward according to its age, but never asks for more than 30
cond
start
 *.robage .up store
 30 .up ceilstore
stop
```

In the first cycles the bot asks for 0, 1, 2… with [[.up]], according to its
age ([[.robage]]); from cycle 31 on it always asks for 30.

The name is a little confusing: “ceil” sounds like rounding up, but here it
means _ceiling_ and it keeps the **smaller**. To set a floor, the larger, there
is [[op:floorstore]]. Combined with [[op:addstore]] it makes a capped
accumulator (there is an example in [[op:addstore]]).

With address 0 the value is popped from the stack and lost. Like [[op:store]],
it notifies the tie system if you write to [[.tieang1]] or [[.tielen1]].
