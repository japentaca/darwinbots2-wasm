---
titulo: .trefvelmyup
resumen: "Cuánto más rápido que vos avanza el bot atado en la dirección en que apuntás."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelmyup; core ties.hpp ReadTRefVars (vel del atado proyectada sobre el aim propio menos .velup propio; misma forma que refvelup) -->
Toma la velocidad del bot atado, la proyecta sobre _tu_ eje hacia adelante y le resta
tu propia [[.velup]]. Es una velocidad relativa: positiva si el otro avanza en tu
dirección más rápido que vos, negativa si se queda atrás, 0 si van parejos. Es la
misma cuenta que hace [[.refvelup]] con el bot que ves.

Las cuatro `trefvelmy*` salen de dos números: [[.trefvelmydn]] es esta misma
cambiada de signo, y [[.trefvelmydx]] / [[.trefvelmysx]] hacen lo mismo sobre el eje
lateral. Si querés la velocidad del otro medida desde su propio frente, usá
[[.trefvelyourup]].

```adn
' Si el atado me saca ventaja hacia adelante, empujo para alcanzarlo
cond
*.numties 0 >
*.trefvelmyup 0 >
start
*.trefvelmyup .up store
stop
```
