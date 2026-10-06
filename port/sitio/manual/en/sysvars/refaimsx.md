---
titulo: .refaimsx
resumen: "How many times the DNA of the bot you are looking at writes to .aimsx: one number in its species signature."
etiquetas: [vision, refvars, signature, recognition]
estado: revisada
---
<!-- sysvars.yaml 706; core senses.hpp makeoccurrlist/lookoccurr -->
It counts how many times the address of [[.aimsx]] (6, turn left) appears in the
DNA of the bot being seen, right before a write word. It is the partner of [[.refaimdx]].

The rules are those of the whole signature (see [[.refup]]): it counts what is written, not what
runs; it isn't recalculated every cycle; it is 0 if you see nothing. Your own number is
[[.myaimsx]].

```adn
' it turns just like me: it is probably my species, I keep looking
cond
*.eye5 0 >
*.refaimsx *.myaimsx =
*.refaimdx *.myaimdx =
start
314 .aimdx store
stop
```
