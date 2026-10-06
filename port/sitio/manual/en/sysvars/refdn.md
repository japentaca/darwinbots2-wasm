---
titulo: .refdn
resumen: "How many times the DNA of the bot you are looking at writes to .dn: one number in its species signature."
etiquetas: [vision, refvars, signature, recognition]
estado: revisada
---
<!-- sysvars.yaml 702; core senses.hpp makeoccurrlist/lookoccurr; Bestiario: 151 de 684 bots escriben en .dn -->
Another number in the signature of the bot your focus eye sees: how many times
the address of [[.dn]] (2) appears in its DNA right before a write word.
It works the same as [[.refup]]: it counts what is written even if it never
runs, it isn't recalculated every cycle, and it is 0 if you see nothing or if what you see
is a corpse.

Few bots go backward (in the Bestiary, one in four writes to
`.dn`), so for most it is 0. That makes it useful as an
extra piece of data: if your species uses `.dn` and the other doesn't, it isn't one of your own. It is
compared with your own number, [[.mydn]].

```adn
cond
*.eye5 0 >
*.refdn *.mydn !=
start
-1 .shoot store
stop
```
