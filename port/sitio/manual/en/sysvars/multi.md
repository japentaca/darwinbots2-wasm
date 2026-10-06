---
titulo: .multi
resumen: "It is 1 if the bot is multicellular (it has or had a stiffened tie and still keeps some tie); otherwise 0."
etiquetas: [ties, multicellular, senses]
estado: revisada
---
A bot becomes multicellular when one of its ties stiffens: that happens 19 cycles
after a tie created with [[.tie]], and it happens to both ends at once. The birth
tie never stiffens, so parent and child are not multicellular just for having
been born together.

<!-- sysvars.yaml .multi (regang = 1; = 0 sin ties); 34-TIES §0.4, §3; port/core ties.hpp TieHooke (corre en los dos extremos, ambos con last = −20); comprobado con probar-adn: padre e hijo pasan a 1 en el mismo ciclo -->

Being multicellular enables things: sharing with [[.sharenrg]] and its relatives,
fixing the angle and length of stiffened ties ([[.fixang]], [[.fixlen]],
[[.stifftie]], [[.tieang1]]…), and paying less to make shell and slime.

<!-- 34-TIES §2 (sharing y geometría solo multibot), §3 (costes divididos por numties+1) -->

It only goes back to 0 when the bot is left with no ties at all. If the stiffened
tie breaks but another one remains, it stays at 1.

<!-- 34-TIES §3 (False cuando numties llega a 0; no hay más escritores) -->

```adn
' once multicellular, split the energy evenly with each partner
cond
*.multi 1 =
start
50 .sharenrg store
stop
```

Remember that the splitting is only done by the bot that created the tie (see
[[.sharenrg]]).
