---
titulo: .slime
resumen: "How much slime the bot has: it prevents the bot from being tied and stops viruses; it evaporates 2% per cycle."
etiquetas: [defenses, slime, ties, viruses, senses]
estado: revisada
---
Slime protects against two things that another bot can do to you:

- **Ties.** Every time someone tries to tie you with [[.tie]], the engine draws a
  number between 2 and 92; if your slime is greater, the tie doesn't form. With more than 92
  no tie can catch you. Each attempt, whether it succeeds or not, takes 20 slime from you.
- **Viruses.** A virus shot first has to get through the slime. If its strength
  isn't enough, the slime absorbs it (and is used up); if it gets through, it leaves the slime at
  0 and the virus infects anyway. Viruses are covered in [[sysvars/adn-y-virus]].

<!-- 34-TIES §0.5 (deflect = Random(2,92), slime −20 por intento); 33-SHOTS §5 (−7 addgene); port/core shots.hpp addgene (la potencia sobrante no se usa al insertar) -->

The engine publishes it every cycle after evaporating 2%, so the value
goes down on its own even if you do nothing. It is made with [[.mkslime]] and in a
multicellular organism it is shared with [[.shareslime]].

<!-- sysvars.yaml .slime (Upkeep P1 = CInt(slime·0.98)) -->

Note that slime also stops you from receiving friendly ties: a child can't
tie with `.tie` to a parent that has more than 92 slime, and every attempt
eats 20 slime from the parent. The tie that parent and child are born with does form,
because the one receiving that tie is the child, which is born without slime.

<!-- 34-TIES §1 (nacimiento vía maketie con el hijo como receptor); port/core robots.hpp Reproduce (maketie(padre, hijo, …)); comprobado con probar-adn: padre con 396 de slime, el .tie del hijo falla y el padre pierde 20 -->

```adn
' top up slime only if it dropped below 100
cond
*.slime 100 <
start
20 .mkslime store
stop
```
