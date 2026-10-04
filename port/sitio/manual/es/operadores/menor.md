---
titulo: <
resumen: "a b < deja verdadero si a es menor que b. La comparación de «todavía no llegó a»."
etiquetas: [condiciones, comparaciones, menor]
estado: revisada
---
<!-- 20-VM §6.4 (<: a < b); comprobado en el port -->

`a b <` saca dos números y apila _verdadero_ si `a` (el de abajo) es menor
que `b` (el de arriba), y _falso_ si no. `3 5 <` es verdadero; `5 3 <` y
`5 5 <` son falsos.

Es la comparación para los límites: «mientras tenga menos de», «si todavía
no llegó a». Este bot empuja hacia adelante ([[.up]]) solo mientras va a menos
de 20 ([[.velup]]). Acelera unos ciclos y después mantiene esa velocidad, sin
pasarse:

```adn
' empuja solo mientras va a menos de 20
cond
  *.velup 20 <
start
  5 .up store
stop
```

Si querés que el valor límite también cuente, usá [[op:<=]]. Lo contrario
exacto de `a b <` es `a b >=` ([[op:>=]]).

Con la pila entera vacía compara 0 con 0 y da falso. Las demás comparaciones
están en [[operadores/comparaciones]].
