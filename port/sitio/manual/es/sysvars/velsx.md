---
titulo: .velsx
resumen: "La velocidad de costado del bot hacia su izquierda: es .veldx con el signo cambiado."
etiquetas: [velocidad, sentido, física, lateral]
estado: revisada
---
<!-- sysvars.yaml .velsx = −.veldx -->
`.velsx` es [[.veldx]] con el signo cambiado: positiva cuando el bot se desliza
hacia su izquierda y negativa cuando va hacia su derecha. Como con [[.veldn]], no
agrega información, pero hace más legibles las condiciones del lado izquierdo.

Se mide respecto del rumbo ([[.aim]]) después del movimiento y el giro del ciclo, y
vale 0 en el primer ciclo de vida.

No hay que confundirla con [[.refvelsx]], que mide lo mismo pero del bot que
estás mirando.

```adn
' si se desliza hacia la izquierda, empuja hacia la derecha
cond
*.velsx 0 >
start
*.velsx .dx store
stop
```
