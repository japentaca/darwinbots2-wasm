---
titulo: store
resumen: "Guarda un número en una dirección de memoria: así se dan todas las órdenes, como 20 .up store para avanzar."
etiquetas: [store, escritura, memoria, órdenes]
estado: revisada
---
<!-- 20-VM §7 (store: dir = tope, valor debajo; dir 0 deja el valor en la pila), §4 (gate); comprobado en el port -->

`v d store` escribe `v` en la celda `d`. Es la palabra más común del ADN:
cada orden que le das al motor es un `store` sobre una sysvar.

| Palabra | Pila después |
|---|---|
| `20` | 20 |
| `.up` | 20 1 |
| `store` | (vacía); la celda 1 vale 20 |

Fijate que `.up` sin asterisco es solo el número 1, la dirección de [[.up]].
Si ponés `*.up` estás apilando lo que _hay_ en esa celda, y el store va a
escribir en otro lado (ver [[adn/errores#direccion]]).

```adn
' copia la energía en la celda 50 y empuja hacia adelante
cond
start
 *.nrg 50 store
 20 .up store
stop
```

<!-- sysvars.yaml .nrg (se reescribe cada ciclo), .up (el motor la pone en 0 tras usarla) -->
La escritura es inmediata: lo que viene después en el mismo ciclo ya lee el
valor nuevo. Si escribís una sysvar de sentido, como [[.nrg]], el motor la
pisa al final del ciclo; si es una orden, como [[.up]], la usa y la vuelve a
0, así que hay que escribirla en cada ciclo en que la quieras.

Tres detalles:

- Con la dirección 0 no pasa nada y no se cobra, pero el valor **queda en la
  pila**: en `7 0 store 60 store`, la celda 60 termina en 7.
- El valor se recorta a ±32000: `32001` se guarda como 1.
- Es uno de los stores que le avisan al sistema de lazos cuando escribís en
  [[.tieang1]] o [[.tielen1]] (ver [[adn/stores]]).

Para sumar a lo que ya hay, en lugar de reemplazarlo, está [[op:addstore]].
