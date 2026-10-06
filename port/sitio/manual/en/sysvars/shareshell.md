---
titulo: .shareshell
resumen: "In a multicellular organism, the percentage of the shell pooled with each partner that you want to keep (1 to 99)."
etiquetas: [ties, multicellular, shell, sharing]
estado: revisada
---
It works like [[.sharenrg]], but with the shell ([[.shell]]): for each tie, the
engine adds your shell and your partner's and leaves you the percentage you asked for. That way
an organism can make shell in a single cell and share it out, or
concentrate it in the cells on the edge.

The conditions are the same: only if you are multicellular ([[.multi]]), only through
the ties you created yourself with [[.tie]], and the engine clears the order every cycle.
The value is clipped to 0…99 (100 counts as 99) and a 0 does nothing. There is no cap
per cycle and no fee. The new `.shell` of both bots is published right away.

<!-- sysvars.yaml .shareshell (clamp 0..99; =0 cada P3); 34-TIES §2.1 (publica mem(823) en ambos bots) -->

```adn
' share the shell evenly with the partners
cond
*.multi 1 =
start
50 .shareshell store
stop
```
