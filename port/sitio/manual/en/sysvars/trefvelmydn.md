---
titulo: .trefvelmydn
resumen: "The relative velocity of the tied bot toward your back: it is .trefvelmyup with its sign flipped."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelmydn (= -trefvelmyup); core ties.hpp ReadTRefVars -->
It always holds the same as [[.trefvelmyup]] with the sign flipped. Positive means
that the tied bot, seen from you, is moving backward (or that you are moving forward faster
than it is). It exists so you can write more readable conditions, just like
[[.veldn]] versus [[.velup]].

```adn
' If the tied bot is falling behind, I brake to wait for it
cond
*.numties 0 >
*.trefvelmydn 5 >
start
5 .dn store
stop
```
