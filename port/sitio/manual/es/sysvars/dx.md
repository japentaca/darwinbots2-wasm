---
titulo: .dx
resumen: "Empuja al bot de costado hacia su derecha, sin cambiar hacia dónde apunta."
etiquetas: [movimiento, empuje, orden, lateral]
estado: revisada
---
<!-- sysvars.yaml .dx; 30-FISICA §2.1 -->
`.dx` es la gemela de [[.sx]]: empuja al bot hacia su derecha, en ángulo recto con
[[.aim]], sin girarlo. Un bot que mira hacia la derecha de la pantalla (`.aim` 0)
se desplaza hacia abajo. El motor calcula `.sx − .dx`, así que un `.dx` negativo
empuja hacia la izquierda y escribir lo mismo en las dos se anula.

Funciona como [[.up]]: el motor la aplica en el mismo ciclo y la deja en 0, el
empujón se suma a la velocidad que traía el bot y comparte el tope de [[.maxvel]].
La velocidad lateral resultante se lee en [[.veldx]].

Un uso típico es compensar una deriva: si el bot se está yendo de costado, empujar
para el otro lado.

```adn
' corrige la deriva lateral: si se va a la izquierda, empuja a la derecha
cond
*.velsx 0 >
start
*.velsx .dx store
stop
```
