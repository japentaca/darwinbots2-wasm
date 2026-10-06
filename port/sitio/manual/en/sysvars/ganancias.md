---
titulo: Gains and losses
resumen: "How much energy and how much body the bot gained or lost in the last cycle: pain, pleasure and their body equivalents."
etiquetas: [energy, body, pain, pleasure]
estado: revisada
---
<!-- sysvars.yaml .pain .pleas .bodloss .bodgain (WriteSenses P5); 10-CICLO §5 -->
These four sysvars measure the change from one cycle to the next. [[.pain]] is
how much energy the bot lost and [[.pleas]] how much it gained; [[.bodloss]] and
[[.bodgain]] do the same for the body ([[.body]]). In fact they are two numbers,
each with both signs: `.pleas` is always `.pain` with the sign flipped, and
`.bodgain` is `.bodloss` with the sign flipped. If the bot lost 100 energy,
`.pain` is 100 and `.pleas` is −100.

The engine computes them at the end of every cycle by comparing with the end of
the previous cycle, so they measure the _net_ change of everything that
happened in between: what the DNA spent, moving, shooting, what it ate, what was
stolen from it, what it converted between energy and body. They do not give the
cause; for that you have to cross them with other senses, such as the shot
received in [[.shflav]] or the collision in [[.hit]].

The most common use is reacting to an attack: a sudden jump in `.pain` almost
always means someone is taking energy from it. This bot runs forward if in the
last cycle it lost more than 50:

```adn
cond
*.pain 50 >
start
40 .up store
stop
```

Giving birth is the exception: the energy the bot hands to a child does not
count as a loss, but the body it gives up does show up in `.bodloss`.

`.pleas` is for the opposite, for example to stay still while it is eating. The
full energy balance is in [[simulacion/energia]].
