---
titulo: .trefaim
resumen: "Where the tied bot is pointing: a copy of its .aim."
etiquetas: [tref, ties, orientation]
estado: revisada
---
<!-- sysvars.yaml .trefaim (= mem(18) del atado), .aim; core ties.hpp ReadTRefVars; atraso comprobado con probar-adn -->
It is the [[.aim]] of the tied bot: its absolute orientation, from 0 to 1255 (a full
turn is 1256). Like the position, it runs one cycle behind what the partner reads
about itself. With [[.setaim]] you can copy it to point the same way it does,
which is useful for getting a tied group to move in the same direction.

In this example only the child copies its parent's heading (the tied bot older than it is,
as in [[.trefage]]):

```adn
' Points where the tied bot points, if it is my parent
cond
*.numties 0 >
*.trefage *.robage >
start
*.trefaim .setaim store
stop
```

When the parent changes heading, the child's `.aim` catches up two cycles later:
one because `.trefaim` arrives late and another because the turn from [[.setaim]] only shows up in
`.aim` the following cycle.

:::cuidado
If both ends of the tie copy the other's heading, neither turns on its own: they
just keep copying each other. Even worse with a newborn, whose `.aim` is 0 in its first
cycle (see [[.aim]]): the parent reads that 0 and starts pointing to the right of the
screen. Have only one of them copy.
:::

For the angle of the tie itself, use [[.tieang]].
