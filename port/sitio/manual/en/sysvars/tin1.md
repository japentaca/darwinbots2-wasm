---
titulo: .tin1
resumen: "First tie input channel: the value that the bot at the other end of the tie you're reading publishes in its .tout1."
etiquetas: [communication, ties, tin, tout]
estado: revisada
---
`.tin1` brings in whatever the bot tied to you has written in its [[.tout1]]. The
engine updates it every cycle, after your DNA runs, so what you read is what the
other bot had published the previous cycle.
<!-- sysvars.yaml .tin1; 34-TIES §2 (readtie → ReadTRefVars en P1, después del ADN) -->

It reads **one tie at a time**: the one you choose with [[.readtie]] (by its number) or, if
`.readtie` is 0, the most recently created tie, whose number is in [[.tiepres]]. All
the tie inputs (`.tin1` to `.tin10` and the [[sysvars/tref|tref*]] senses)
come from that same tie. To listen to a different partner, change `.readtie`.
<!-- 34-TIES §2 (readtie: tie readtie o, si vale 0, tiepres; ReadTRefVars carga trefvars y tin juntos) -->

Unlike [[.in1]], it isn't cleared after your DNA runs: the engine reloads it every
cycle for as long as the tie exists. It goes back to 0 when you run out of ties or when you have
none with the number that `.readtie` asks for. A newborn receives nothing through the
tie while its [[.robage]] is 0, 1 or 2: during that time `.tin1` is 0 even if the parent
is already publishing. The value arrives as is: the random ±1 that shows up in the data sheet
above comes from an evolution mode of the original program that this port doesn't
include.
<!-- sysvars.yaml .tin1 (borra: EraseTRefVars si no hay ties o el puerto no existe); 34-TIES §2 (newage ≥ 2); el port no implementa el fudge (capa evo, 32-VISION §4); comprobado con probar-adn: el hijo ve 0 con robage 0 a 2 -->

One possible use: have a bot warn through the tie about what it sees, so the other one
finds out even when it's looking the other way.

```adn
' everyone publishes through the tie what they have in front of them
start
*.eye5 .tout1 store
stop

' if the one next to me sees something and I don't, I save the alert in 50
cond
*.tin1 0 >
*.eye5 0 =
start
*.tin1 50 store
stop
```

There are ten identical channels, from `.tin1` to [[.tin10]]; see
[[sysvars/entradas-salidas]].
