---
titulo: false
resumen: "Apila un falso en la pila booleana. En la condición de un gen lo apaga; en el cuerpo frena los stores que siguen."
etiquetas: [lógica, pila booleana, constante]
estado: revisada
---
<!-- 20-VM §6.5 (false), §5.2 (AddupCond), §4 (gate de stores; store salteado no hace pops); comprobado en el port -->

`false` apila un _falso_ en la pila booleana, sin mirar nada.

Tiene un uso práctico muy cómodo: **apagar un gen** sin borrarlo. Como el
`start` hace el _y_ de todas las condiciones, un `false` entre `cond` y `start`
hace que el cuerpo no corra nunca, sean como sean las demás:

```adn
' gen apagado mientras probás otra cosa
cond
  false
  *.nrg 1000 >
start
  10 .up store
stop

cond
start
  50 inc
stop
```

El primer gen no hace nada; el segundo corre igual, porque su `cond` empieza
con la pila booleana limpia. Para volver a encenderlo, borrá el `false`.

Dentro del cuerpo, un `false` frena todos los stores que vengan después, hasta
que algo lo saque o lo tape ([[op:dropbool]], [[op:clearbool]], [[op:true]] u
otra condición).

:::cuidado
Un store frenado no saca nada de la pila entera: su valor y su dirección
quedan ahí y los puede encontrar el próximo store que sí corra. Lo explica
[[adn/condiciones#dos-trampas]].
:::

Lo opuesto es [[op:true]].
