---
titulo: Cuerpo, energía y estado
resumen: "Las sysvars que describen al propio bot: energía, cuerpo, masa, edad, reloj, muertes y desechos, más las órdenes para pasar energía al cuerpo y al revés."
etiquetas: [energía, cuerpo, edad, desechos, flotabilidad]
estado: revisada
---
Este grupo es el tablero del bot: lo que el motor le cuenta sobre sí mismo al final
de cada ciclo, y un par de órdenes para administrar sus reservas. Lo más leído de
todo DarwinBots está acá: casi cualquier bot tiene alguna condición sobre
[[.nrg]] o [[.body]].

<!-- 31-ENERGIA §0.3 (body↔nrg 10:1, tope 100/ciclo); §1 (muerte energética) -->
Un bot guarda su riqueza en dos monedas. La **energía** ([[.nrg]]) es la que se
gasta: cada instrucción, cada movimiento, cada disparo la consume, y si se acaba el
bot muere. El **cuerpo** ([[.body]]) es una reserva más lenta que además lo hace más
grande y más pesado ([[.mass]]). Entre las dos hay un tipo de cambio fijo de 10 a 1:
[[.strbody]] guarda 100 de energía como 10 de cuerpo, y [[.fdbody]] hace el camino
inverso. Con eso se arma una alcancía, como en este bot:

```adn
' Mantiene la energía entre 2000 y 5000 usando el cuerpo de reserva
cond
 *.nrg 5000 >
start
 100 .strbody store
stop
cond
 *.nrg 2000 <
 *.body 100 >
start
 100 .fdbody store
stop
```

<!-- sysvars.yaml .robage .timer .kills .waste .pwaste .setboy .rdboy; 31-ENERGIA §2 -->
El resto del grupo son relojes y contadores: [[.robage]] (la edad, que arranca en
0), [[.timer]] (un reloj que se hereda de padre a hijo y que podés escribir) y
[[.kills]] (a cuántos mataste). [[.waste]] y [[.pwaste]] miden los desechos, que en
exceso le corrompen la memoria al bot. [[.setboy]] y [[.rdboy]] manejan la
flotabilidad en el modo estanque.

<!-- 21-MEMORIA §0.3 (latencia de un ciclo); comprobado en el port: un bot sembrado lee .nrg, .body, .mass y .robage en 0 en su primer ciclo, y .timer con un valor al azar -->
Los sentidos de este grupo llegan con un ciclo de atraso, y un bot recién cargado
los lee en 0 en su primer ciclo (salvo [[.timer]], que arranca al azar):
`*.nrg 500 <` es verdadero ahí aunque tenga energía de sobra. Cómo se cobra y se gana la energía está en
[[simulacion/energia]]; los cambios de un ciclo al otro, en
[[sysvars/ganancias]].
