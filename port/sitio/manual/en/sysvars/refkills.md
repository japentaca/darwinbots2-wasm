---
titulo: .refkills
resumen: "How many bots the bot you are looking at has killed: a way to recognize a predator."
etiquetas: [vision, refvars, predators]
estado: revisada
---
<!-- sysvars.yaml 715; README A3-5 (tope 32000 también por la vía de shots); core senses.hpp lookoccurr; sysvars.yaml 220 (kills: sube al matar por ties o por shots) -->
`.refkills` is the kill count of the bot your focus eye sees: what that
bot reads in its [[.kills]]. It goes up every time one of its shots or ties leaves
another bot without energy or without body.

A value greater than 0 says the other has already killed someone: it is a predator, or
at least a bot that shoots in earnest. It is useful for fleeing, or for going
on the defensive (see [[simulacion/defensas]]). [[.refshoot]] tells you the same thing, with
less certainty, since it only indicates whether the other _knows how_ to shoot.

In this port the count is capped at 32000. If you see nothing, it is 0.

```adn
' a killer in sight: about-face and run
cond
*.eye5 0 >
*.refkills 0 >
start
628 .aimdx store
30 .up store
stop
```
