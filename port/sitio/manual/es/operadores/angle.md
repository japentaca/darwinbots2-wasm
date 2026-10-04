---
titulo: angle
resumen: "Da el ángulo desde el bot hasta un punto x y, en las mismas unidades que .aim: listo para guardarlo en .setaim."
etiquetas: [geometría, ángulo, apuntar, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (angle: pos/Divisor, Y invertida, ×200); comprobado en el port: (1496,100) desde (1496,1107) da 314; Bestiario: 4-d_Swarmer.txt, gen «Turn to a veg»; ejemplo probado con otro bot a la vista -->

`x y angle` saca un punto (primero la `x`, arriba la `y`) y apila el ángulo
en que hay que mirar para ir desde el bot hasta ahí. El resultado está en las
unidades de [[.aim]]: de 0 a unos 1256, con 0 hacia la derecha, 314 hacia arriba,
628 hacia la izquierda y 942 hacia abajo.

Las coordenadas son las mismas que dan [[.xpos]], [[.ypos]], [[.refxpos]] y
[[.refypos]], así que el uso típico es apuntar hacia lo que se está viendo y
guardar el resultado en [[.setaim]]. Es lo que hace _4-d Swarmer_, del
Bestiario, en su gen para girar hacia las plantas; simplificado, queda así:

```adn
cond
  *.eye5 0 >
start
  *.refxpos *.refypos angle .setaim store
  10 .up store
stop
```

Con un punto fijo también sirve: `3000 2500 angle .setaim store` apunta hacia
(3000, 2500) desde donde esté el bot.

Fijate que el ángulo se calcula desde la posición _actual_ del bot, pero las
lecturas como `*.refxpos` llegan con un ciclo de atraso; si el otro se mueve
rápido, apuntás a donde estaba. Para saber cuánto falta girar desde el rumbo
actual, combinalo con [[op:anglecmp]]; para la distancia hasta el mismo
punto, [[op:dist]].
