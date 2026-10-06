---
titulo: .vloc
resumen: "The memory cell that your venom will overwrite in the victim on every cycle of the paralysis."
etiquetas: [defenses, venom, memory, configuration]
estado: revisada
---
It is configuration: you write it once and the engine reads it every time you shoot
venom (`-3` in [[.shoot]]) or pass it through a tie ([[.tieloc]] `-3`). The engine
never clears it. Together with [[.venval]] it decides what happens to the victim: while it is
paralyzed, the engine writes `.venval` into its `.vloc` cell every cycle, after
its DNA runs, so the victim can't correct it.

<!-- sysvars.yaml .vloc (newshot copia mem(835); ties); 21-MEMORIA §3 (persistente), §4.3 (Poisons P1 cada ciclo); 10-CICLO §2 P1 -->

The most used targets are commands the victim doesn't want to carry out: [[.shoot]]
with `-2` (gives away energy), [[.up]] (moves forward), [[.aimdx]] (turns).

Three details:

- A value outside 1…1000 is brought into that range the same way as a memory
  address (1050 is 50).
- With 0 or a negative, each hit picks a random cell.
- Cell 340 ([[.delgene]]) is protected: if you aim there, nothing happens.

<!-- 21-MEMORIA §6 ((memloc−1) Mod 1000 + 1; 340 → mem(0); ≤ 0 → Random(1,1000) sin 340) -->

Since a newborn's memory starts at 0, each child has to set it again; otherwise
its venom hits random cells.

```adn
' at birth: the venom makes the victim move forward
cond
*.robage 0 =
start
.up .vloc store
40 .venval store
stop
```
