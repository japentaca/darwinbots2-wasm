---
titulo: .veldn
resumen: "La velocidad del bot hacia atrás: es .velup con el signo cambiado."
etiquetas: [velocidad, sentido, física]
estado: revisada
---
<!-- sysvars.yaml .veldn = −.velup -->
`.veldn` es exactamente [[.velup]] con el signo cambiado: positiva cuando el bot se
mueve marcha atrás respecto de su rumbo y negativa cuando avanza. No agrega
información; existe para que las condiciones se lean más naturales, como
"si retrocede" en lugar de "si la velocidad hacia adelante es negativa".

La publica el motor después de mover y girar al bot, y vale 0 en el primer ciclo.

```adn
' si va marcha atrás, empuja hacia adelante para compensar
cond
*.veldn 0 >
start
*.veldn .up store
stop
```
