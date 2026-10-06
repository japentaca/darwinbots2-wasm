---
titulo: .refvenom
resumen: "How much attack venom the bot you are looking at has stored: with it, that bot can paralyze you."
etiquetas: [vision, refvars, defenses, venom]
estado: revisada
---
<!-- sysvars.yaml 714 (mem 825 del visto); 33-SHOTS §5 (-3 takeven: Paracount, Vloc/Vval); 21-MEMORIA §4.3 (mem(Vloc)=Vval cada ciclo mientras dure); core senses.hpp lookoccurr -->
`.refvenom` is the _venom_ reserve of the bot your focus eye sees: what that
bot reads in its own [[.venom]]. It goes from 0 to 32000.

Venom is a weapon: you fire it with [[.shoot]] set to −3, and it paralyzes
whoever takes the hit. For a while, the victim sees one of its memory cells
overwritten every cycle with the value the attacker chose. A bot with a high `.refvenom` can do that to you; one with 0
can't (at least not until it makes some). The details are in
[[simulacion/defensas]].

Its counterpart is [[.refpoison]], the defensive poison. If you don't see anything, it is 0.

```adn
' someone armed with venom: I back away
cond
*.eye5 0 >
*.refvenom 100 >
*.refeye *.myeye !=
start
628 .aimdx store
stop
```
