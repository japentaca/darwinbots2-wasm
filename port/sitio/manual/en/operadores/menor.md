---
titulo: <
resumen: "a b < leaves true if a is less than b. The comparison for “hasn't reached yet”."
etiquetas: [conditions, comparisons, less]
estado: revisada
---
<!-- 20-VM §6.4 (<: a < b); comprobado en el port -->

`a b <` pops two numbers and pushes _true_ if `a` (the lower one) is less than
`b` (the upper one), and _false_ if not. `3 5 <` is true; `5 3 <` and `5 5 <`
are false.

It's the comparison for limits: “while I have less than”, “if it hasn't
reached yet”. This bot pushes forward ([[.up]]) only while it is going slower
than 20 ([[.velup]]). It accelerates for a few cycles and then hovers around that
speed, a unit or two above or below:

```adn
' pushes only while going slower than 20
cond
  *.velup 20 <
start
  5 .up store
stop
```

If you want the limit value to count too, use [[op:<=]]. The exact opposite
of `a b <` is `a b >=` ([[op:>=]]).

With the integer stack empty it compares 0 with 0 and gives false. The other
comparisons are in [[operadores/comparaciones]].
