---
titulo: sgnstore
resumen: "Cambia lo que hay en una celda por su signo: −1 si es negativo, 0 si es cero, 1 si es positivo."
etiquetas: [sgnstore, signo, escritura]
estado: revisada
---
<!-- 20-VM §7 (sgnstore: Sgn(mem), sin mod32000, cost /7, sin flags de lazo); comprobado en el port -->

`d sgnstore` saca la dirección `d` y deja en la celda solo el signo de lo que
tenía: −1, 0 o 1. No toma ningún valor de la pila.

| Palabra | Pila después |
|---|---|
| `51` | 51 |
| `sgnstore` | (vacía); si la celda 51 tenía −77, ahora tiene −1 |

Sirve para quedarte con la _dirección_ de un cambio y olvidarte del tamaño:

```adn
' la 51 queda en -1, 0 o 1 según la energía haya bajado, seguido igual o subido
cond
start
 *.nrg *50 sub 51 store
 51 sgnstore
 *.nrg 50 store
stop
```

La celda 50 guarda la energía ([[.nrg]]) del ciclo anterior. La diferencia va
a la 51 y `sgnstore` la reduce a su signo. Un bot que está gastando energía
ve −1 ahí casi todos los ciclos. El valor ya hecho −1, 0 o 1 se puede
multiplicar después por lo que quieras.

Es lo mismo que `*51 sgn 51 store` (ver [[op:sgn]]), con menos palabras y a
la séptima parte del costo de un [[op:store]].
