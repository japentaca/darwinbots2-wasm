---
titulo: Address 0
resumen: "An internal cell that the DNA can neither read nor write: the engine uses it to deflect venom and poison attacks aimed at .delgene."
etiquetas: [memory, venom, poison, delgene]
estado: revisada
---
<!-- 21-MEMORIA §6 (mem(0): nunca se lee, no alcanzable desde el ADN); 20-VM §0.6, §7 (0 al leer → 1000; store a 0 no-op sin costo) -->
Internally, a bot's memory has one more cell than the 1000 the DNA sees: cell 0.
Your DNA cannot reach it. When reading, 0 falls onto 1000 (`*0` reads cell 1000),
and a store to address 0 does nothing and charges no energy (see
[[adn/numeros#cero]] and [[adn/stores]]).

<!-- 21-MEMORIA §6 (Vloc/Ploc = (memloc-1) Mod 1000 + 1; 340 → 0; Poisons P1 escribe cada ciclo), §4.3 -->
Only the engine uses it, as protection. When a bot paralyzes you with venom, its
[[.vloc]] chooses in which of your cells the effect is written; when you poison
yourself with another's poison by attacking it, it is its [[.ploc]]. While the
effect lasts, the engine writes to that cell every cycle. If the cell is 340
([[.delgene]], the one that deletes genes), the engine swaps it for 0: the blow
ends up in this cell and deletes no one's genes. Nobody reads what is left there.

In practice, it does not exist for you: you cannot use it as a variable, and
whatever the engine leaves in it does not affect your bot. What does matter is
the consequence: a `.vloc` or a `.ploc` at 340 deletes no one's genes. Chemical
defenses are covered in [[simulacion/defensas]].
