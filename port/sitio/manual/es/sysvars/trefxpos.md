---
titulo: .trefxpos
resumen: "La coordenada horizontal del bot atado, tal como él la publicó el ciclo anterior."
etiquetas: [tref, lazos, posicion]
estado: revisada
---
<!-- sysvars.yaml .trefxpos (= mem(219) del atado); 10-CICLO §2 (ADN antes de UpdateBots); atraso comprobado con probar-adn -->
Es una copia del [[.xpos]] del bot atado. Va con un ciclo más de atraso que lo que el
propio compañero lee en su `.xpos`: cuando vos leés `.trefxpos`, él ya se movió un
paso más. Con [[.trefypos]] y tu propia [[.xpos]] y [[.ypos]] sabés hacia qué lado
del mapa está.

```adn
' Guarda en la celda 50 la distancia horizontal al atado
cond
*.numties 0 >
start
*.trefxpos *.xpos sub abs 50 store
stop
```

Para saber hacia dónde apunta el otro, usá [[.trefaim]]; para la distancia a lo
largo del lazo, [[.tielen]].
