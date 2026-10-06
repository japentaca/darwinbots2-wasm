---
titulo: -
resumen: "A loose minus sign flips the sign of the top number: 5 - leaves −5. It doesn't subtract; for that there is sub."
etiquetas: [sign, negatives, integer stack]
estado: revisada
---
<!-- 20-VM §6.3 (- negate: negación directa); comprobado en el port -->

`x -` pops a number and pushes the same one with its sign flipped: `5 -`
gives −5 and `-7 -` gives 7. It is a single-operand operator, and that's why
it's easy to mix up.

:::cuidado
A loose `-` **does not subtract**. `10 3 -` doesn't give 7: it leaves 10 and
−3 on the stack. To subtract you use [[op:sub]] (`10 3 sub`). And a negative
number is written with the sign attached, `-5`; with a space, `- 5` flips the sign of
whatever is on the stack and then pushes a 5.
:::

It's useful for inverting a read. This bot pushes forward for its first 5
cycles and then brakes by pushing, every cycle, as much as its forward
velocity ([[.velup]]) but the other way around. In a few cycles it comes to a
stop:

```adn
' accelerates for 5 cycles and then brakes
cond
  *.robage 5 <
start
  10 .up store
stop

cond
  *.robage 5 >=
start
  *.velup - .up store
stop
```

When the velocity is negative, `-` makes it positive and [[.up]] pushes
forward: the same gene brakes in both directions.

To flip the sign of a memory cell, without going through the stack, there is
[[op:negstore]]. With an empty stack, `-` leaves 0. Although it is in the
[[operadores/bits|bitwise]] family, it doesn't touch the bits.
