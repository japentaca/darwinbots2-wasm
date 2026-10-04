---
titulo: dropbool
resumen: "Saca y descarta el valor de arriba de la pila booleana. Dentro del cuerpo, termina el efecto de una condición en línea."
etiquetas: [pila booleana, condiciones, descartar]
estado: revisada
---
<!-- 20-VM §6.5 (dropbool), §4 (gate de stores); comprobado en el port -->

`dropbool` saca el valor de arriba de la pila booleana y lo tira. Si la pila
está vacía, no pasa nada.

Su lugar es el cuerpo de un gen, después de una condición en línea. Esa
condición frena o deja pasar a todos los stores que la siguen; `dropbool` la
saca y los stores vuelven a depender de lo que haya quedado abajo, o de nada
si la pila quedó vacía (vacía cuenta como verdadera).

```adn
cond
start
  *.robage 5 <
  10 .up store
  dropbool
  *.robage 50 store
stop
```

Este bot empuja hacia adelante ([[.up]]) solo en sus primeros ciclos, pero
copia su edad ([[.robage]]) en la celda 50 en todos: después del `dropbool`
la condición ya no frena a nadie.

La diferencia con [[op:clearbool]] aparece cuando hay más de un valor: el
`dropbool` saca solo el de arriba y deja mandar al de abajo. Eso permite
anidar condiciones, como se ve en [[op:dupbool]]. El bot _Alga_Pair 1.1.1_,
del Bestiario, lo usa al final de una línea para que una condición afecte a un
solo store; está en [[adn/pilas#en-el-cuerpo]].

Para descartar un número de la pila entera está [[op:drop]].
