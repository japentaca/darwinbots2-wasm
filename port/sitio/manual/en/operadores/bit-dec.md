---
titulo: --
resumen: "Subtracts 1 from the number on top of the integer stack, without touching memory: 5 -- leaves 4 and 0 -- leaves −1."
etiquetas: [bits, counting, integer stack]
estado: revisada
---
<!-- 20-VM §6.3 (-- con préstamo; edge −2147483647 -- → 0 por BitToNumber); comprobado en el port -->

`x --` pops a number and pushes that number minus 1. `5 --` gives 4 and
`0 --` gives −1. For everyday numbers it is the same as `1 sub`.

:::cuidado
`--` is not [[op:dec]]. `dec` is a store: it subtracts 1 from a _memory cell_.
`--` subtracts 1 from the number on the _stack_ and stores nothing. Nor is it
the loose minus sign, [[op:-]], which flips the sign.
:::

It is useful when a computed number is off by one. For example, to turn an eye
number from 1 to 9 into an index that starts at 0:

```adn
' stores in 51 the value of 50 minus 1
cond
start
  *50 -- 51 store
stop
```

With 9 in cell 50, cell 51 ends up at 8.

One inherited quirk, only at the edge of 32 bits: `--` on −2147483647 should
give the most negative number (−2147483648), but gives 0. No memory value gets there.
With an empty stack it operates on 0 and leaves −1. Its opposite is [[op:++]];
the rest of the family is in [[operadores/bits]].
