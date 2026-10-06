---
titulo: .trefvelmysx
resumen: "The relative velocity of the tied bot toward your left: it is .trefvelmydx with its sign flipped."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelmysx; core ties.hpp ReadTRefVars (trefvelmysx = -trefvelmydx) -->
It always holds the same as [[.trefvelmydx]] with the sign flipped: positive if the tied
bot drifts away from you toward the left. It's useful for pairing it with [[.sx]] without having to
flip the sign by hand.

```adn
' If the tied bot drifts to my left, I follow it
cond
*.numties 0 >
*.trefvelmysx 0 >
start
*.trefvelmysx .sx store
stop
```

The forward component is in [[.trefvelmyup]].
