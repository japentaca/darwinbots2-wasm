---
titulo: pow
resumen: "Eleva el número de abajo a la potencia del de arriba: 2 10 pow da 1024. El exponente se limita a ±10."
etiquetas: [matemática, potencia, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (pow: b saturado ±10; a = 0 → 0; satura ±2·10⁹; redondeo); comprobado en el port -->

`a b pow` deja `a` elevado a la `b`. `2 10 pow` da 1024, `-2 3 pow` da −8 y
`5 0 pow` da 1.

| Palabra | Pila después |
|---|---|
| `2` | 2 |
| `10` | 2 10 |
| `pow` | 1024 |

Tiene varios límites que conviene conocer:

- **El exponente se recorta a ±10.** `2 12 pow` da 1024, igual que
  `2 10 pow`.
- **Con base 0 da 0**, también `0 0 pow` (en matemática sería 1).
- **Un exponente negativo da fracciones, que se redondean**: `2 -1 pow` es
  0,5 y queda en 0; `1 -1 pow` da 1.
- **El resultado se queda en ±2000 millones** si se pasa.

Un uso práctico es calcular el valor de un bit para usarlo con los
operadores [[operadores/bits|bit a bit]]: `2 *50 pow` es 1, 2, 4, 8… según
lo que haya en la celda 50.

```adn
cond
start
  2 *50 pow 51 store
  *50 1 add 50 store
stop
```

En este bot la celda 51 va tomando los valores 1, 2, 4, 8… 1024, y ahí se
queda, porque el exponente no pasa de 10. La operación inversa es
[[op:root]], y el exponente que hace falta para llegar a un número lo da
[[op:logx]].
