---
titulo: .tienum
resumen: "Picks, by its tie port, which tie this cycle's orders act on (.tieloc, .fixang, .fixlen, .stifftie); 0 uses the .tiepres one."
etiquetas: [ties, tie]
estado: revisada
---
If you have several ties, write here the tie port of the one you want to use: the one you set
in [[.tie]] if you created it, or its order number if you were tied. It is used by
[[.tieloc]] and [[.tieval]], [[.fixang]], [[.fixlen]] and [[.stifftie]]. With 0 the
[[.tiepres]] tie is used, except in one case: to write to the other bot's memory
(`.tieloc` positive) you need a `.tienum` other than 0.

<!-- sysvars.yaml .tienum (selector para tieportcom/Update_Ties, 0 = tiepres); 34-TIES §2, §4.3 -->

The engine sets it back to 0 every cycle after using it, so you have to write it
in the same cycle as the order. If the bot has no ties at all, the value stays
written.

<!-- sysvars.yaml .tienum (=0 cada P3; sin ties, el GoTo getout salta el reset) -->

What it does **not** pick is which tie [[.tieang]] and [[.tielen]] measure: when the engine
computes them, `.tienum` is already 0, so they always describe the `.tiepres` one.
To measure several ties there are [[.tieang1]]…`.tieang4` and [[.tielen1]]…`.tielen4`.

<!-- 10-CICLO §2 (Update_Ties en P3 antes de UpdateTieAngles en P5); port/core ties.hpp (reset de tienum al final de Update_Ties); comprobado por el redactor con probar-adn -->

```adn
' pass 100 energy through tie 7
start
7 .tienum store
-1 .tieloc store
100 .tieval store
stop
```
