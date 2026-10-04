---
titulo: |
resumen: "O bit a bit de los dos números del tope: deja prendido cada bit que esté prendido en alguno de los dos. Sirve para prender marcas."
etiquetas: [bits, banderas, máscaras]
estado: revisada
---
<!-- 20-VM §6.3 (|: OR bit a bit); comprobado en el port -->

`a b |` saca dos números y deja otro con prendidos todos los bits que estén
prendidos en `a`, en `b` o en los dos. `12 10 |` da 14 (1100 o 1010 es 1110).

Es la forma de **prender una marca** sin tocar las demás: si la celda ya
tenía el bit, queda igual; si no, se suma. Este bot anota en el bit de valor 2
de la celda 50 que alguna vez vio algo con el ojo del medio ([[.eye5]]), y la
marca le queda para siempre:

```adn
' marca que alguna vez vio algo
cond
  *.eye5 0 >
start
  *50 2 | 50 store
stop
```

Con números que no comparten bits, `|` es lo mismo que sumar: `4 1 |` da 5.
Cuando sí comparten, no: `5 1 |` sigue dando 5, mientras que `5 1 add` da 6.
Por eso es más seguro que [[op:add]] para prender marcas: repetirlo no cambia
nada.

Para consultar o apagar una marca se usa [[op:&]]; para darla vuelta, [[op:^]].
Con la pila vacía opera sobre ceros. No hay que confundirlo con [[op:or]], que
combina verdaderos y falsos de la pila booleana.
