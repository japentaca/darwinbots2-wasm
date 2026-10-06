---
titulo: .refage
resumen: "The age in cycles of the bot you are looking at, up to 32000: for recognizing newborns."
etiquetas: [vision, refvars, age]
estado: revisada
---
<!-- sysvars.yaml 710; core senses.hpp lookoccurr (age con tope 32000); probado: mira.txt contra quieto.txt -->
`.refage` is the age of the bot your focus eye sees, in cycles, capped at
32000. It is the same count that bot reads in its [[.robage]].

The typical use is not attacking newborns, which are almost always your own
children or a neighbor's: a newborn bot sits right next to its parent and is easy to
mistake for prey. Combined with the signature ([[.refeye]]), it is also useful
for the opposite: looking for a mate only among the adults of your species.

If you see nothing, it is 0, so a condition like `*.refage 50 <` is also
met with nothing in sight: always combine it with an eye ([[.eye5]]).

```adn
' I don't touch a newborn: I keep going
cond
*.eye5 0 >
*.refage 50 <
start
314 .aimdx store
stop
```
