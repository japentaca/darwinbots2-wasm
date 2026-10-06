---
titulo: .body
resumen: "The bot's body, between 0 and 32000: a reserve worth 10 energy per point that sets its size and its weight."
etiquetas: [body, sense, reserve, size]
estado: revisada
---
<!-- 31-ENERGIA §0.3, §1, §3; 36-REPRO §2 (guarda body < 5, reparto por per) -->
Body is the bot's second currency. Each point is worth 10 of energy: you
load it with [[.strbody]] and spend it with [[.fdbody]]. In the meantime it isn't used
to pay for anything, but it has effects:

- **Size and weight.** More body means a bigger bot (easier to see and
  to hit) and a heavier one (see [[.mass]]).
- **Upkeep.** If the simulation charges for body, holding it costs energy
  every cycle (see [[simulacion/energia]]).
- **Life.** If body drops below 0.5, the bot dies even if it has energy.
- **Reproduction.** When reproducing, the child takes its percentage of the body (see
  [[.repro]]); with very little body there is no birth.

<!-- sysvars.yaml .body (ManageBody P5); comprobado: sembrado e hijo la leen en 0 en su primer ciclo -->
The engine publishes it at the end of the cycle, between 0 and 32000. In its first cycle of life
a bot reads it as 0, whether you loaded it or it was just born: don't use it alone
to decide anything serious in that cycle.

```adn
' Reproduces only when it has body to spare
cond
 *.body 2000 >
start
 50 .repro store
stop
```

What it gained or lost in body in the last cycle is in [[.bodgain]] and
[[.bodloss]]; the body of the bot you're facing is in [[.refbody]].
