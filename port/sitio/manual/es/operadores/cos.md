---
titulo: cos
resumen: "Da el coseno de un ángulo en unidades de .aim, multiplicado por 32000: 0 cos da 32000."
etiquetas: [trigonometría, coseno, ángulo, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (cos: Cos(a/200)·32000, redondeado); comprobado en el port -->

`ángulo cos` deja el coseno del ángulo multiplicado por 32000 y redondeado.
Funciona igual que [[op:sin]]: el ángulo en unidades de [[.aim]] (unas 1256
por vuelta) y el resultado entre −32000 y 32000.

| Ángulo | `cos` |
|---|---|
| 0 (hacia la derecha) | 32000 |
| 314 (hacia arriba) | 25 (casi 0: 314 no es un cuarto de vuelta exacto) |
| 628 (hacia la izquierda) | −32000 |

El coseno da la parte _horizontal_ de un movimiento. Este bot calcula
cuánto avanza a la derecha por cada 100 que se mueve hacia donde apunta, y
lo guarda en la celda 50 (negativo si apunta hacia la izquierda):

```adn
cond
start
  *.aim cos 100 mult 32000 div 50 store
stop
```

Multiplicá antes de dividir: `*.aim cos 32000 div 100 mult` solo puede dar
0, −100 o 100, porque la división redondea a un entero antes de escalar.
