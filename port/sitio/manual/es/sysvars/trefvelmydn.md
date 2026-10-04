---
titulo: .trefvelmydn
resumen: "La velocidad relativa del bot atado hacia tu espalda: es .trefvelmyup cambiada de signo."
etiquetas: [tref, lazos, velocidad]
estado: revisada
---
<!-- sysvars.yaml .trefvelmydn (= -trefvelmyup); core ties.hpp ReadTRefVars -->
Vale siempre lo mismo que [[.trefvelmyup]] con el signo cambiado. Positiva quiere
decir que el bot atado, visto desde vos, se va hacia atrás (o que vos avanzás más
rápido que él). Existe para escribir condiciones más legibles, igual que
[[.veldn]] frente a [[.velup]].

```adn
' Si el atado se queda atras, freno
cond
*.numties 0 >
*.trefvelmydn 5 >
start
5 .dn store
stop
```
