---
titulo: Its own signature (my*)
resumen: "Eleven counters that the engine derives from the bot's own DNA (how many times it moves, turns, shoots, looks…) and that are used to recognize members of the same species."
etiquetas: [species, recognition, ref, signature]
estado: revisada
---
These cells measure nothing about the world: they count things in the bot's own
DNA. [[.myup]] says how many times the DNA writes to [[.up]], [[.myeye]] how many
times it reads an eye, [[.myties]] how many times the number of [[.tie]] shows up,
and so on. Together they are a kind of signature of the genome.
<!-- sysvars.yaml .myup….myvenom; 32-VISION §4 -->

They are used by comparing them with what is seen. When a bot looks at another,
the cells of [[sysvars/ref|what it sees]] bring the same counters, but from the
other one's DNA: [[.refup]] against `.myup`, [[.refeye]] against `.myeye`,
[[.reftie]] against `.myties`. If they match, it is most likely of the same
species. By far the most used comparison in the Bestiary is
`*.refeye *.myeye !=`, "what I see is not one of mine":

```adn
' mark in cell 60 when what is ahead is of another species
cond
*.eye5 0 >
*.refeye *.myeye !=
start
1 60 store
stop
```

It is an approximate test: two different species can have the same count, and a
mutation can change a relative's. That is why many bots compare two or three
counters at once. The tutorial [[tutoriales/reconoce-especie]] develops it.

Careful with corpses: they arrive with the whole signature at 0, so against one
`*.refeye *.myeye !=` comes out true, as if it were of another species. The same
goes for an obstacle, which can be told apart because it sets [[.reftype]] to 1.
<!-- 32-VISION §2 notas (corpses: occurr borrado), lookoccurrShape (firma en 0) -->

## When they are computed {#cuando}

The engine computes them when the DNA changes: when the bot is loaded, when it is
born, when a virus adds or removes a gene and when it mutates. It does not write
them again every cycle, so the bot can overwrite them; but what others see comes
from the engine's count, not from the cell, so writing to them is no use for
disguising yourself.
<!-- sysvars.yaml .myup (borra: no), .refup (= occurr del visto); port/README.md B6-9 -->

:::nota
In the original DarwinBots a mutation during life did not redo the count: it
stayed stale until the next birth, virus or load, and that is what the data above
says. The port redoes it on the spot.
:::
