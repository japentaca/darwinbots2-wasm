---
titulo: .trefvelyourdx
resumen: "La velocidad lateral derecha del bot atado, medida desde su propio frente: una copia de su .veldx."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelyourdx (= mem(198) del atado) -->
Es el [[.veldx]] del bot atado: cuánto se desliza hacia _su_ derecha. No tiene en
cuenta hacia dónde apuntás vos; para eso está [[.trefvelmydx]]. Su opuesta es
[[.trefvelyoursx]].

```adn
' Si el atado se desliza hacia su derecha, la celda 50 vale 1
cond
*.numties 0 >
*.trefvelyourdx 0 >
start
1 50 store
stop
```
