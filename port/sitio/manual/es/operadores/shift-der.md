---
titulo: >>
resumen: "Corre los bits del número del tope un lugar a la derecha conservando el signo: divide por 2 redondeando hacia abajo, así que 7 >> deja 3 y −5 >> deja −3."
etiquetas: [bits, dividir, redondeo]
estado: revisada
---
<!-- 20-VM §6.3 (>>: aritmético, bit 31 se conserva); §6.1 (div bancario); comprobado en el port -->

`x >>` saca un número, corre sus bits un lugar a la derecha y apila el
resultado. El bit del signo se conserva, así que un negativo sigue negativo.
En la práctica es **dividir por 2 redondeando hacia abajo**:

| Pila antes | Después de `>>` | Con `2 div` |
|---|---|---|
| `8` | `4` | `4` |
| `7` | `3` | `4` |
| `5` | `2` | `2` |
| `-5` | `-3` | `-2` |
| `-1` | `-1` | `0` |

Fijate que no es igual a [[op:div]] por 2. `div` redondea al entero más
cercano, y en el empate exacto al par; `>>` siempre baja. Con negativos la
diferencia es más visible: `-1 >>` se queda en −1 para siempre.

Este bot guarda en la celda 50 un cuarto de su energía ([[.nrg]]), con dos
corrimientos seguidos:

```adn
cond
start
  *.nrg >> >> 50 store
stop
```

Con 3000 de energía, la celda queda en 750. En el primer ciclo de vida guarda
0, porque los sentidos todavía no se publicaron (ver [[adn/ejecucion#retraso]]).

Con la pila vacía deja 0. El corrimiento a la izquierda es [[op:<<]].
