---
titulo: stop
resumen: "Cierra el gen: lo que sigue hasta el próximo marcador no se ejecuta."
etiquetas: [stop, gen, flujo]
estado: revisada
---
<!-- 20-VM §5.3 (stop: CLEAR, ingene=False; no limpia la pila booleana), §4, §5.5; comprobado en el port -->

`stop` cierra el gen. Desde ahí hasta el próximo [[op:cond]], [[op:start]] o
[[op:else]], nada se ejecuta: ni los números se apilan. Es el cierre normal
de `cond … start … stop`.

En rigor no siempre hace falta: un `cond` cierra el gen anterior aunque le
falte el `stop`. Pero ponerlo deja claro dónde termina cada gen, y evita que
el código que agregues después quede adentro sin querer.

Lo que `stop` **no** hace es vaciar la [[adn/pilas|pila booleana]]. Si dentro
del cuerpo pusiste una condición en línea, su resultado sigue arriba de la
pila y frena los stores del gen siguiente si ese gen no empieza con `cond`:

```adn
' la condición del primer gen sigue mandando después del stop
start
 *.robage 5 >
 10 .up store
stop
start
 1 51 store
stop
cond
start
 1 52 store
stop
```

La celda 52 vale 1 desde el primer ciclo. La 51, en cambio, queda en 0
hasta el ciclo 7: mientras [[.robage]] no pasa de 5, el falso del primer gen
llega intacto al segundo `start` y saltea su store. El tercer gen no tiene
el problema porque su `cond` vacía la pila. Más sobre esto en
[[adn/pilas#rareza]].

Un [[op:else]] que viene después de un `stop` no corre nunca. Cada `stop`
cobra su costo de marcador en todos los ciclos, se ejecute o no el gen (ver
[[adn/ejecucion]]).
