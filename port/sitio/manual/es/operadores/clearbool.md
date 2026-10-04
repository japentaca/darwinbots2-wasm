---
titulo: clearbool
resumen: "Vacía la pila booleana. Como vacía cuenta como verdadera, todos los stores que siguen vuelven a escribir."
etiquetas: [pila booleana, condiciones, limpiar]
estado: revisada
---
<!-- 20-VM §6.5 (clearbool), §5.1-5.2 (solo cond limpia; start sin cond no), §4; comprobado en el port -->

`clearbool` vacía la pila booleana de una vez, tenga lo que tenga. Una pila
booleana vacía cuenta como verdadera, así que después de un `clearbool` todos
los stores del cuerpo vuelven a correr.

Es la forma segura de **cerrar un gen** que usó condiciones en línea. Un gen
que empieza con `start`, sin `cond`, no limpia la pila booleana: hereda lo que
dejó el anterior (ver [[adn/pilas#rareza]]). En este par de genes, sin el
`clearbool`, el falso del primero frenaría el store del segundo y la celda 51
nunca se escribiría; con él, la 51 queda en 4:

```adn
start
  1 2 = 3 50 store
  clearbool
stop

start
  4 51 store
stop
```

La otra salida es abrir cada gen con `cond`, que también vacía la pila
booleana al empezar.

Frente a [[op:dropbool]], que saca solo el de arriba, `clearbool` no deja nada
abajo que pueda volver a mandar. Frente a [[op:true]], no tapa: borra. Para
vaciar la pila entera está [[op:clear]].
