---
titulo: .tielen1
resumen: "Length of a multicellular bot's first tie, edge to edge; writing it sets that tie's natural length."
etiquetas: [ties, multicellular]
estado: revisada
---
It is a read-write cell for the bot's **first tie** (the oldest one it
has left; if one breaks, the following ones shift up a slot), and it only works if the
bot is multicellular ([[.multi]]) and that tie is stiffened.

<!-- sysvars.yaml .tielen1 (bidi: TieLenOverwrite → NaturalLength = valor + radios en ambos extremos; P3 publica CInt(dist − radios)) -->

**Reading.** Every cycle the engine publishes the distance to the partner minus
the two radii. It is measured before the bots are moved, so it can differ a little
from [[.tielen]].

**Writing.** A value written with [[op:store]] (or with another two-operand
store) becomes the natural length of the tie, edge to edge, for both
ends, just like [[.fixlen]] but without picking the tie with [[.tienum]]. Unlike
`.fixlen`, here the sign counts: a negative asks the bots to
overlap. Afterwards the engine writes the measurement back into the cell. With
[[op:inc]] or [[op:dec]] the tie doesn't find out (see [[adn/stores]]).

<!-- port/core ties.hpp Update_Ties (sin Abs, a diferencia de fixlen); 20-VM §7 -->

If the bot isn't multicellular or the first tie isn't stiffened, the engine doesn't touch
the cell. It doesn't touch it either if [[.tienum]] and [[.tiepres]] are both 0.

```adn
' keep the first tie at 150
cond
*.multi 1 =
start
150 .tielen1 store
stop
```

With a child tied to its parent, once the tie is stiffened the distance goes from almost
0 to about 150: it overshoots at first and then ends up oscillating between about
115 and 175. The angle of the same tie is [[.tieang1]].

<!-- comprobado con probar-adn: hijo atado al padre con 150 .tielen1 store; .tielen1 llega a 215 y después oscila entre 116 y 174 -->
