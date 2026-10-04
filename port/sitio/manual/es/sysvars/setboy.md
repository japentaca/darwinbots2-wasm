---
titulo: .setboy
resumen: "Sube o baja la flotabilidad del bot, que en el modo estanque con gravedad decide a qué altura se queda."
etiquetas: [flotabilidad, estanque, gravedad, acción]
estado: revisada
---
<!-- sysvars.yaml .setboy .rdboy (ManageBouyancy P5: += valor/32000, clamp 0..1) -->
La flotabilidad es un número entre 0 y 1 que el bot lleva consigo. `.setboy` la
cambia: lo que escribas se divide por 32000 y se suma a la que ya tenía, así que
`8000 .setboy store` sube un cuarto y `-8000 .setboy store` la baja un cuarto. El
resultado nunca sale del rango de 0 a 1. Se aplica en el mismo ciclo y el motor
borra la orden. El valor nuevo se lee en [[.rdboy]].

<!-- 31-ENERGIA §1 (flotabilidad en pondmode: costo ∝ min(masa,192)·Bouyancy); 36-REPRO §2 (Bouyancy heredada) -->
Solo tiene efecto con la opción [[param:opt:30]] activada, gravedad
([[param:opt:20]]) y el campo sin conexión entre el borde de arriba y el
de abajo. En ese caso la flotabilidad marca una altura, medida desde el fondo como
fracción del alto del campo: si el bot está más arriba, la gravedad lo hunde; si
está más abajo, lo empuja hacia arriba. Con flotabilidad 0 se va al fondo, y con 1
sube hasta arriba. Mantener una flotabilidad mayor que 0 cuesta energía cada ciclo,
proporcional a ella y a la masa del bot (la masa cuenta hasta 192).

```adn
' Busca flotar a media altura
cond
 *.rdboy 16000 <
start
 1000 .setboy store
stop
```

<!-- comprobado: .rdboy sube de a 1000 y se queda en 16000 -->
En 16 ciclos este bot llega a una flotabilidad de 16000 y se detiene. Los hijos
heredan la flotabilidad del padre, aunque su [[.rdboy]] arranca en 0 (ver esa
página). Más sobre la física en [[simulacion/fisica]].
