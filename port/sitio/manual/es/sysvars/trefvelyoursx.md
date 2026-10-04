---
titulo: .trefvelyoursx
resumen: "La velocidad lateral izquierda del bot atado, medida desde su propio frente: una copia de su .velsx."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelyoursx (= mem(197) del atado), .velsx (= -mem(198)) -->
Es el [[.velsx]] del bot atado, que siempre vale su [[.veldx]] con el signo cambiado.
Así que esta sysvar es [[.trefvelyourdx]] cambiada de signo: positiva si el otro se
desliza hacia _su_ izquierda.

```adn
' Si el atado se desliza hacia su izquierda, la celda 50 vale 1
cond
*.numties 0 >
*.trefvelyoursx 0 >
start
1 50 store
stop
```
