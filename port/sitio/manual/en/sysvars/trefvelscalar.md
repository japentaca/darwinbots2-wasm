---
titulo: .trefvelscalar
resumen: "The speed of the tied bot, without direction: a copy of its .velscalar."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelscalar (= mem(196) del atado), .velscalar -->
It is the [[.velscalar]] of the tied bot: how fast it moves, regardless of where it
is heading. It is not a relative velocity: yours isn't subtracted from it and it doesn't
depend on where you point. It arrives with the same delay as [[.trefxpos]], one cycle
behind what the partner reads about itself.

It's useful for knowing whether the other end of the tie is still or on the move. To know
where it is heading relative to you, use [[.trefvelmyup]] and [[.trefvelmydx]].

```adn
' If the tied bot is still, cell 50 is 1
cond
*.numties 0 >
*.trefvelscalar 0 =
start
1 50 store
stop
```
