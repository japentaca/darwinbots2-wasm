---
titulo: >=
resumen: "a b >= leaves true if a is greater than or equal to b: like >, but the limit counts too."
etiquetas: [conditions, comparisons, greater]
estado: revisada
---
<!-- 20-VM §6.4 (>=: a >= b); comprobado en el port -->

`a b >=` pops two numbers and pushes _true_ if `a` (the lower one) is greater
than `b` (the upper one) or equal to it. `5 3 >=` and `3 3 >=` are true;
`3 5 >=` is false.

Use it when the limit value has to be included. Together with [[op:<=]] it
builds closed ranges. This gene runs in cycles 10 to 20 of the bot's life
([[.robage]]), both included, and counts in cell 50 how many times it ran:

```adn
cond
  *.robage 10 >=
  *.robage 20 <=
start
  50 inc
stop
```

In the end cell 50 holds 11. With [[op:>]] and [[op:<]] instead of `>=` and
`<=` it would hold 9.

It is exactly the opposite of [[op:<]]: `a b >=` is true when `a b <` is
false. With the integer stack empty it compares 0 with 0 and gives true. The
other comparisons are in [[operadores/comparaciones]].
