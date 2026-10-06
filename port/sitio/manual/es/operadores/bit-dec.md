---
titulo: --
resumen: "Resta 1 al número del tope de la pila entera, sin tocar la memoria: 5 -- deja 4 y 0 -- deja −1."
etiquetas: [bits, contar, pila entera]
estado: revisada
---
<!-- 20-VM §6.3 (-- con préstamo; edge −2147483647 -- → 0 por BitToNumber); comprobado en el port -->

`x --` saca un número y apila ese número menos 1. `5 --` da 4 y `0 --` da
−1. Para los números de todos los días es lo mismo que `1 sub`.

:::cuidado
`--` no es [[op:dec]]. `dec` es un store: le resta 1 a una _celda de memoria_.
`--` le resta 1 al número de la _pila_ y no guarda nada. Tampoco es el signo
menos suelto, [[op:-]], que cambia el signo.
:::

Sirve cuando un número calculado está corrido en uno. Por ejemplo, para
llevar un número de ojo del 1 al 9 a un índice que empiece en 0:

```adn
' guarda en la 51 el valor de la 50 menos 1
cond
start
  *50 -- 51 store
stop
```

Con 9 en la celda 50, la 51 queda en 8.

Una rareza heredada, solo en el borde de los 32 bits: `--` sobre −2147483647
debería dar el más negativo (−2147483648), pero da 0. Ningún valor de la memoria
llega ahí. Con la pila vacía opera sobre 0 y deja −1. Lo opuesto es
[[op:++]]; el resto de la familia, en [[operadores/bits]].
