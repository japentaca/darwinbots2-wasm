---
titulo: .trefaimdx
resumen: "How many times the tied bot's DNA writes to .aimdx: part of its signature."
etiquetas: [tref, ties, signature, species]
estado: revisada
---
<!-- sysvars.yaml .trefaimdx (occurr del atado); core senses.hpp makeoccurrlist (número 1..7 seguido de un store, tipo 7; cuenta el texto del ADN) y ties.hpp ReadTRefVars -->
Counts how many times a write to [[.aimdx]] (address 5) appears in the DNA of the tied
bot: the number 5, or `.aimdx`, followed by any write word such as
[[op:store]] or [[op:inc]]. It only counts that literal form: if the DNA computes the
address, it doesn't add up. It is the other bot's [[.myaimdx]]: what it reads about
itself, read from your side of the tie.

It is a fact about the DNA, not about what happens: it counts the writes even if the
gene never runs, and it only changes if the other bot's DNA mutates. That's why it
works as part of a _signature_ for recognizing species: two bots with the same DNA
have the same counts.

```adn
' If the tied bot writes to .aimdx as many times as I do, cell 50 is 1
cond
*.numties 0 >
*.trefaimdx *.myaimdx =
start
1 50 store
stop
```

The other counts in the signature are [[.trefup]], [[.trefdn]], [[.trefsx]], [[.trefdx]], [[.trefaimsx]], [[.trefshoot]] and [[.trefeye]]; the ones for the
bot you see are the [[sysvars/ref|ref*]] sysvars, such as [[.refup]].
