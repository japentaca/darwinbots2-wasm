---
titulo: .poison
resumen: "How much poison the bot has: it punishes whoever bites it with an energy shot or steals from it through a tie; it evaporates 2% per cycle."
etiquetas: [defenses, poison, shots, ties, senses]
estado: revisada
---
Poison is a passive defense: it isn't shot, it acts when you are attacked.

- **Energy shots.** If a `-1` from [[.shoot]] hits you and your poison exceeds the
  strength of the hit, you don't lose energy: the engine sends a poison shot back at the
  attacker and takes poison off you.
- **Memory shots.** A shot that tries to write to your memory (positive
  type) doesn't write if your poison is enough to stop it: it also bounces back as poison.
- **Ties.** If a bot of another species sucks energy or body from you through a tie
  ([[.tieloc]] `-1` or `-6`) and you have enough poison, instead of eating it
  gets poisoned.

Shots that steal body (`-6`) aren't stopped by poison: for those there is
[[.shell]].

<!-- 33-SHOTS §3.4 (tipo positivo: bloqueo por poison con rebote −5), §5 (releasenrg: poison > power → rebote −5; releasebod sin poison); 34-TIES §2 (−1/−6 con retaliación por poison) -->

Whoever gets poisoned is marked in its [[.poisoned]] and, for as long as it lasts, the engine
writes your [[.pval]] into its [[.ploc]] cell every cycle. Those two cells are
yours, the poisonous bot's.

<!-- 21-MEMORIA §4.3, §6; 33-SHOTS §2.3 (createshot lleva ploc y pval del emisor del rebote) -->

Poison evaporates 2% per cycle and the engine publishes the new value every
cycle. It is made with [[.strpoison]]. It doesn't poison one of your own species: if
a shot of your poison reaches it, it adds it to its own.

<!-- 31-ENERGIA §1 (poison ×0.98); 33-SHOTS §5 (takepoison: conespecífico absorbe) -->

```adn
' whoever bites me will spin without stopping
cond
*.robage 0 =
start
.aimdx .ploc store
50 .pval store
stop

cond
*.poison 500 <
start
100 .strpoison store
stop
```

With this bot, an attacker that shoots it a `-1` ends up spinning 50 per cycle for
as long as the poison lasts.

<!-- comprobado con probar-adn: un mordedor que dispara −1 pasa a .poisoned > 500 y su .aim baja 50 por ciclo -->
