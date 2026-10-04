---
titulo: dist
resumen: "Da la distancia en línea recta desde el bot hasta un punto x y."
etiquetas: [geometría, distancia, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (dist: multiplica por Divisor, unidades de mundo; asimetría con angle); comprobado en el port, también en campo 64000×48000 -->

`x y dist` saca un punto (la `x` abajo, la `y` arriba) y apila la distancia
desde el bot hasta él. `*.refxpos *.refypos dist` es la distancia hasta lo
que está viendo; con [[op:angle]] sobre el mismo punto se sabe además hacia
dónde queda.

Este bot anota dónde estaba al empezar ([[.xpos]] y [[.ypos]] en las celdas
50 y 51) y, cada vez que se aleja más de 300 de ese lugar, vuelve a apuntar
hacia allá:

```adn
cond
  *.robage 1 =
start
  *.xpos 50 store
  *.ypos 51 store
stop

cond
  *.robage 1 >
  *50 *51 dist 300 >
start
  *50 *51 angle .setaim store
stop

cond
start
  10 .up store
stop
```

La posición se anota con [[.robage]] en 1 y no en 0 porque en el primer
ciclo `*.xpos` todavía vale 0.

:::nota
En un mundo de más de 32000 de ancho o de alto, las posiciones que leés en
`.xpos` y `.ypos` vienen achicadas para entrar en la memoria, pero `dist`
devuelve la distancia en el tamaño real del mundo. En un mundo de 64000 de
ancho, un punto 1000 unidades a la derecha según `.xpos` da una distancia de
2000. En los mundos de tamaño normal las dos escalas coinciden.
:::
