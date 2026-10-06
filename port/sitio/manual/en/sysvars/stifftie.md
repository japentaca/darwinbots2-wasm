---
titulo: .stifftie
resumen: "Order to change the stiffness of a stiffened tie, from 1 (soft) to 100 (very stiff)."
etiquetas: [ties, tie, multicellular, physics]
estado: revisada
---
It adjusts how strongly the tie chosen with [[.tienum]] (or the one from [[.tiepres]])
returns to its length and how much it damps oscillations. It applies to both ends
and stays until you change it; the engine clears the order after using it.

The scale goes from 1 to 100. The engine takes the remainder of dividing by 100; if
that remainder is 0 (as with 200), it counts as 100, and a negative counts as 1. Writing 0 is not
an order. So 150 is 50 and 100 is the maximum.
For reference, a freshly stiffened tie is equivalent to 20, and a soft, newly
made one to 4.

<!-- sysvars.yaml .stifftie (Mod 100 in place, 0 → 100, < 0 → 1; b/k de ambos lados); 34-TIES §1 (k = 0.01/b = 0.02 al crear, k = 0.05/b = 0.1 hueso); port/core ties.hpp (b = 0.005·v, k = 0.0025·v) -->

It only acts on stiffened ties of a multicellular bot ([[.multi]]). If the bot
has no ties, the value stays written.

<!-- 21-MEMORIA §9.8 (reset tras el gate tienum/tiepres) -->

```adn
' very stiff ties for a compact organism
cond
*.multi 1 =
start
100 .stifftie store
stop
```

The length is adjusted with [[.fixlen]] and the angle with [[.fixang]].
