---
titulo: inc
resumen: "Le suma 1 a una celda de memoria: el contador más barato del ADN."
etiquetas: [inc, contador, escritura, memoria]
estado: revisada
---
<!-- 20-VM §7 (inc: un operando, mod32000, cost /10, sin flags de lazo); comprobado en el port -->

`d inc` saca la dirección `d` y le suma 1 a lo que haya en esa celda. No
toma ningún valor de la pila: `50 inc` es lo mismo que
`*50 1 add 50 store`, pero en dos palabras y por la décima parte del costo
de un [[op:store]].

| Palabra | Pila después |
|---|---|
| `50` | 50 |
| `inc` | (vacía); la celda 50 vale uno más |

El uso típico es contar ciclos en la memoria libre, que no se borra entre un
ciclo y otro:

```adn
' cuenta los ciclos en la celda 50 y cada 10 gira
start
 50 inc
stop
cond
 *50 10 >=
start
 0 50 store
 100 .aimdx store
stop
```

La celda 50 va de 1 a 9; en el décimo ciclo llega a 10, el segundo gen la
vuelve a 0 y el bot gira 100 con [[.aimdx]]. Así, gira una vez cada 10
ciclos.

Dos cosas a tener en cuenta:

- Si dejás que cuente sin límite, después de 32000 no sigue ni pasa a
  negativo: vuelve a 1.
- Sobre [[.tieang1]] o [[.tielen1]] cambia el número, pero el lazo no se
  entera. Para esas celdas usá `1 .tieang1 addstore` (ver [[adn/stores]]).

Para restar 1 está [[op:dec]]; para sumar otra cantidad, [[op:addstore]].
