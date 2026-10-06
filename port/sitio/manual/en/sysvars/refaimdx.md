---
titulo: .refaimdx
resumen: "How many times the DNA of the bot you are looking at writes to .aimdx: one number in its species signature."
etiquetas: [vision, refvars, signature, recognition]
estado: revisada
---
<!-- sysvars.yaml 705; core senses.hpp makeoccurrlist/lookoccurr -->
It counts how many times the address of [[.aimdx]] (5, turn right) appears in the
DNA of the bot being seen, right before a write word.
Almost every bot that looks for food turns, so it is usually 1 or more; a vegetable
that doesn't move usually has 0.

The rules are those of the whole signature (see [[.refup]]). Your own number is
[[.myaimdx]], and the one for the opposite turn is [[.refaimsx]].

```adn
' what can't turn is probably a vegetable: time to eat
cond
*.eye5 0 >
*.refaimdx 0 =
*.refaimsx 0 =
start
-1 .shoot store
stop
```
