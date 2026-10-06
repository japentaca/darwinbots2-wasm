---
titulo: Defenses
resumen: "The four substances a bot makes with its energy (shell, slime, venom and poison) and the cells that decide what they do to whoever attacks you."
etiquetas: [defenses, shell, slime, venom, poison]
estado: revisada
---
A bot can spend energy to make four substances. Each one has a command to
make it and a cell where the engine publishes how much you have:

| Substance | Made with | Read in | Per 1 of energy | Cap per cycle | Decays on its own |
|---|---|---|---|---|---|
| Shell | [[.mkshell]] | [[.shell]] | 10 | 100 | no |
| Slime | [[.mkslime]] | [[.slime]] | 10 | 200 | 2% per cycle |
| Venom | [[.strvenom]] | [[.venom]] | 1 | 100 | no |
| Poison | [[.strpoison]] | [[.poison]] | 4 | 100 | 2% per cycle |

<!-- 31-ENERGIA §0.3 (1 nrg = 10 shell = 10 slime = 1 venom = 4 poison; topes 100/200/100/100), §1 (slime y poison ×0.98 en P1) -->

The four serve different purposes. _Shell_ stops the shots that steal
body and the venom ones, but makes the bot heavier. _Slime_ keeps other
bots from tying to you, and it stops viruses. _Venom_ is ammunition: it is shot with
`-3` in [[.shoot]] and paralyzes. _Poison_ is a passive defense: whoever hits you
with an energy shot receives poison instead of food.

<!-- 33-SHOTS §5 (takeven, releasenrg, releasebod: shell absorbe −3 y −6; poison rebota −1); 34-TIES §0.5 (slime deflecta lazos); 30-FISICA/CalcMass (shell/200 en la masa) -->

What venom and poison do to the victim is up to you, through four configuration
cells: [[.vloc]] and [[.venval]] (which cell of the victim of your venom gets
overwritten and with what value) and [[.ploc]] and [[.pval]] (the same for whoever is
poisoned by your poison). The victim sees in [[.paralyzed]] and [[.poisoned]] how many
cycles it has left.

<!-- 21-MEMORIA §4.3, §6 (Vloc/Vval y Ploc/Pval); sysvars.yaml .paralyzed .poisoned -->

Making a substance costs the energy in the table plus a transaction cost set by the
simulation, which ends up converted into waste ([[.waste]]). A negative value in
the command dismantles the substance, but returns no energy: it is charged too.

<!-- 31-ENERGIA §0.3 y §1 (coste de transacción a Waste); port/core robots.hpp makeshell/storevenom (nrg -= |Delta|·tasa) -->

A common recipe in the Bestiary, for example in _Alga Toxicus_: at birth, set
`.vloc`, `.venval` and `.ploc`; then, load venom and poison when there is
energy to spare and shoot venom every cycle while turning at random. The complete
mechanism is covered in
[[simulacion/defensas]].
