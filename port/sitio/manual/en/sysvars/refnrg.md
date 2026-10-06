---
titulo: .refnrg
resumen: "The energy of the bot you are looking at, from 0 to 32000: for choosing prey worth the trouble or well-fed mates."
etiquetas: [vision, refvars, energy]
estado: revisada
---
<!-- sysvars.yaml 709; 32-VISION §2 (cadáveres: refnrg/refbody reales); core senses.hpp lookoccurr; probado: mira.txt contra quieto.txt (refnrg 3000) -->
`.refnrg` is the energy of the bot your focus eye sees, rounded and clamped
between 0 and 32000. It is the same as what that bot reads in its [[.nrg]].

It is useful for deciding whether an attack is worth it: an energy shot
([[.shoot]] at −1) takes a part of what the other has, so against
an almost empty bot you gain little. Also for the opposite: _Animal Minimalis
Amorous_, from the Bestiary, only approaches to mate with a partner that has
more than 20000.

Unlike the signature ([[.refeye]] and company), a corpse does show its
real energy, just like its [[.refbody]]. If you see nothing, it is 0.

```adn
' I only shoot at what has enough energy to give me
cond
*.eye5 0 >
*.refeye *.myeye !=
*.refnrg 500 >
start
-1 .shoot store
stop
```
