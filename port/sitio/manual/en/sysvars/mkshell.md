---
titulo: .mkshell
resumen: "Command to make shell: each 1 of energy gives 10 of shell, up to 100 per cycle."
etiquetas: [defenses, shell, energy]
estado: revisada
---
Write how much shell you want to add this cycle. The engine makes it at the end of
the cycle, charges 1 energy for every 10 of shell and sets the command to 0, so
you have to write it again every cycle you want to keep making it. More than 100
per cycle is not possible: a 500 makes 100.

<!-- sysvars.yaml .mkshell (MakeStuff P5, ±100/ciclo, =0 al consumir); 31-ENERGIA §0.3 -->

A negative number takes shell apart, but note: taking apart also costs energy, it
does not give it back. With `-50` you lose 50 of shell and 5 of energy. The
simulation's transaction cost is also charged, which ends up as waste; in a
multicellular bot ([[.multi]]) the part you pay in energy is divided by the
number of ties plus one.

<!-- port/core robots.hpp makeshell (nrg -= |Delta|·0.1; Cost/(numties+1) si Multibot; Waste += Cost completo); 34-TIES §3 -->

If energy is 0 or less, the command is not run and is not cleared either: it
stays written until there is energy.

<!-- port/core robots.hpp makeshell (guarda nrg > 0 antes del reset de mem(822)) -->

The result is read in [[.shell]].

```adn
' keep 300 of shell when there is energy to spare
cond
*.shell 300 <
*.nrg 1000 >
start
100 .mkshell store
stop
```
