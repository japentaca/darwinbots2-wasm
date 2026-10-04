---
titulo: Escritura en memoria
resumen: "Los catorce stores: las únicas palabras que cambian la memoria del bot, y por lo tanto la única forma de que haga algo."
etiquetas: [stores, memoria, escritura, operadores]
estado: revisada
---
<!-- 20-VM §7, §4 (gate tipo 7), §1; opcodes.yaml stores -->

Todo lo que un bot hace pasa por estas palabras. Moverse, girar, disparar o
reproducirse es poner un número en una sysvar, y lo único que escribe en la
memoria son los _stores_. Todos comparten lo mismo:

- La **dirección** sale del tope de la [[adn/pilas|pila entera]]; los de dos
  operandos sacan además un **valor** de debajo. Por eso se escribe
  `valor dirección store`.
- Solo corren dentro del cuerpo de un gen (después de [[op:start]] o
  [[op:else]]) y solo si el tope de la pila booleana es verdadero o está
  vacía. Un store salteado no saca nada de la pila (ver [[adn/condiciones]]).
- La dirección 0 no escribe ni cobra. Fuera de 1 a 1000 se ajusta al rango, y
  el valor guardado se recorta a ±32000.

[[op:store]] es, de lejos, el más usado: con él se dan todas las órdenes.
[[op:inc]] y [[op:dec]] son los contadores baratos (un décimo del costo). El
resto modifica lo que ya hay en la celda sin tener que leerla antes:
[[op:addstore]], [[op:substore]], [[op:multstore]] y [[op:divstore]] hacen
cuentas, [[op:ceilstore]] y [[op:floorstore]] ponen un techo o un piso, y
[[op:rndstore]], [[op:sgnstore]], [[op:absstore]], [[op:sqrstore]] y
[[op:negstore]] transforman el número que está guardado.

Se combinan bien sobre la misma celda. Este gen acelera de a poco y se
frena en un tope:

```adn
' pide 2 más por ciclo, hasta 40
cond
start
 2 50 addstore
 40 50 ceilstore
 *50 .up store
stop
```

La celda 50 sube 2, 4, 6… hasta 40 y se queda ahí, y [[.up]] recibe ese
valor cada ciclo. Con `*50 2 add 40 ceil 50 store` también se puede, pero lleva más
palabras.

La explicación completa, con la tabla de la familia, qué direcciones se
pueden escribir y cuándo actúa el motor sobre lo escrito, está en
[[adn/stores]].
