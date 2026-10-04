---
titulo: .trefvelyourdn
resumen: "La velocidad hacia atrás del bot atado, medida desde su propio frente: una copia de su .veldn."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelyourdn (= mem(199) del atado), .veldn (= -mem(200)) -->
Es el [[.veldn]] del bot atado, que siempre vale lo mismo que su [[.velup]] con el
signo cambiado. Por eso esta sysvar es [[.trefvelyourup]] cambiada de signo:
positiva si el otro retrocede respecto de hacia donde apunta.

```adn
' Si el atado retrocede, la celda 50 vale 1
cond
*.numties 0 >
*.trefvelyourdn 0 >
start
1 50 store
stop
```
