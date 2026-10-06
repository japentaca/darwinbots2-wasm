---
titulo: floor
resumen: "Sets a floor: of the top two numbers on the stack it leaves the larger, so x 0 floor never goes below 0."
etiquetas: [cap, maximum, range, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (floor = max, comparación en Long); Bestiario: Saber (1_3.txt) -->

`x limit floor` leaves the larger of the two: `x` if it is above the
limit, and the limit if not. As with [[op:ceil]], the name (_floor_) describes
the limit and not the operation: the result is the _maximum_. `-50 0 floor`
gives 0 and `80 0 floor` gives 80.

The classic use is avoiding negatives. _Saber_, by abyaly, writes to [[.dn]] the
difference between 180 and its speed ([[.velscalar]]), but never a negative
number: if it is already going faster than 180, it writes 0.

```adn
cond
start
  180 *.velscalar sub 0 floor .dn store
stop
```

With `x 5 floor 50 ceil`, or in the other order, the value ends up fenced
between 5 and 50. To write the maximum straight into a cell there is
[[op:floorstore]].
