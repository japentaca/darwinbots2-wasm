---
titulo: logx
resumen: "Gives the logarithm of the lower number in the base of the upper one, rounded: 1000 10 logx gives 3."
etiquetas: [math, logarithm, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (logx: Abs de ambos; b < 2 o a = 0 → 0; Log(a)/Log(b) redondeado); comprobado en el port -->

`a b logx` leaves the logarithm of `a` in base `b`: the exponent you have to
raise `b` to in order to get `a`. `1000 10 logx` gives 3 and `8 2 logx` gives
3. As always, the result is rounded: `100 2 logx` gives 7 (it is 6.64…).

The rules for the odd cases:

- The **sign is dropped** from both numbers before calculating.
- If the base is less than 2 (0 or 1), or if `a` is 0, it gives **0**.

It's useful for working with orders of magnitude, when it matters more _how
many digits_ a number has than the exact number. This bot keeps in cell 50 the
order of magnitude of its energy: 3 as long as it's between about 320 and
3160, 2 below that and 4 above (the rounding changes value halfway):

```adn
cond
start
  *.nrg 10 logx 50 store
stop
```

The inverse operation is [[op:pow]]: `10 3 pow` gives 1000.
