---
titulo: div
resumen: "Divides the lower number by the top one and rounds to the nearest integer (to the even one on a tie); dividing by zero gives 0."
etiquetas: [arithmetic, division, rounding, basic]
estado: revisada
---
<!-- 20-VM §0.5, §6.1 (div: real con redondeo bancario; b = 0 → 0); comprobado en el port -->

`a b div` leaves `a / b` rounded. It has two peculiarities worth knowing by
heart:

- It **does not truncate, it rounds** to the nearest integer, and when the
  result falls exactly in the middle, to the even one: `7 2 div` gives 4,
  `5 2 div` gives 2, `100 7 div` gives 14 and `-7 2 div` gives −4.
- **Dividing by zero gives 0**, with no error.

```adn
cond
start
  7 2 div 50 store
  5 2 div 51 store
  10 0 div 52 store
stop
```

Cells 50, 51 and 52 end up at 4, 2 and 0.

Dividing by zero has a well-known use in the Bestiary: `x dup div` is 1 if `x`
is not zero and 0 if it is, and with that you build conditions without
conditions ([[adn/operadores]] covers it, with the Bardus example). The
rounding matters when converting units: `*.nrg 3 div` is not the integer
division of other languages. If you need the remainder, there is [[op:mod]].
