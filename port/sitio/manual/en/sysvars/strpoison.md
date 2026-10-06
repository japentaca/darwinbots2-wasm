---
titulo: .strpoison
resumen: "Order to make poison: every 1 energy gives 4 poison, up to 100 per cycle. Also called .mkpoison."
etiquetas: [defenses, poison, energy]
estado: revisada
---
Write how much poison you want to add this cycle; `.mkpoison` is another name for
the same cell. The engine makes it at the end of the cycle, charges 1 energy for
every 4 poison and sets the order to 0. The cap is 100 per cycle, which is 25
energy. It is four times cheaper than the venom from [[.strvenom]], an asymmetry
that comes from the original DarwinBots.

<!-- sysvars.yaml .strpoison (alias mkpoison; MakeStuff P5, ±100/ciclo); 31-ENERGIA §0.3 y §4.2 (venom 1:1 contra poison 4:1) -->

As with [[.mkshell]], a negative value takes poison apart but charges energy anyway,
a transaction cost that goes to waste is added, and with energy at 0 or less the
order stays written without being carried out.

<!-- port/core robots.hpp storepoison (nrg -= |Delta|·0.25; Waste += Cost; guarda nrg > 0) -->

Poison evaporates 2% per cycle, so a reserve is maintained by topping it up.
The result is read in [[.poison]].

<!-- 31-ENERGIA §1 (poison ×0.98 en P1) -->

```adn
' keep about 500 poison
cond
*.poison 500 <
start
100 .strpoison store
stop
```
