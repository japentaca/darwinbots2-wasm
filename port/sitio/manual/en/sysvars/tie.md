---
titulo: .tie
resumen: "Order to tie yourself to the bot you are looking at; the number you write is the tie port you will use to name that tie."
etiquetas: [ties, tie, multicellular]
estado: revisada
---
Write a number other than 0 and at the end of the cycle the engine tries to tie you to the
bot you are looking at, the same one described by the `ref*` cells such as
[[.refeye]]. If you don't see anyone, in the first two cycles of life it uses the parent,
and otherwise, the last bot that touched you. It has to be a bot (not an obstacle) and be
close: about 400 edge to edge at most. The order is always cleared, whether it works or not.

<!-- sysvars.yaml .tie (FireTies P5; =0 siempre que era ≠ 0); 34-TIES §1 (lastopp a ≤ 4·RobSize + radios, fallback padre/lasttch; maketie exige length ≤ 1.5·c) -->

The number is the _tie port_: the name you will use later to pick that tie in
[[.tienum]], [[.deltie]] or [[.readtie]], and it ends up in your [[.tiepres]]. The other bot
doesn't see your number: for it the tie is named by its order number (1 if it is the
first one it has).

<!-- 34-TIES §0.2 (Port = mem(tie) para el creador; slot para el receptor) -->

What you need to know:

- Each attempt with someone in range costs energy (the simulation's tie
  cost, divided by the number of ties you already have plus one), whether it works or not.
- If the other bot has slime ([[.slime]]), the tie can fail; with more than 92 it always
  fails. Each attempt takes 20 slime from it.
- Tying the same bot twice replaces the previous tie. That is why a child that
  ties itself to its parent overwrites the birth tie.
- After 19 cycles the tie stiffens and both bots become multicellular
  ([[.multi]]).
- A bot has at most 9 ties. A tie breaks on its own if the bots move apart
  more than 1000 edge to edge.

<!-- 34-TIES §0.1 (máximo 9), §0.3 (DeleteTie antes de crear), §0.4, §0.5 (deflect, slime −20, TIECOST/(numties+1)), §1 (borrado por longitud > 1000 + radios) -->

```adn
' newborn: tie to the parent with tie port 7
cond
*.robage 1 =
start
7 .tie store
stop
```

<!-- comprobado con probar-adn: el hijo queda con .tiepres 7, el padre con 1, y a los ~20 ciclos los dos tienen .multi 1 -->
