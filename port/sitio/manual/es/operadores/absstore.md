---
titulo: absstore
resumen: "Le saca el signo a lo que hay en una celda: un negativo pasa a positivo."
etiquetas: [absstore, valor absoluto, escritura]
estado: revisada
---
<!-- 20-VM §7 (absstore: Abs(mem), sin mod32000, cost /8, sin flags de lazo); comprobado en el port -->

`d absstore` saca la dirección `d` y deja en la celda el valor absoluto de lo
que tenía: −77 pasa a 77, y un positivo queda igual. No toma ningún valor de
la pila.

| Palabra | Pila después |
|---|---|
| `50` | 50 |
| `absstore` | (vacía); si la celda 50 tenía −77, ahora tiene 77 |

Es útil para medir una distancia sin importar el lado:

```adn
' guarda en la 50 cuánto se aleja la energía de 5000, para arriba o para abajo
cond
start
 *.nrg 5000 sub 50 store
 50 absstore
stop
```

Con 3000 de energía ([[.nrg]]) la celda queda en 2000, igual que con 7000.
Después basta una sola comparación, como `*50 500 <`, para saber si la
energía está cerca de 5000.

Es lo mismo que `*50 abs 50 store` (ver [[op:abs]]), con menos palabras y a la
octava parte del costo de un [[op:store]]. Para cambiar el signo en lugar de
sacarlo está [[op:negstore]].
