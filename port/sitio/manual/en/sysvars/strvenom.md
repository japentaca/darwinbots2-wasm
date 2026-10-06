---
titulo: .strvenom
resumen: "Order to make venom: every 1 energy gives 1 venom, up to 100 per cycle. Also called .mkvenom."
etiquetas: [defenses, venom, energy, shots]
estado: revisada
---
Write how much venom you want to add this cycle; `.mkvenom` is another name for
the same cell. The engine makes it at the end of the cycle, charges 1 energy for
every 1 venom (it is the most expensive of the four substances) and sets the order to 0. The
cap is 100 per cycle.

<!-- sysvars.yaml .strvenom (alias mkvenom; MakeStuff P5, ±100/ciclo, =0 al consumir); 31-ENERGIA §0.3 (1 nrg = 1 venom) -->

As with [[.mkshell]], a negative value takes venom apart but charges energy anyway,
a transaction cost that goes to waste is added, and with energy at 0 or less
the order stays written without being carried out. Unlike shell and slime, here
being multicellular doesn't make anything cheaper.

<!-- port/core robots.hpp storevenom (sin división por numties; guarda nrg > 0) -->

Venom doesn't wear off on its own: it stays in [[.venom]] until you fire it with `-3` in
[[.shoot]] or pass it through a tie with [[.tieloc]].

```adn
' always keep 100 venom ready to fire
cond
*.venom 100 <
*.nrg 500 >
start
100 .strvenom store
stop
```
