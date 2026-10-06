---
titulo: .refdx
resumen: "How many times the DNA of the bot you are looking at writes to .dx: one number in its species signature."
etiquetas: [vision, refvars, signature, recognition]
estado: revisada
---
<!-- sysvars.yaml 704; core senses.hpp makeoccurrlist; probado: firma.txt (.dx inc cuenta 1) -->
It counts how many times the address of [[.dx]]
(4, thrust to the right) appears in the DNA of the bot being seen right before a write word. Any
write word counts, not just [[op:store]]: a `.dx inc` also
adds 1.

The rules are those of the whole signature (see [[.refup]]). It is compared with
[[.mydx]], and it is usually looked at together with [[.refsx]].

```adn
' can the other one sidestep and I can't? I turn around
cond
*.eye5 0 >
*.refdx 0 >
*.mydx 0 =
start
628 .aimdx store
stop
```
