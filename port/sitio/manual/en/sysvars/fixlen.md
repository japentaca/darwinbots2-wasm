---
titulo: .fixlen
resumen: "Command that fixes the natural length of a stiffened tie, measured edge to edge between the two bots."
etiquetas: [ties, tie, multicellular]
estado: revisada
---
Changes the rest length of the tie chosen with [[.tienum]] (or the one in
[[.tiepres]]). The number is the edge-to-edge distance you want between the two
bots; it is taken without sign and applies to both ends. From then on the tie
acts like a spring that pushes or pulls toward that length; it tolerates about
20 units of difference without exerting force, so the bots usually end up
oscillating around the value.

<!-- sysvars.yaml .fixlen (NaturalLength = Abs(valor) + radios en ambos extremos); 34-TIES §1; 30-FISICA §3.1 (muelle con zona muerta de 20); comprobado con probar-adn: con 150, .tielen oscila entre ~118 y ~164 -->

It only acts on stiffened ties of a multicellular bot ([[.multi]]). The engine
sets it back to 0 after using it, but the new length stays: writing it once is
enough. If the bot has no ties, the value stays written.

<!-- 21-MEMORIA §9.8 (reset tras el gate tienum/tiepres) -->

A very large length does not stretch the tie without limit: if the bots drift
more than 1000 apart edge to edge, the tie breaks. _Snap Tie bot_, from the
Bestiary, uses exactly that to move: it asks for a length of 10000 and the tie
snaps.

<!-- 34-TIES §1 (borrado por longitud > 1000 + radios); Bestiario: Snap_Tie_bot.txt (10000 .fixlen); comprobado con probar-adn: con 10000 los dos se separan ~80 por ciclo y el lazo se corta al pasar los 1000 -->

```adn
' once multicellular, move 150 away from the partner
cond
*.multi 1 =
start
150 .fixlen store
stop
```

[[.tielen]] shows the actual length in every cycle.
