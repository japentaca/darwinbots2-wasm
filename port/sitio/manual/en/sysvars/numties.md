---
titulo: .numties
resumen: "How many ties the bot has right now, counting the birth tie and the ones others made to it."
etiquetas: [ties, tie, senses]
estado: revisada
---
It counts all of the bot's ties, no matter who created them: the birth tie, the
ones you made with [[.tie]] and the ones others made to you. The maximum is 9. The
engine updates it when a tie is created or deleted and every cycle when it checks
the ties; writing to it changes nothing.

<!-- sysvars.yaml .numties (Update_Ties P3, maketie, DeleteTie); 34-TIES §0.1 (máximo 9) -->

It's useful for simple decisions: tie only if you don't have a tie yet, release
other bots' ties with [[.deltie]], or find out whether you're a loose cell. A newborn
already has 1, the tie to its parent, which lasts about 100 cycles if nothing
replaces it. To find out whether you're also multicellular, check [[.multi]].

<!-- 34-TIES §0.4 (tie de nacimiento: last = 100) -->

```adn
' tie to what I see only if I have no ties
cond
*.numties 0 =
*.eye5 30 >
start
3 .tie store
stop
```
