---
titulo: .refsx
resumen: "How many times the DNA of the bot you are looking at writes to .sx: one number in its species signature."
etiquetas: [vision, refvars, signature, recognition]
estado: revisada
---
<!-- sysvars.yaml 703; core senses.hpp makeoccurrlist/lookoccurr -->
It counts how many times the address of [[.sx]]
(3, thrust to the left) appears in the DNA of the bot being seen right before a write word. It is
one of the signature numbers; the rules are those of [[.refup]]: what is written is counted,
not what runs, it isn't recalculated every cycle, and it is 0 if there is nothing in
sight.

Your own number is [[.mysx]]. Combined with [[.refdx]] it tells you whether the other
has sideways movement in its repertoire, something typical of bots that
dodge.

```adn
cond
*.eye5 0 >
*.refsx *.mysx !=
*.refdx *.mydx != or
start
-1 .shoot store
stop
```
