---
titulo: .trefvelmyup
resumen: "How much faster than you the tied bot moves in the direction you are pointing."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelmyup; core ties.hpp ReadTRefVars (vel del atado proyectada sobre el aim propio menos .velup propio; misma forma que refvelup) -->
It takes the tied bot's velocity, projects it onto _your_ forward axis and subtracts
your own [[.velup]]. It is a relative velocity: positive if the other moves in your
direction faster than you do, negative if it falls behind, 0 if you are going at the same
speed. It is the same calculation that [[.refvelup]] does with the bot you see.

The four `trefvelmy*` come from two numbers: [[.trefvelmydn]] is this same one
with its sign flipped, and [[.trefvelmydx]] / [[.trefvelmysx]] do the same over the
lateral axis. If you want the other's velocity measured from its own front, use
[[.trefvelyourup]].

```adn
' If the tied bot is pulling ahead of me, I thrust to catch up
cond
*.numties 0 >
*.trefvelmyup 0 >
start
*.trefvelmyup .up store
stop
```
