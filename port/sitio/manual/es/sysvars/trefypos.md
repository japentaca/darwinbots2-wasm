---
titulo: .trefypos
resumen: "La coordenada vertical del bot atado, tal como él la publicó el ciclo anterior."
etiquetas: [tref, lazos, posicion]
estado: revisada
---
<!-- sysvars.yaml .trefypos (= mem(217) del atado), .ypos -->
Es una copia del [[.ypos]] (o `.depth`) del bot atado, con el mismo atraso que
[[.trefxpos]]: un ciclo más viejo que lo que el compañero lee de sí mismo. Como en
`.ypos`, los valores crecen hacia abajo del mapa.

```adn
' Si el atado esta mas abajo que yo, la celda 50 vale 1
cond
*.numties 0 >
*.trefypos *.ypos >
start
1 50 store
stop
```

Junto con [[.trefxpos]] te da la posición completa del otro extremo del lazo.
