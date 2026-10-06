---
titulo: .trefvelyourdn
resumen: "The backward velocity of the tied bot, measured from its own front: a copy of its .veldn."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelyourdn (= mem(199) del atado), .veldn (= -mem(200)) -->
It is the [[.veldn]] of the tied bot, which always equals its [[.velup]] with the
sign flipped. That's why this sysvar is [[.trefvelyourup]] with its sign flipped:
positive if the other is moving backward relative to where it points.

```adn
' If the tied bot is backing up, cell 50 is 1
cond
*.numties 0 >
*.trefvelyourdn 0 >
start
1 50 store
stop
```
