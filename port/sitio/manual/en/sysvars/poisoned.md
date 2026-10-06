---
titulo: .poisoned
resumen: "How many cycles of poisoning the bot has left; 0 if it isn't poisoned."
etiquetas: [defenses, poison, senses]
estado: revisada
---
You get poisoned when you attack a poisonous bot of another species: you fired a
`-1` or a memory shot at it, or you tried to suck energy or body from it through a tie,
and its [[.poison]] was enough to send it back to you. The engine adds poisoning
cycles and subtracts them one per cycle; this cell shows how many
are left.

<!-- sysvars.yaml .poisoned (Poisons P1 = Int(Poisoncount)); 33-SHOTS §5 (takepoison: Poisoncount += power/1.5); 34-TIES §2 (retaliación por poison en −1/−6) -->

While it is greater than 0, in every cycle the engine writes the poisonous bot's [[.pval]]
into your [[.ploc]] cell (both belong to whoever poisoned you), after your DNA
runs. Other than that you function normally.

<!-- 21-MEMORIA §4.3, §6; 10-CICLO §2 P1 -->

The typical use is to stop attacking whoever poisons you: if you bite it again, more
cycles are added.

```adn
' bite only if I'm not poisoned
cond
*.eye5 0 >
*.poisoned 0 =
start
-1 .shoot store
stop
```

The venom counterpart is [[.paralyzed]].
