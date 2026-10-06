---
titulo: .trefvelyoursx
resumen: "The leftward sideways velocity of the tied bot, measured from its own front: a copy of its .velsx."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelyoursx (= mem(197) del atado), .velsx (= -mem(198)) -->
It is the [[.velsx]] of the tied bot, which always equals its [[.veldx]] with the sign
flipped. So this sysvar is [[.trefvelyourdx]] with its sign flipped: positive if the
other slides toward _its_ left.

```adn
' If the tied bot slides to its left, cell 50 is 1
cond
*.numties 0 >
*.trefvelyoursx 0 >
start
1 50 store
stop
```
