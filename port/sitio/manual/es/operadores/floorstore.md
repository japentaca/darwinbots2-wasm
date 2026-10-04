---
titulo: floorstore
resumen: "Le pone un piso a una celda: si lo que tiene es menor que el número, lo sube a ese número."
etiquetas: [floorstore, piso, límite, escritura]
estado: revisada
---
<!-- 20-VM §7 (floorstore: mod32000(max(mem, v)); d=0 consume v; cost /5, flags de lazo); comprobado en el port -->

`v d floorstore` deja en la celda `d` el mayor entre lo que tenía y `v`. Si la
celda ya está por encima de `v`, no cambia; si está por debajo, queda en `v`.
Es un piso, como [[op:floor]] pero aplicado directamente sobre la memoria.

| Palabra | Pila después |
|---|---|
| `0` | 0 |
| `50` | 0 50 |
| `floorstore` | (vacía); la celda 50 vale como poco 0 |

El uso más común es impedir que una cuenta regresiva pase a negativo:

```adn
' baja de a 7 desde 30, sin pasar de 0
cond
 *.robage 0 =
start
 30 50 store
stop
start
 7 50 substore
 0 50 floorstore
stop
```

La celda pasa por 23, 16, 9, 2 y después se queda en 0: el
[[op:substore]] la lleva a −5 y el `floorstore` la sube a 0 en el mismo
ciclo.

El nombre confunde un poco: «floor» suena a redondear hacia abajo, pero acá
quiere decir _piso_ y se queda con el **mayor**. El techo es
[[op:ceilstore]].

Con la dirección 0 el valor se saca de la pila y se pierde. Como
[[op:store]], le avisa al sistema de lazos si escribís en [[.tieang1]] o
[[.tielen1]].
