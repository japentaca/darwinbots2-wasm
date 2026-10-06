---
titulo: .pain
resumen: "How much energy the bot lost in the last cycle; negative if it gained."
etiquetas: [energy, pain, sense]
estado: revisada
---
<!-- sysvars.yaml .pain (WriteSenses P5, onrg y nrg acotados a 0..32000); 10-CICLO §5 -->
`.pain` is the energy the bot had at the end of the previous cycle minus what it
has at the end of this one: positive if it lost, negative if it gained. It is the net change,
so it accounts for everything: what its own DNA costs, moving and shooting, what other bots'
shots take from it, what it eats and what it turns into body. [[.pleas]] is the
same number with the sign flipped.

<!-- probado: parto con pain 0; inserto lee pain −3000 en robage 1 -->
The engine publishes it at the end of each cycle; your DNA reads what happened in the
previous cycle. A few oddities:

- A bot placed in the simulation at the start (not born from another) reads in its second
  cycle a negative `.pain` equal to all its energy: as far as the engine is concerned, it came from 0.
- The energy the bot gives a child when reproducing doesn't count as a loss.
- Turning energy into body with [[.strbody]] does count: `100 .strbody store`
  gives a `.pain` of 100.

<!-- 10-CICLO §5 (Shock); corrección A1-1 del port: la energía pasa a cuerpo -->
:::cuidado
If a bot (that isn't a vegetable) loses more than half of its energy in a single cycle
and still has more than 3000 left, it dies of shock: its energy goes to 0 and what
it had left is turned into body, at a rate of 10 energy to 1 body.
`.pain` never gets to warn it.
:::

This bot turns to look around when something takes energy from it:

```adn
cond
*.pain 30 >
start
314 .aimsx store
stop
```
