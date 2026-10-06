---
titulo: abs
resumen: "Replaces the number on top of the stack with its absolute value: it strips the sign."
etiquetas: [arithmetic, absolute value, basic]
estado: revisada
---
<!-- 20-VM §6.1 (abs) -->

`x abs` leaves `x` without its sign: `-7 abs` gives 7, and so does `7 abs`. It
almost always shows up after a subtraction, when what matters is how much two
things differ and not which one is bigger.

This bot moves forward only if the two eyes next to the central one,
[[.eye4]] and [[.eye6]], see more or less the same thing (they differ by
less than 10):

```adn
cond
  *.eye4 *.eye6 sub abs 10 <
start
  10 .up store
stop
```

With [[op:anglecmp]] the same thing happens: the difference between two angles
comes with a sign, and `abs` turns it into “how much I still have to turn”,
regardless of which way. To write the absolute value straight into a cell
there is [[op:absstore]].
