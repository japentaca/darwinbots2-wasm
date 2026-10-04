---
titulo: anglecmp
resumen: "Compara dos ángulos y da la diferencia más corta entre ellos, con signo, entre −628 y 628: cuánto y hacia dónde girar."
etiquetas: [geometría, ángulo, girar, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (anglecmp: Mod 1256 a [0,1255], AngDiff·200 en ±628); core common.hpp AngDiff (a − b); comprobado en el port -->

`a b anglecmp` deja la diferencia `a − b` entre dos ángulos, pero por el
camino corto: entre −628 y 628 (media vuelta para cada lado). Los ángulos van
en las unidades de [[.aim]], donde 1256 es un giro completo, y antes de
compararlos se llevan a ese rango, así que `1300` y `44` son el mismo ángulo.

| `a b anglecmp` | Resultado |
|---|---|
| `300 100` | 200 |
| `100 300` | −200 |
| `100 1200` | 157 (por el camino corto) |
| `0 628` | −628 |

El resultado positivo quiere decir que `a` está a la izquierda de `b`
(sentido antihorario). Por eso `destino *.aim anglecmp` es exactamente lo que
hay que girar hacia la izquierda con [[.aimsx]] para mirar al destino; si da
negativo, el giro va para el otro lado. Este bot se orienta hacia abajo (942):

```adn
cond
start
  942 *.aim anglecmp .aimsx store
stop
```

En el primer ciclo `*.aim` todavía se lee en 0, así que el bot se pasa; en el
segundo ya corrige y queda mirando a 942. Para preguntar solo si ya está
apuntando más o menos bien, usá el valor absoluto:
`942 *.aim anglecmp abs 20 <`.

[[op:angle]] da el ángulo hacia un punto, y es el compañero natural de
`anglecmp`.
