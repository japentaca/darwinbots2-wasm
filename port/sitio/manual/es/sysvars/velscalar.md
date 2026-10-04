---
titulo: .velscalar
resumen: "La rapidez del bot: el tamaño de su velocidad, sin importar en qué dirección va."
etiquetas: [velocidad, sentido, física]
estado: revisada
---
<!-- sysvars.yaml .velscalar (UpdatePosition P3, iceil = CInt); 30-FISICA §6 -->
`.velscalar` es el tamaño de la velocidad del bot, redondeado al entero más cercano: 0
si está quieto o casi, y como mucho [[.maxvel]]. No dice hacia dónde va; para eso están
[[.velup]], [[.veldn]], [[.veldx]] y [[.velsx]], que la descomponen respecto del
rumbo. El motor la publica después de mover al bot, así que tu ADN lee la
velocidad con que se movió en el ciclo anterior, y en el primer ciclo vale 0.

<!-- 30-FISICA §5 (borde rígido: clamp de posición, vel·0,05) -->
:::cuidado
Es la velocidad que el bot _lleva_, no la que logra. Un bot que empuja contra el
borde del mundo puede quedar clavado en la esquina y seguir leyendo
`.velscalar` 40: el borde lo frena en el lugar, pero no le borra la velocidad. Para
saber si está trabado, mirá [[.edge]] o compará [[.xpos]] y [[.depth]] entre
ciclos.
:::

Sirve para dosificar el empuje (no gastar en [[.up]] cuando ya va rápido) o para
detectar que algo lo empujó:

```adn
' solo empuja si va lento
cond
*.velscalar 10 <
start
10 .up store
stop
```
