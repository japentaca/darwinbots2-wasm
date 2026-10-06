---
titulo: mod
resumen: "Leaves the remainder of dividing the lower number by the upper one, with the sign of the dividend; with divisor 0 it gives 0."
etiquetas: [arithmetic, remainder, cycles, basics]
estado: revisada
---
<!-- 20-VM §6.1 (mod: truncado, signo del dividendo; b = 0 → 0 consumiendo a); comprobado en el port -->

`a b mod` leaves the remainder of the integer division of `a` by `b`.
`17 5 mod` gives 2, `20 5 mod` gives 0.

Its headline use is doing things every so many cycles: `*.robage 20 mod` is 0
once every 20 cycles of life ([[.robage]]). This bot makes a quarter turn to
the left ([[.aimsx]]) every 20 cycles:

```adn
cond
  *.robage 20 mod 0 =
start
  314 .aimsx store
stop
```

It's also useful for making a counter wrap around: `*50 1 add 10 mod 50 store`
makes cell 50 go through 0, 1… 9 and back to 0.

With negatives, **the remainder carries the sign of the dividend** (the lower
one): `-7 3 mod` gives −1 and `7 -3 mod` gives 1. If `a` can be negative and you
need a remainder between 0 and `b − 1`, add `b` and apply `mod` again:
`a 3 mod 3 add 3 mod`.

Dividing by zero is not an error: `7 0 mod` pops the two numbers and leaves 0.
