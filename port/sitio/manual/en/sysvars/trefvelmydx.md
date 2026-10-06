---
titulo: .trefvelmydx
resumen: "How much faster than you the tied bot is moving toward your right."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelmydx (vel del atado en el marco propio menos mem(198) propio); core ties.hpp ReadTRefVars -->
It is the sideways component of the tied bot's relative velocity: its velocity
projected onto _your_ rightward axis, minus your own [[.veldx]]. Positive if it
drifts away from you toward the right, negative if it drifts toward the left. [[.trefvelmysx]]
is the same with its sign flipped, and [[.trefvelmyup]] is the forward component.

```adn
' Follows the tied bot's sideways movement
cond
*.numties 0 >
start
*.trefvelmydx .dx store
stop
```

If you write a negative value to [[.dx]], the thrust goes to the left.
