---
titulo: .aimsx
resumen: "Turns the bot to the left (counterclockwise) by the amount you write, on a scale where 1256 is a full turn."
etiquetas: [turning, command, aim]
estado: revisada
---
<!-- sysvars.yaml .aimsx; 30-FISICA §7 (Mod 1256) -->
`.aimsx` turns the bot to its left: on the screen, counterclockwise, and [[.aim]]
goes up. 314 is a quarter turn and 628 a half turn; a bot with
`.aim` 160 that writes `314 .aimsx store` ends up at 474. Values over
one turn wrap around: 2000 is the same as 744.

It is the twin of [[.aimdx]]: the engine turns by `.aimsx − .aimdx` in the same cycle,
clears both and charges energy in proportion to the angle. And the same rule applies: if
in that cycle you write to [[.setaim]] a heading different from the current one, `.setaim` wins and
the relative turn is discarded.

<!-- Bestiario: Anon_Terifica2_F1_PY_-14.04.04.txt -->
The typical use is turning a fixed amount when something happens. _Anon Terifica 2_, from the
Bestiary, turns like this every time it touches the edge:

```adn
cond
*.edge 0 !=
start
100 .aimsx store
stop
```

To turn toward a specific heading, instead of calculating the difference, it's
easier to use [[.setaim]].
