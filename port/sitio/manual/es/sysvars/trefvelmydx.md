---
titulo: .trefvelmydx
resumen: "Cuánto más rápido que vos se desplaza el bot atado hacia tu derecha."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelmydx (vel del atado en el marco propio menos mem(198) propio); core ties.hpp ReadTRefVars -->
Es la componente lateral de la velocidad relativa del bot atado: su velocidad
proyectada sobre _tu_ eje hacia la derecha, menos tu propia [[.veldx]]. Positiva si
se te va hacia la derecha, negativa si se te va hacia la izquierda. [[.trefvelmysx]]
es la misma cambiada de signo, y [[.trefvelmyup]] es la componente hacia adelante.

```adn
' Acompaña el desplazamiento lateral del atado
cond
*.numties 0 >
start
*.trefvelmydx .dx store
stop
```

Si escribís un valor negativo en [[.dx]], el empuje va hacia la izquierda.
