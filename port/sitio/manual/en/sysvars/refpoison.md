---
titulo: .refpoison
resumen: "How much defensive poison the bot you are looking at has stored: shooting at it can send poison back at you."
etiquetas: [vision, refvars, defenses, poison]
estado: revisada
---
<!-- sysvars.yaml 713 (mem 827 del visto: poison actual); 33-SHOTS §3, §5 (-1 releasenrg y shots de memoria: rebote -5 si hay poison); core senses.hpp lookoccurr -->
`.refpoison` is the _poison_ reserve of the bot your focus eye sees: what
that bot reads in its [[.poison]]. It goes from 0 to 32000. It is what it has stored, not
what it is making.

Poison is a passive defense. If you hit a bot that has more poison than the power of your shot
with an energy shot ([[.shoot]] at −1), a poison shot comes back at you
instead of energy and poisons you. Something similar happens with shots that write memory. Looking at `.refpoison` before attacking avoids that trap; the
details are in [[simulacion/defensas]].

Its partner is [[.refvenom]]. If you see nothing, it is 0.

```adn
' I don't shoot at the poisonous ones
cond
*.eye5 0 >
*.refeye *.myeye !=
*.refpoison 0 =
start
-1 .shoot store
stop
```
