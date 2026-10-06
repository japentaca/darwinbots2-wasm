---
titulo: .refmulti
resumen: "It is 1 if the bot you are looking at is part of a multibot, an organism of several cells joined by ties."
etiquetas: [vision, refvars, multibots, ties]
estado: revisada
---
<!-- sysvars.yaml 686; core senses.hpp lookoccurr (Multibot ? 1 : 0); sysvars.yaml 470 (multi) -->
`.refmulti` is 1 if the bot your focus eye sees is part of a
multibot, and 0 if it is a loose bot. The bot itself knows whether it is a multibot through its
[[.multi]].

Multibots use it to recognize other cells, and hunters, to
tell a large organism from a loose bot before taking it on (see
[[simulacion/lazos]]).

If you see nothing, or you see a shape, it is 0.

```adn
' I don't attack multibots
cond
*.eye5 0 >
*.refmulti 0 =
*.refeye *.myeye !=
start
-1 .shoot store
stop
```
