---
titulo: floor
resumen: "Pone un piso: de los dos números de arriba de la pila deja el mayor, así x 0 floor nunca baja de 0."
etiquetas: [tope, máximo, rango, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (floor = max, comparación en Long); Bestiario: Saber (1_3.txt) -->

`x piso floor` deja el mayor de los dos: `x` si está por encima del piso, y
el piso si no. Como con [[op:ceil]], el nombre (_floor_, piso) describe el
límite y no la operación: el resultado es el _máximo_. `-50 0 floor` da 0 y
`80 0 floor` da 80.

El uso clásico es evitar negativos. _Saber_, de abyaly, escribe en [[.dn]]
la diferencia entre 180 y su velocidad ([[.velscalar]]), pero nunca un
número negativo: si ya va a más de 180, escribe 0.

```adn
cond
start
  180 *.velscalar sub 0 floor .dn store
stop
```

Con `x 5 floor 50 ceil`, o en el otro orden, el valor queda encerrado entre 5
y 50. Para escribir el máximo directamente en una celda está
[[op:floorstore]].
