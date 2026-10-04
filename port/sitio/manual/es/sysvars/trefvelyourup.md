---
titulo: .trefvelyourup
resumen: "La velocidad hacia adelante del bot atado, medida desde su propio frente: una copia de su .velup."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelyourup (= mem(200) del atado), .velup -->
Es el [[.velup]] del bot atado: cuánto avanza respecto de hacia donde _él_ apunta.
No depende de tu orientación ni de tu velocidad. Por ejemplo, vale lo mismo si el
otro avanza hacia vos o se aleja; lo que importa es que se mueve hacia su frente.

Las cuatro `trefvelyour*` son copias de las [[sysvars/movimiento|velocidades]]
del otro: [[.trefvelyourup]], [[.trefvelyourdn]], [[.trefvelyourdx]] y
[[.trefvelyoursx]]. Para la velocidad del otro vista desde vos, usá
[[.trefvelmyup]].

```adn
' Si el atado va marcha atras, la celda 50 vale 1
cond
*.numties 0 >
*.trefvelyourup 0 <
start
1 50 store
stop
```
