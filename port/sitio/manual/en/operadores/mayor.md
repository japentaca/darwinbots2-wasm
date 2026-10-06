---
titulo: >
resumen: "a b > leaves true if a is greater than b. The one in *.eye5 0 >, “I see something”."
etiquetas: [conditions, comparisons, greater]
estado: revisada
---
<!-- 20-VM §6.4 (>: a > b); sysvars.yaml .eye5 -->

`a b >` pops two numbers and pushes _true_ if `a` (the lower one) is greater
than `b` (the upper one). `5 3 >` is true; `3 5 >` and `5 5 >` are false.

It is one of the most frequently written comparisons in the DNA, thanks to one phrase:
`*.eye5 0 >`, “the middle eye sees something” ([[.eye5]] is 0 when there is
nothing in sight). It is also the one for thresholds: “if I have more than this
much energy”. This bot moves forward ([[.up]]) only while it has more than
1000 energy ([[.nrg]]):

```adn
' moves forward while it has more than 1000 energy
cond
  *.nrg 1000 >
start
  10 .up store
stop
```

Watch the order: `1000 *.nrg >` asks the opposite, whether 1000 is greater
than the energy. If the limit has to count too, use [[op:>=]]. The exact
opposite of `a b >` is `a b <=` ([[op:<=]]).

With the integer stack empty it compares 0 with 0 and gives false. The other
comparisons are in [[operadores/comparaciones]].
