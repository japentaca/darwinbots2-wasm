---
titulo: .trefvelmysx
resumen: "La velocidad relativa del bot atado hacia tu izquierda: es .trefvelmydx cambiada de signo."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelmysx; core ties.hpp ReadTRefVars (trefvelmysx = -trefvelmydx) -->
Vale siempre lo mismo que [[.trefvelmydx]] con el signo cambiado: positiva si el bot
atado se te va hacia la izquierda. Sirve para emparejarla con [[.sx]] sin tener que
cambiar el signo a mano.

```adn
' Si el atado se va hacia mi izquierda, lo sigo
cond
*.numties 0 >
*.trefvelmysx 0 >
start
*.trefvelmysx .sx store
stop
```

La componente hacia adelante está en [[.trefvelmyup]].
