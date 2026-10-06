---
titulo: .setaim
resumen: "Turns the bot to an absolute heading: you write which way you want it to point and the engine puts it there in the same cycle."
etiquetas: [turning, command, heading, aim]
estado: revisada
---
<!-- sysvars.yaml .setaim; 30-FISICA §7 -->
`.setaim` is the absolute turn: you write the heading you want, on the same scale as
[[.aim]] (0 to the right of the screen, 314 up, 1256 a full turn), and the bot
ends the cycle pointing there, however big the turn. Any
number works: its remainder when divided by 1256 is taken, so -314 is 942 and 1570
is 314. The turn costs energy, but the cost depends not on the angle swept but on the number
you wrote: `1200 .setaim` costs much more than `-56 .setaim`, even though both
leave the same heading (see [[simulacion/fisica#giro]]).

The engine doesn't clear it to 0: after turning the bot, it copies the current heading into it. That is why
`*.setaim` can always be read as the bot's heading, and in the first cycle of
life it is more reliable than `*.aim`, which still reads 0.

:::cuidado
What decides is whether the value _differs_ from the current heading. If you write a
different heading, `.setaim` wins and whatever you put in [[.aimsx]] and [[.aimdx]] that cycle is
ignored. If you write exactly the current heading, `.setaim` does nothing and
`.aimsx` and `.aimdx` do apply. A gene that always writes `314 .setaim store` and another
that writes `50 .aimsx store` make the bot oscillate between 314 and 364.
:::

The classic use is to turn relative to the current heading by adding something to it, or to aim at
what it sees by combining [[.refxpos]] and [[.refypos]] with its own position. This bot turns by
100 per cycle, reading the heading from `.setaim` itself:

```adn
cond
start
*.setaim 100 add .setaim store
stop
```
