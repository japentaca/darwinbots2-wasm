---
titulo: .trefvelyourup
resumen: "The forward velocity of the tied bot, measured from its own front: a copy of its .velup."
etiquetas: [tref, ties, velocity]
estado: revisada
---
<!-- sysvars.yaml .trefvelyourup (= mem(200) del atado), .velup -->
It is the [[.velup]] of the tied bot: how much it advances relative to where _it_ points.
It doesn't depend on your orientation or on your speed. For example, it has the same value if the
other is moving toward you or away from you; what matters is that it is moving toward its own front.

The four `trefvelyour*` are copies of the other's [[sysvars/movimiento|velocities]]:
[[.trefvelyourup]], [[.trefvelyourdn]], [[.trefvelyourdx]] and
[[.trefvelyoursx]]. For the other's velocity as seen from you, use
[[.trefvelmyup]].

```adn
' If the tied bot is going in reverse, cell 50 is 1
cond
*.numties 0 >
*.trefvelyourup 0 <
start
1 50 store
stop
```
