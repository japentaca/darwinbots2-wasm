---
titulo: <=
resumen: "a b <= leaves true if a is less than or equal to b: like <, but the limit counts too."
etiquetas: [conditions, comparisons, less]
estado: revisada
---
<!-- 20-VM §6.4 (<=: a <= b) -->

`a b <=` pops two numbers and pushes _true_ if `a` (the lower one) is less
than `b` (the upper one) or equal to it. `3 5 <=` and `3 3 <=` are true;
`4 3 <=` is false.

It's the one to use for caps that can be reached exactly. This bot reproduces
([[.repro]]) when it has more than 3000 energy ([[.nrg]]), but only while it
is 100 cycles old or less ([[.robage]]):

```adn
' reproduces while young, if it has energy
cond
  *.nrg 3000 >
  *.robage 100 <=
start
  50 .repro store
stop
```

It is exactly the opposite of [[op:>]]: `a b <=` is true when `a b >` is
false. With [[op:>=]] you build closed ranges.

With the integer stack empty it compares 0 with 0 and gives true. The other
comparisons are in [[operadores/comparaciones]].
