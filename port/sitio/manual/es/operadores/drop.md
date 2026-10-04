---
titulo: drop
resumen: "Saca el número de arriba de la pila entera y lo descarta."
etiquetas: [pila, descartar, básicos]
estado: revisada
---
<!-- 20-VM §6.1 (drop); opcodes.yaml alias dropint -->

`a b drop` deja `a`: tira el de arriba. También se puede escribir `dropint`.
Con la pila vacía no hace nada.

Sirve para limpiar un valor que sobró y que, si quedara en la pila, lo
tomaría el siguiente operador o el siguiente gen (la pila entera pasa de un
gen al otro dentro del ciclo, ver [[adn/pilas#cuando]]).

```adn
cond
start
  ' pila: 5 7   drop   pila: 5
  5 7 drop 50 store
stop
```

La celda 50 termina en 5: el 7 se descartó y el [[op:store]] usó el 5.

Para vaciar la pila entera de una vez está [[op:clear]], y para tirar el tope
de la pila booleana, [[op:dropbool]].
