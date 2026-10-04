---
titulo: .velup
resumen: "La parte de la velocidad del bot que va hacia adelante, en la dirección en que apunta; negativa si retrocede."
etiquetas: [velocidad, sentido, física]
estado: revisada
---
<!-- sysvars.yaml .velup (alias .vel, UpdatePosition P3) -->
`.velup` (también se escribe `.vel`) dice cuánto avanza el bot en la dirección de
[[.aim]]: positiva si va hacia adelante, negativa si va marcha atrás. La parte de
costado está en [[.veldx]] y la rapidez total en [[.velscalar]]. [[.veldn]] es la
misma cifra con el signo cambiado.

El motor la publica después de mover y girar al bot, así que se mide respecto del
rumbo _nuevo_. Si el bot gira sin cambiar su velocidad, el mismo movimiento pasa
de `.velup` a `.veldx`: un bot que va a 40 hacia adelante y gira un cuarto de
vuelta lee `.velup` 0 y la velocidad entera de costado. En el primer ciclo de vida
vale 0.

Su uso más claro es frenar: empujar en contra de la propia velocidad.

```adn
' frena: empuja en contra de su velocidad, de frente y de costado
cond
*.velscalar 0 >
start
*.velup .dn store
*.veldx .sx store
stop
```

<!-- 30-FISICA §2.1; probado: de 40 a 14, 4, 2 y 0 -->
Como el empujón efectivo es un poco menor que el número escrito, el bot no se
para de golpe: pierde unos dos tercios de su velocidad por ciclo y en unos cuatro
ciclos lee 0. Las sysvars de velocidad se redondean al entero más cercano, así que
puede quedarle una deriva de menos de medio punto por ciclo que ya no se ve.
