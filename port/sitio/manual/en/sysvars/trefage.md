---
titulo: .trefage
resumen: "The age of the tied bot: tells you whether your parent or your child is on the other side."
etiquetas: [tref, ties, age, reproduction]
estado: revisada
---
<!-- sysvars.yaml .trefage (= age+1 del atado, tope 32000); 34-TIES §1-§2 (el creador carga al crear; gate newage >= 2); comprobado con probar-adn -->
It holds the age of the tied bot, the same one it reads in its [[.robage]] in that cycle
(capped at 32000). Its classic use is telling relatives apart: after
reproducing, parent and child are joined by the birth tie, and
`*.trefage *.robage >` is true only on the child's side.

```adn
' If the tied bot is older than I am (my parent), I break the tie
cond
*.numties 0 >
*.trefage *.robage >
start
*.tiepres .deltie store
stop
```

Mind the timing: the child starts to feel its parent in its fourth cycle
of life, and until then `.trefage` is 0, so the condition is false.
The parent, on the other hand, feels it from the cycle after the birth: it already reads that the
tied bot has age 1, even though the child still reads 0 in its `.robage` (see
[[sysvars/tref#que-lazo]]). From the next cycle on, the two numbers match.
