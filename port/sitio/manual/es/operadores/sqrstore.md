---
titulo: sqrstore
resumen: "Cambia lo que hay en una celda por su raíz cuadrada redondeada; si no es positivo, la deja en 0."
etiquetas: [sqrstore, raíz cuadrada, escritura]
estado: revisada
---
<!-- 20-VM §7 (sqrstore: mem>0 -> Sqr redondeado; si no 0; sin mod32000; cost /7; sin flags de lazo); comprobado en el port -->

`d sqrstore` saca la dirección `d` y deja en la celda la raíz cuadrada de lo
que tenía, redondeada al entero más cercano. No toma ningún valor de la pila.

| Palabra | Pila después |
|---|---|
| `50` | 50 |
| `sqrstore` | (vacía); si la celda 50 tenía 50, ahora tiene 7 |

La raíz sirve para achicar números grandes sin perder el orden: 3000 queda en
55 y 30000 en 173.

```adn
' empuja hacia adelante según la raíz de su energía
cond
start
 *.nrg 50 store
 50 sqrstore
 *50 .up store
stop
```

<!-- 21-MEMORIA §3 (régimen A, latencia 1); 10-CICLO «Flujo de datos de los sentidos» -->
Con 3000 de energía ([[.nrg]]) el bot pide 55 con [[.up]]; con menos
energía, menos. En el primer ciclo pide 0, porque los sentidos todavía no se
publicaron y `*.nrg` lee 0 (ver [[adn/ejecucion]]).

Si la celda tiene 0 o un negativo, queda en 0: no da error. Es lo mismo que
`*50 sqr 50 store` (ver [[op:sqr]]), con menos palabras y a la séptima parte
del costo de un [[op:store]].
