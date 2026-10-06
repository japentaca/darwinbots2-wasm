---
titulo: .ploc
resumen: "The memory cell that your poison will overwrite, every cycle, in whoever gets poisoned by attacking you."
etiquetas: [defenses, poison, memory, configuration]
estado: revisada
---
It is the defensive version of [[.vloc]]. When someone gets poisoned by your poison
(it bit you with an energy shot, threw a memory shot at you or tried to
suck from you through a tie; see [[.poison]]), the engine takes your `.ploc` and your [[.pval]] at
the moment the poison goes out toward it and, for as long as the poisoning lasts,
writes `.pval` into the attacker's `.ploc` cell every cycle.

<!-- sysvars.yaml .ploc (al devolver poison; createshot y ties); 33-SHOTS §2.3 (memloc = mem(834) del emisor) -->

It is configuration: the engine doesn't clear it. The rules for the address are the same
as in `.vloc`: a value outside 1…1000 is wrapped into the range, 0 or negative picks a
random cell, and cell 340 ([[.delgene]]) is protected. A child is born with 0, so
it's a good idea to set it at birth.

<!-- 21-MEMORIA §3 (ploc persistente), §6 ((v−1) Mod 1000 + 1; 340 → mem(0); ≤ 0 → aleatoria) -->

Many Bestiary bots point it at [[.shoot]] (for example _A Packus Toxus_ and
_Alga Toxicus_): the poisoned bot shoots whatever `.pval` says.

```adn
' at birth: whoever bites me stops pushing
cond
*.robage 0 =
start
.up .ploc store
0 .pval store
stop

' and have poison so the punishment works
cond
*.poison 500 <
start
100 .strpoison store
stop
```

The value is written into the attacker after its DNA runs and before the
engine reads its movement commands, so its `.up` stays at 0 even if it asks for it.

<!-- 10-CICLO §2 P1 (Poisons antes de NetForces/VoluntaryForces) -->
