---
titulo: rnd
resumen: "Replaces the top number of the stack with a random one between 0 and that number, both included."
etiquetas: [random, chance, basics]
estado: revisada
---
<!-- 20-VM §6.1 (rnd: Random(0, n) = Int((n+1)·rndy)); core common.hpp Random; comprobado en el port: -5 rnd da −4…−1 -->

`n rnd` pops `n` and pushes a random integer between 0 and `n`, both
included and all equally likely. `10 rnd` can give 0, 1… or 10. Together with
[[op:rndstore]], it's the source of randomness in the DNA, and the basis of any
behavior that isn't entirely predictable: random headings, variable waits,
decisions that don't repeat.

```adn
cond
start
  ' turns between 10 to the right and 10 to the left
  20 rnd 10 sub .aimsx store
  10 .up store
stop
```

This bot moves forward zigzagging: `20 rnd` gives a number from 0 to 20 and, after
subtracting 10, the turn of [[.aimsx]] ends up between −10 and 10. To pick any
direction at all, `1256 rnd .setaim store` (a full turn is 1256 units, see
[[.setaim]]).

The odd cases:

- `0 rnd` always gives 0.
- With a negative number the result isn't symmetric: `-5 rnd` gives −4, −3, −2
  or −1, never −5 or 0 (strictly speaking 0 only comes out if the draw gives
  exactly zero, which in practice doesn't happen). If you want a range with
  negatives, use a positive number and subtract, as in the example.

To write a random value directly into a cell there is `rndstore`.
