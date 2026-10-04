---
titulo: >
resumen: "a b > deja verdadero si a es mayor que b. Es la de *.eye5 0 >, «veo algo»."
etiquetas: [condiciones, comparaciones, mayor]
estado: revisada
---
<!-- 20-VM §6.4 (>: a > b); sysvars.yaml .eye5 -->

`a b >` saca dos números y apila _verdadero_ si `a` (el de abajo) es mayor
que `b` (el de arriba). `5 3 >` es verdadero; `3 5 >` y `5 5 >` son falsos.

Es una de las comparaciones más escritas del ADN, por una frase:
`*.eye5 0 >`, «el ojo del medio ve algo» ([[.eye5]] vale 0 cuando no hay nada
a la vista). También es la de los umbrales: «si tengo más de tanta energía».
Este bot avanza ([[.up]]) solo mientras tiene más de 1000 de energía
([[.nrg]]):

```adn
' avanza mientras tenga más de 1000 de energía
cond
  *.nrg 1000 >
start
  10 .up store
stop
```

Ojo con el orden: `1000 *.nrg >` pregunta lo contrario, si 1000 es mayor que
la energía. Si el límite también tiene que contar, usá [[op:>=]]. Lo
contrario exacto de `a b >` es `a b <=` ([[op:<=]]).

Con la pila entera vacía compara 0 con 0 y da falso. Las demás comparaciones
están en [[operadores/comparaciones]].
