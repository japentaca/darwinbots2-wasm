---
titulo: sin
resumen: "Da el seno de un ángulo en unidades de .aim, multiplicado por 32000: 314 sin da 32000."
etiquetas: [trigonometría, seno, ángulo, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (sin: Sin(a/200)·32000, redondeado, sin normalizar); comprobado en el port -->

`ángulo sin` deja el seno del ángulo multiplicado por 32000 y redondeado. El
ángulo va en las unidades de [[.aim]] (200 por radián, unas 1256 por vuelta),
y el resultado va de −32000 a 32000 en lugar de −1 a 1, porque en la pila no
hay decimales.

| Ángulo | `sin` |
|---|---|
| 0 | 0 |
| 157 (un octavo de vuelta) | 22618 |
| 314 (hacia arriba) | 32000 |
| 942 (hacia abajo) | −32000 |

Para usarlo como fracción, multiplicá primero y dividí por 32000 al final. El
seno da la parte _vertical_ de un movimiento: si el bot avanza 100 en la
dirección del ángulo guardado en la celda 50, sube
`*50 sin 100 mult 32000 div`.

```adn
cond
start
  *.aim sin 100 mult 32000 div 51 store
  *.aim cos 100 mult 32000 div 52 store
stop
```

Este bot guarda en las celdas 51 y 52 cuánto sube y cuánto avanza a la
derecha por cada 100 que se mueva hacia donde apunta.

Un detalle: como un giro completo es 1256,6 y no 1256 exacto, `1256 sin` no
da 0 sino −102. Para ángulos que dan vueltas conviene reducirlos antes con
`1256 mod`. El coseno es [[op:cos]].
