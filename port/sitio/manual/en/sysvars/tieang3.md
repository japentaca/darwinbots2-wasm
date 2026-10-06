---
titulo: .tieang3
resumen: "Angle of a multicellular bot's third tie relative to the way the bot points (0 to 1256); writing it sets that angle."
etiquetas: [ties, multicellular, angle]
estado: revisada
---
It works the same as [[.tieang1]], but for the bot's **third tie**, counting
from the oldest one it has left (if an earlier one breaks, this one shifts up a
slot). It only acts if the bot is multicellular ([[.multi]]) and that tie is
stiffened; otherwise, the engine doesn't touch the cell. It doesn't touch it either if [[.tienum]] and [[.tiepres]] are both 0.

When read, it gives the direction of the partner as seen from the bot, from 0 to 1256, measured
before the engine moves the bots. When written with [[op:store]] or another
two-operand store, it sets that tie's angle as [[.fixang]] would, without
picking it with [[.tienum]]. With [[op:inc]] or [[op:dec]] the tie doesn't find out.

<!-- sysvars.yaml .tieang3 (como tieang1, tie 3); 20-VM §7 -->

```adn
' set the third tie to a quarter turn
cond
*.multi 1 =
start
314 .tieang3 store
stop
```

The length of this tie is read and set with [[.tielen3]].
