---
titulo: sqr
resumen: "Cambia el número de arriba de la pila por su raíz cuadrada redondeada; si no es positivo, da 0."
etiquetas: [matemática, raíz cuadrada, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (sqr: a > 0 → Sqr redondeado, si no 0); Bestiario: Pacifist v0.01 (1_5.txt); comprobado en el port -->

`x sqr` deja la raíz cuadrada de `x`, redondeada al entero más cercano:
`100 sqr` da 10, `10 sqr` da 3 y `2 sqr` da 1. Ojo, que el nombre engaña: no
eleva al cuadrado (para eso, `x dup mult` o `x 2 pow`).

Con un número negativo, o con 0, da **0**. Eso, que parece un detalle, lo
aprovechan varios bots del Bestiario: `x sqr dup div` vale 1 si `x` es
positivo y 0 si no, porque [[op:div]] por cero da 0. _Pacifist v0.01_ lo
usa para cargar veneno solo cuando tiene más de 100 de energía:

```adn
cond
start
  ' la dirección queda en 824 si *.nrg − 100 es positivo, y en 0 si no
  40 .strvenom *.nrg 100 sub sqr dup div mult store
stop
```

Fijate en qué se multiplica: no el 40, sino la dirección de [[.strvenom]],
que queda en 824 o en 0. Y un [[op:store]] a la dirección 0 no hace nada (ver
[[adn/numeros#cero]]), así que el 40 solo se escribe con energía de sobra.

Para la longitud de un vector, que es la raíz de una suma de cuadrados, está
[[op:pyth]]; para otras raíces, [[op:root]].
