---
titulo: pyth
resumen: "Da la hipotenusa de los dos números de arriba de la pila, la raíz de a² + b²: el largo de un vector."
etiquetas: [geometría, Pitágoras, distancia, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (pyth: Sqr(a²+b²) en Single, satura 2·10⁹); 20-VM §6.2 (dist usa pos del bot); sysvars.yaml .xpos (P5, latencia 1 ciclo); comprobado en el port -->

`a b pyth` deja la raíz cuadrada de `a² + b²`, redondeada: el teorema de
Pitágoras. `3 4 pyth` da 5. El orden no importa, y el signo tampoco.

Sirve para el largo de cualquier vector del que tengas las dos componentes.
Por ejemplo, la rapidez del bot a partir de su velocidad hacia adelante
([[.velup]]) y hacia el costado ([[.veldx]]):

```adn
cond
start
  *.velup *.veldx pyth 50 store
stop
```

(Para la rapidez en particular ya existe [[.velscalar]], que el motor
calcula por vos.)

Con diferencias de coordenadas da una distancia:
`*.refxpos *.xpos sub *.refypos *.ypos sub pyth` da casi lo mismo que
`*.refxpos *.refypos dist` en un mundo de tamaño normal, pero [[op:dist]] lo
hace en una sola palabra y usa la posición exacta del bot en ese momento, no
la de [[.xpos]] y [[.ypos]], que llega con un ciclo de atraso.
