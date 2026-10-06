---
titulo: .myties
resumen: "How many times the number of .tie (330) appears in the bot's own DNA, however it is used: part of the signature for recognizing its own species."
etiquetas: [species, recognition, signature, ties]
estado: revisada
---
A counter taken from the bot's own DNA: how many times the number 330 appears, which is
the address of [[.tie]]. Unlike [[.myup]] and its siblings, it doesn't need
to be followed by a store: it counts any appearance, whether `.tie` or
`330` written by hand, as an address or as a value. A `*.tie` (with an asterisk),
on the other hand, doesn't count.
<!-- sysvars.yaml .myties (literales 330), .reftie; makeoccurrlist -->

Its partner is [[.reftie]], the same count but for the DNA of the bot being
looked at. It's usually good for telling bots that build ties from those that don't, or
as a second check besides [[.myeye]]:

```adn
' of my own kind according to two counters: mark 1 in cell 60
cond
*.eye5 0 >
*.refeye *.myeye =
*.reftie *.myties =
start
1 60 store
stop
```

The engine computes it when the DNA changes (on load, at birth, through a virus or
a mutation; see [[sysvars/my#cuando]]), not every cycle. If the bot writes to it, its value changes
for the bot, but everyone else keeps seeing the original count. More about these
counters in [[sysvars/my]].
