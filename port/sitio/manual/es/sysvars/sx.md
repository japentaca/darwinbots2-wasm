---
titulo: .sx
resumen: "Empuja al bot de costado hacia su izquierda, sin cambiar hacia dónde apunta."
etiquetas: [movimiento, empuje, orden, lateral]
estado: revisada
---
<!-- sysvars.yaml .sx; 30-FISICA §2.1; probado: con .aim 0, 10 .sx sube 6,6 por ciclo y .velsx da 7 -->
`.sx` empuja al bot hacia su izquierda, en ángulo recto con [[.aim]], sin girarlo.
Un bot que mira hacia la derecha de la pantalla (`.aim` 0) se desplaza hacia
arriba. Su opuesta es [[.dx]]: el motor calcula `.sx − .dx` y empuja con la
diferencia, así que un valor negativo en `.sx` empuja hacia la derecha.

Como [[.up]], es una aceleración que el motor aplica en el mismo ciclo y borra; se
suma a la velocidad que traía, comparte el tope de [[.maxvel]] y cuesta lo mismo
por unidad. Si escribís a la vez `.up` y `.sx`, el bot sale en diagonal.

El movimiento lateral sirve para esquivar sin dejar de mirar al blanco, o para
girar alrededor de algo mientras se le apunta. La velocidad de costado se lee en
[[.velsx]] y [[.veldx]].

```adn
' mientras ve algo, se corre hacia la izquierda sin dejar de mirarlo
cond
*.eye5 0 >
start
15 .sx store
stop
```
