---
titulo: sub
resumen: "Resta el número de arriba de la pila al que está debajo: a b sub deja a − b."
etiquetas: [aritmética, resta, básicos]
estado: revisada
---
<!-- 20-VM §6.1 (sub idéntico a add); 20-VM §6.3 (- niega) -->

`a b sub` deja `a − b`: al de abajo se le resta el de arriba. `10 3 sub` da
7 y `3 10 sub` da −7. Es la forma más simple de convertir en un número la
diferencia entre dos lecturas, por ejemplo cuánta energía ganó o perdió el bot.

```adn
cond
start
  ' pila: *.nrg *51 → la diferencia
  *.nrg *51 sub 50 store
  *.nrg 51 store
stop
```

Este bot guarda en la celda 51 su energía y en la 50 cuánto cambió desde el
ciclo anterior (negativo si bajó).

:::cuidado
El signo menos suelto, [[op:-]], **no resta**: cambia el signo del tope.
`10 3 -` deja 10 y −3 en la pila. Para restar se usa siempre `sub`.
:::

Tiene las mismas rarezas que [[op:add]] con números enormes: pierde precisión
arriba de unos 16 millones y da la vuelta al pasar de 2000 millones.
