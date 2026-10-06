---
titulo: pow
resumen: "Raises the lower number to the power of the upper one: 2 10 pow gives 1024. The exponent is limited to ±10."
etiquetas: [math, power, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (pow: b saturado ±10; a = 0 → 0; satura ±2·10⁹; redondeo); comprobado en el port -->

`a b pow` leaves `a` raised to the power `b`. `2 10 pow` gives 1024,
`-2 3 pow` gives −8 and `5 0 pow` gives 1.

| Word | Stack afterwards |
|---|---|
| `2` | 2 |
| `10` | 2 10 |
| `pow` | 1024 |

It has several limits worth knowing:

- **The exponent is clipped to ±10.** `2 12 pow` gives 1024, just like
  `2 10 pow`.
- **With base 0 it gives 0**, also `0 0 pow` (in math it would be 1).
- **A negative exponent gives fractions, which are rounded**: `2 -1 pow` is
  0.5 and ends up as 0; `1 -1 pow` gives 1.
- **The result stays at ±2 billion** if it goes over.

A practical use is calculating the value of a bit to use with the
[[operadores/bits|bitwise]] operators: `2 *50 pow` is 1, 2, 4, 8… depending on
what's in cell 50.

```adn
cond
start
  2 *50 pow 51 store
  *50 1 add 50 store
stop
```

In this bot cell 51 takes the values 1, 2, 4, 8… 1024, and stays there,
because the exponent doesn't go past 10. The inverse operation is
[[op:root]], and the exponent needed to reach a number is given by
[[op:logx]].
