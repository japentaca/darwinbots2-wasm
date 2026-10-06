---
titulo: .tielen2
resumen: "Length of a multicellular bot's second tie, edge to edge; writing it sets that tie's natural length."
etiquetas: [ties, multicellular]
estado: revisada
---
It works the same as [[.tielen1]], but for the bot's **second tie**, counting
from the oldest one it has left (if an earlier one breaks, this one shifts up a
slot). It only acts if the bot is multicellular ([[.multi]]) and that tie is
stiffened; otherwise, the engine doesn't touch the cell. It doesn't touch it either if [[.tienum]] and [[.tiepres]] are both 0.

When read, it gives the distance to the partner minus the two radii, measured before
the engine moves the bots. When written with [[op:store]] or another two-operand store,
it sets that tie's natural length for both ends, like
[[.fixlen]] but without picking it with [[.tienum]]. With [[op:inc]] or [[op:dec]] the tie
doesn't find out.

<!-- sysvars.yaml .tielen2 (como tielen1, tie 2); 20-VM §7 -->

```adn
' bring the second tie closer
cond
*.multi 1 =
*.tielen2 50 >
start
50 .tielen2 store
stop
```

The angle of this tie is read and set with [[.tieang2]].
