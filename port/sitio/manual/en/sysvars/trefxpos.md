---
titulo: .trefxpos
resumen: "The horizontal coordinate of the tied bot, as it published it the previous cycle."
etiquetas: [tref, ties, position]
estado: revisada
---
<!-- sysvars.yaml .trefxpos (= mem(219) del atado); 10-CICLO §2 (ADN antes de UpdateBots); atraso comprobado con probar-adn -->
It is a copy of the tied bot's [[.xpos]]. It runs one cycle further behind than what the
partner itself reads in its `.xpos`: when you read `.trefxpos`, it has already moved one
more step. With [[.trefypos]] and your own [[.xpos]] and [[.ypos]] you know which side
of the map it is on.

```adn
' Stores in cell 50 the horizontal distance to the tied bot
cond
*.numties 0 >
start
*.trefxpos *.xpos sub abs 50 store
stop
```

To know where the other is pointing, use [[.trefaim]]; for the distance along the
tie, [[.tielen]].
