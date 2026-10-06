---
titulo: floorstore
resumen: "Puts a floor under a cell: if what it holds is smaller than the number, it raises it to that number."
etiquetas: [floorstore, floor, limit, writing]
estado: revisada
---
<!-- 20-VM §7 (floorstore: mod32000(max(mem, v)); d=0 consume v; cost /5, flags de lazo); comprobado en el port -->

`v d floorstore` leaves in cell `d` the larger of what it held and `v`. If the
cell is already above `v`, it does not change; if it is below, it ends up at
`v`. It is a floor, like [[op:floor]] but applied directly to memory.

| Word | Stack after |
|---|---|
| `0` | 0 |
| `50` | 0 50 |
| `floorstore` | (empty); cell 50 holds at least 0 |

The most common use is keeping a countdown from going negative:

```adn
' goes down by 7 from 30, without going below 0
cond
 *.robage 0 =
start
 30 50 store
stop
start
 7 50 substore
 0 50 floorstore
stop
```

The cell goes through 23, 16, 9, 2 and then stays at 0: [[op:substore]] takes it
to −5 and `floorstore` raises it to 0 in the same cycle.

The name is a little confusing: “floor” sounds like rounding down, but here it
means _floor_ and it keeps the **larger**. The ceiling is [[op:ceilstore]].

With address 0 the value is popped from the stack and lost. Like [[op:store]],
it notifies the tie system if you write to [[.tieang1]] or [[.tielen1]].
