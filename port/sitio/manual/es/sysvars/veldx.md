---
titulo: .veldx
resumen: "La parte de la velocidad del bot que va de costado hacia su derecha; negativa si se desliza a la izquierda."
etiquetas: [velocidad, sentido, física, lateral]
estado: revisada
---
<!-- sysvars.yaml .veldx (UpdatePosition P3) -->
`.veldx` mide cuánto se desliza el bot de costado, en ángulo recto con [[.aim]]:
positiva hacia su derecha, negativa hacia su izquierda. Junto con [[.velup]]
describe toda la velocidad; [[.velsx]] es la misma cifra con el signo cambiado, y
[[.velscalar]] la rapidez total.

Como se mide respecto del rumbo, un giro cambia el reparto: un bot que avanza
derecho y gira un cuarto de vuelta hacia la izquierda pasa a deslizarse hacia su
derecha. La publica el motor después de mover y girar al bot; en el primer ciclo
vale 0.

Sirve para cancelar derivas laterales empujando para el lado contrario con
[[.sx]] o [[.dx]]:

```adn
' si se desliza hacia la derecha, empuja hacia la izquierda
cond
*.veldx 0 >
start
*.veldx .sx store
stop
```
