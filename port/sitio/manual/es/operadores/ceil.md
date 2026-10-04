---
titulo: ceil
resumen: "Pone un techo: de los dos números de arriba de la pila deja el menor, así x 100 ceil nunca pasa de 100."
etiquetas: [tope, mínimo, rango, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (ceil = min, comparación en Single; core DNAceil empuja el Single); comprobado en el port -->

`x techo ceil` deja el menor de los dos: `x` si está por debajo del techo, y
el techo si no. El nombre viene de ahí (_ceiling_, techo), aunque el
resultado sea el _mínimo_, lo que confunde a más de uno. `7 100 ceil` da 7 y
`700 100 ceil` da 100.

Se usa para que un valor calculado no se pase de un límite antes de
guardarlo. Este bot empuja hacia adelante con la décima parte de su energía,
pero nunca con más de 30:

```adn
cond
start
  *.nrg 10 div 30 ceil .up store
stop
```

Combinado con su par, [[op:floor]], encierra un valor en un rango:
`x 50 ceil 5 floor` queda entre 5 y 50 (ver el ejemplo de _Saber_ en
[[operadores/avanzados]]).

Una rareza que solo se nota con números enormes: `ceil` compara con menos
precisión que `floor`, y arriba de 16.777.216 el resultado puede salir
corrido en algunas unidades (más cuanto más grande sea el número). Con
números del tamaño de la memoria nunca pasa.
Para escribir el mínimo directamente en una celda está [[op:ceilstore]].
