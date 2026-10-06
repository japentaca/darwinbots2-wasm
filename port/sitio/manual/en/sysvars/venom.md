---
titulo: .venom
resumen: "How much venom the bot has: the ammunition for -3 shots, which paralyze the victim and overwrite one of its memory cells."
etiquetas: [defenses, venom, shots, senses]
estado: revisada
---
Venom is a weapon: it doesn't protect you, it is shot. With `-3` in [[.shoot]] the bot
fires part of its venom (by default one twentieth; with [[.shootval]]
you choose how much, up to what you have). When it hits a bot of another species:

- first the victim's shell ([[.shell]]) holds it back;
- whatever gets through paralyzes it for as many cycles as the strength of the hit
  ([[.paralyzed]]);
- while that lasts, every cycle the engine writes your [[.venval]] into the
  victim's [[.vloc]] cell, overwriting whatever its own DNA put there.

If it hits one of your own species, it doesn't paralyze it: it adds the venom to that bot's own supply.

<!-- 33-SHOTS §2.1 (−3: min(|shootval|, venom) o venom/20), §5 (takeven: conespecífico absorbe; shell; Paracount += power; Vloc/Vval); 21-MEMORIA §4.3 -->

The most used effect is to point `.vloc` at [[.shoot]] and put `-2` in `.venval`:
the victim starts shooting energy every cycle of the paralysis and drains
itself. That's how _Alga Toxicus_ and _A Packus Toxus_ from the Bestiary do it.

<!-- Bestiario: Alga_Toxicus.txt y A_Packus_Toxus.txt (.shoot .vloc store / -2 .venval store); comprobado con probar-adn: la víctima quieta pierde ~27 de energía por ciclo y su .paralyzed sube -->

```adn
' at birth: my venom makes the victim give away energy
cond
*.robage 0 =
start
.shoot .vloc store
-2 .venval store
stop

' charge up and shoot at whatever is in front of me
cond
*.venom 100 <
start
100 .strvenom store
stop

cond
*.eye5 0 >
*.venom 50 >
start
-3 .shoot store
stop
```

Venom can also be passed through a tie with [[.tieloc]] `-3`. The cell is
updated when making, shooting and receiving venom; writing to it changes
nothing. It is made with [[.strvenom]].

<!-- sysvars.yaml .venom (storevenom, robshoot −3, ties, takeven conespecífico) -->
