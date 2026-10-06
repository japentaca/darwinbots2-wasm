---
titulo: .tiepres
resumen: "The tie port of the last tie that formed (created by you or by another bot toward you): the tie the orders use when .tienum is 0."
etiquetas: [ties, tie, senses]
estado: revisada
---
The engine writes it every time a tie you take part in forms. If you
created it with [[.tie]], it is the number you put there; if you were tied, it is the
order number the tie has among yours (1 if it is the first). When the
tie it pointed to is deleted, it moves to the previous tie in your list (the one that formed
earlier); if the deleted one was the oldest, it ends up at 0 even if you have others left.

<!-- sysvars.yaml .tiepres (maketie = puerto de la última tie; DeleteTie lo repara); port/core ties.hpp DeleteTie (k > 1 ? Ties(k−1).Port : 0) -->

It is the “default” tie: [[.tieang]] and [[.tielen]] always describe this one, and the
orders that depend on [[.tienum]] use it when `.tienum` is 0.

Two oddities:

- At birth, the parent sees the birth tie with tie port 0, so its
  `.tiepres` ends up at 0 and for it it is as if it had no tie selected. The child,
  on the other hand, sees it with tie port 1 and can use it.
- The engine only rewrites it when a tie is created or deleted. If you write it
  yourself, the value stays: it is a way of changing which tie `.tieang` and
  `.tielen` measure.

<!-- 34-TIES §1 (nacimiento: Port = 0), §4.3; port/core ties.hpp UpdateTieAngles (lee mem(454) si tienum = 0); comprobado por el redactor con probar-adn: 99 .tiepres deja .tielen en 0 -->

```adn
' always talk to the last one that tied me or that I tied
cond
*.tiepres 0 !=
start
*.tiepres .tienum store
60 .tieloc store
*.nrg .tieval store
stop
```

This example writes your energy to cell 60 of the other bot. You need to copy
`.tiepres` into `.tienum` because writing to the other bot's memory requires a `.tienum`
other than 0 (see [[.tieloc]]).
