---
titulo: sub
resumen: "Subtracts the top number of the stack from the one below it: a b sub leaves a − b."
etiquetas: [arithmetic, subtraction, basics]
estado: revisada
---
<!-- 20-VM §6.1 (sub idéntico a add); 20-VM §6.3 (- niega) -->

`a b sub` leaves `a − b`: the upper one is subtracted from the lower one.
`10 3 sub` gives 7 and `3 10 sub` gives −7. It's the simplest way to turn the
difference between two reads into a number, for example how much energy the
bot gained or lost.

```adn
cond
start
  ' stack: *.nrg *51 → the difference
  *.nrg *51 sub 50 store
  *.nrg 51 store
stop
```

This bot keeps its energy in cell 51 and, in cell 50, how much it changed since
the previous cycle (negative if it went down).

:::cuidado
The loose minus sign, [[op:-]], **does not subtract**: it flips the sign of the
top. `10 3 -` leaves 10 and −3 on the stack. To subtract you always use `sub`.
:::

It has the same quirks as [[op:add]] with enormous numbers: it loses precision
above about 16 million and wraps around when it goes past 2 billion.
