---
titulo: mult
resumen: "Multiplies the top two numbers of the integer stack; if the product goes over 2 billion, it stays at that cap."
etiquetas: [arithmetic, product, basics]
estado: revisada
---
<!-- 20-VM §6.1 (mult satura ±2·10⁹), §7 (mod32000 al guardar); comprobado en el port -->

`a b mult` leaves `a · b`. It's useful for scaling a read (`*.eye5 2 mult`),
for building numbers bigger than the maximum literal (`200 200 mult` gives
40000) and, together with [[op:div]], for proportional calculations.

| Word | Stack afterwards |
|---|---|
| `300` | 300 |
| `300` | 300 300 |
| `mult` | 90000 |

Unlike [[op:add]] and [[op:sub]], which wrap around, `mult` **saturates**: if
the product goes over 2 billion (in either direction), it leaves exactly
±2000000000.

What you do have to keep in mind is the clipping when storing. The stack can
hold the 90000, but a memory cell can't:

```adn
cond
start
  300 300 mult 50 store
  300 300 mult 300 div 51 store
stop
```

Cell 50 ends up at 26000 (the remainder of dividing 90000 by 32000) and cell
51 at 300, because the division shrank the number before storing it. See
[[adn/numeros#recorte]].
