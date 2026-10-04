---
titulo: ceilstore
resumen: "Le pone un techo a una celda: si lo que tiene es mayor que el número, lo baja a ese número."
etiquetas: [ceilstore, techo, límite, escritura]
estado: revisada
---
<!-- 20-VM §7 (ceilstore: mod32000(min(mem, v)); d=0 consume v; cost /5, flags de lazo); comprobado en el port -->

`v d ceilstore` deja en la celda `d` el menor entre lo que tenía y `v`. Si la
celda ya está por debajo de `v`, no cambia; si está por encima, queda en `v`.
Es un techo, como [[op:ceil]] pero aplicado directamente sobre la memoria.

| Palabra | Pila después |
|---|---|
| `30` | 30 |
| `.up` | 30 1 |
| `ceilstore` | (vacía); [[.up]] vale como mucho 30 |

Como los stores son inmediatos, sirve para recortar una orden que ya
escribiste en el mismo ciclo:

```adn
' avanza según la edad, pero nunca pide más de 30
cond
start
 *.robage .up store
 30 .up ceilstore
stop
```

Los primeros ciclos el bot pide 0, 1, 2… con [[.up]], según su edad
([[.robage]]); desde el ciclo 31 pide siempre 30.

El nombre confunde un poco: «ceil» suena a redondear hacia arriba, pero acá
quiere decir _techo_ y se queda con el **menor**. Para poner un piso, el
mayor, está [[op:floorstore]]. Combinado con [[op:addstore]] arma un
acumulador con tope (hay un ejemplo en [[op:addstore]]).

Con la dirección 0 el valor se saca de la pila y se pierde. Como
[[op:store]], le avisa al sistema de lazos si escribís en [[.tieang1]] o
[[.tielen1]].
