---
titulo: .trefup
resumen: "How many times the tied bot's DNA writes to .up: part of its signature."
etiquetas: [tref, ties, signature, species]
estado: revisada
---
<!-- sysvars.yaml .trefup (occurr del atado); core senses.hpp makeoccurrlist (número 1..7 seguido de un store, tipo 7; cuenta el texto del ADN) y ties.hpp ReadTRefVars -->
Counts how many times a write to [[.up]] (address 1) appears in the DNA of the tied
bot: the number 1, or `.up`, followed by any write word such as
[[op:store]] or [[op:inc]]. It only counts that literal form: if the DNA computes the
address, it doesn't add up. It is the other bot's [[.myup]]: what it reads about
itself, read from your side of the tie.

It is a fact about the DNA, not about what happens: it counts the writes even if the
gene never runs, and it only changes if the other bot's DNA mutates. That's why it
works as part of a _signature_ for recognizing species: two bots with the same DNA
have the same counts. A high value says the other bot has many forward-thrust commands in its DNA.

```adn
' If the tied bot has no genes for moving forward, cell 50 is 1
cond
*.numties 0 >
*.trefup 0 =
start
1 50 store
stop
```

The other counts in the signature are [[.trefdn]], [[.trefsx]], [[.trefdx]], [[.trefaimdx]], [[.trefaimsx]], [[.trefshoot]] and [[.trefeye]]; the ones for the
bot you see are the [[sysvars/ref|ref*]] sysvars, such as [[.refup]].
