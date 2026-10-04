---
titulo: .trefvelscalar
resumen: "La rapidez del bot atado, sin dirección: una copia de su .velscalar."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelscalar (= mem(196) del atado), .velscalar -->
Es el [[.velscalar]] del bot atado: qué tan rápido se mueve, sin importar hacia
dónde. No es una velocidad relativa: no se le resta la tuya ni depende de adónde
apuntes. Llega con el mismo atraso que [[.trefxpos]], un ciclo detrás de lo que el
compañero lee de sí mismo.

Sirve para saber si el otro extremo del lazo está quieto o en marcha. Para saber
hacia dónde va respecto de vos, usá [[.trefvelmyup]] y [[.trefvelmydx]].

```adn
' Si el atado esta quieto, la celda 50 vale 1
cond
*.numties 0 >
*.trefvelscalar 0 =
start
1 50 store
stop
```
