---
titulo: .paralyzed
resumen: "How many cycles of venom paralysis the bot has left; 0 if it isn't paralyzed."
etiquetas: [defenses, venom, senses]
estado: revisada
---
When a bot of another species hits you with venom, or when someone passes it to you through a tie
([[.tieloc]] `-3`), the engine adds paralysis cycles and subtracts them one
per cycle; this cell shows how many are left. While it is greater than 0, in every
cycle the engine writes into one of your cells the value the attacker chose (its
[[.venval]] into your cell [[.vloc]]), _after_ your DNA runs. Other than that
your bot works normally: it runs its DNA, moves and shoots.

<!-- sysvars.yaml .paralyzed (Poisons P1 = Int(Paracount)); 33-SHOTS §5 (takeven: Paracount += power); port/core ties.hpp tie_transfers −3 (paraliza sin mirar la especie); port/core robots.hpp Poisons (único efecto: mem(Vloc) = Vval) -->

You can't directly know which cell is being overwritten, but you can defend yourself:
making a shell ([[.mkshell]]) stops the next hits, and if you know which command
your enemy tends to attack with, you can compensate for it. Some Bestiary bots, such as
_Saber_, simply don't attack while they are paralyzed or poisoned.

<!-- 33-SHOTS §5 (shell absorbe el venom); Bestiario: 1_3.txt (Saber, *.poisoned 0 = y *.paralyzed 0 = en sus ataques) -->

```adn
' while I'm being paralyzed, armor up
cond
*.paralyzed 0 >
start
100 .mkshell store
stop
```

The poison counterpart is [[.poisoned]].
