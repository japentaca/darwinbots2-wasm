---
titulo: .trefvelyourdx
resumen: "The rightward sideways velocity of the tied bot, measured from its own front: a copy of its .veldx."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelyourdx (= mem(198) del atado) -->
It is the [[.veldx]] of the tied bot: how much it slides toward _its_ right. It doesn't
take into account where you are pointing; for that there is [[.trefvelmydx]]. Its opposite is
[[.trefvelyoursx]].

```adn
' If the tied bot slides to its right, cell 50 is 1
cond
*.numties 0 >
*.trefvelyourdx 0 >
start
1 50 store
stop
```
