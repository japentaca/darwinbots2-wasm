---
titulo: .myeye
resumen: "How many times the bot's own DNA reads an eye (*.eye1 to *.eye9): the most-used counter for recognizing its own species."
etiquetas: [species, recognition, signature, eyes]
estado: revisada
---
A counter taken from the bot's own DNA: how many eye reads there are in the genome,
that is, how many times `*.eye1`, `*.eye2`… up to `*.eye9` appear, whether they are in
the conditions or in the body of a gene. It counts the read with an asterisk (or its
number, such as `*505`); an `.eye5` without an asterisk doesn't count, and neither does [[.eyef]],
even though it is an eye.
<!-- sysvars.yaml .myeye; makeoccurrlist: lecturas de 501..509 -->

Its partner is [[.refeye]], the same count but for the bot being looked at. It is
the preferred comparison for recognizing species, because almost all bots
read eyes and each design does it a different number of times; in the Bestiary
`*.refeye *.myeye` shows up more than any other pair. The example stores 1 in
cell 60 when what's in front of it is of another species:
<!-- sysvars.yaml .refeye; Bestiario: 1601 apariciones del par contra ≤148 de cualquier otro -->

```adn
cond
*.eye5 0 >
*.refeye *.myeye !=
start
1 60 store
stop
```

This very gene already adds one to `.myeye` (because of the `*.eye5`); the genes you add
or remove change the count, and with it the signature.

The engine computes it when the DNA changes (on load, at birth, through a virus or
a mutation; see [[sysvars/my#cuando]]), not every cycle. If the bot writes to it, its value changes
for the bot, but everyone else keeps seeing the original count. More about these
counters in [[sysvars/my]].
