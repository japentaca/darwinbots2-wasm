---
titulo: .deltie
resumen: "A command to break the ties that have that port; the engine clears it after using it."
etiquetas: [ties, tie]
estado: revisada
---
Write the port of the tie you want to break: the number you put in [[.tie]]
if you created it, or its sequence number if another bot tied itself to you (the one
[[.tiepres]] showed you when it formed). The tie disappears on both sides and the engine
sets the command back to 0. If you have no ties, the command stays written.

<!-- sysvars.yaml .deltie (Update_Ties P3: borra las ties cuyo puerto = mem(467); =0 al consumir); port/core ties.hpp (con numties = 0, Update_Ties sale antes del bloque de deltie) -->

It works from either end. But a 0 is not a command, and that has a consequence:
the parent sees the birth tie with port 0, so it can't break it with `.deltie`.
The child can, because for it that tie has port 1. In any case the birth tie
breaks on its own after 100 cycles.

<!-- 34-TIES §0.2, §0.4, §1 (puerto 0 del padre en el nacimiento) -->

```adn
' newborn: let go of the parent
cond
*.robage 1 =
start
1 .deltie store
stop
```

<!-- comprobado con probar-adn: al ciclo siguiente padre e hijo quedan con .numties 0 -->
