---
titulo: .nrg
resumen: "The bot's energy, between 0 and 32000: what it spends on every action and what keeps it alive."
etiquetas: [energy, sense, death]
estado: revisada
---
It's the most-read sysvar in DarwinBots. Everything costs energy: running instructions,
moving, turning, shooting, having a body and a long DNA, reproducing. You gain it by eating
(shooting other bots, see [[simulacion/disparos]]), with chloroplasts in the sun (see
[[simulacion/cloroplastos]]) or by breaking down body with [[.fdbody]].

<!-- sysvars.yaml .nrg (WriteSenses P5, clamp 0..32000); 31-ENERGIA §0.2, §1 (muerte energética) -->
The engine publishes it at the end of the cycle, clamped between 0 and 32000. Internally, the
energy can go negative while costs are being charged, but you will never
read a negative number. When it drops below 0.5 the bot dies; if the option
[[param:opt:50]] is on, already below 15 it turns into a
corpse (see [[simulacion/muerte]]).

```adn
' With no energy to spare, stay still; with energy, move forward
cond
 *.nrg 1000 >
start
 20 .up store
stop
```

:::cuidado
A freshly loaded bot reads `.nrg` as 0 in its first cycle: the publication hasn't
happened yet. A condition like `*.nrg 500 <` is true there even if it has 3000. If the
gene does something drastic, add `*.robage 0 >` to it. A child, on the other hand, is born with its
energy already published.
:::

<!-- 31-ENERGIA §1 (Shock); port/README A1-1 (la energía pasa al cuerpo); comprobado con un disparo −1 de shootval 6000 -->
:::cuidado
A bot that isn't a vegetable and loses more than half of its energy in a single cycle,
but still ends up with more than 3000, suffers a _shock_: all the energy it had left
is turned into body (at a rate of 10 to 1) and it drops to 0, so in that
same cycle it dies or is left as a corpse. From 20000 to 8000 there is shock; from 8000 to 2000,
there isn't. It happens, for example,
with a very large energy shot ([[.shootval]] in the thousands). Spend a little at a time.
:::

What it gained or lost in the last cycle is in [[.pleas]] and [[.pain]]; the energy
of the bot in front of you is in [[.refnrg]].
