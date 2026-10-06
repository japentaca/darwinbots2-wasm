---
titulo: .pwaste
resumen: "Permanent waste: a remainder left every time the bot dumps waste, which can no longer be eliminated."
etiquetas: [waste, sense, aging]
estado: revisada
---
<!-- 31-ENERGIA §2 (Pwaste solo crece: 1 % de los −4, defacate, lazos; clamp 32000); 36-REPRO §2 (reparto al nacer) -->
Every time the bot gets rid of its waste ([[.waste]]), a small part doesn't leave
and stays as permanent waste: 1% of what it dumps with a −4 shot, a
fraction of what it expels on its own when it goes past 32000, and a little more of what passes through
ties. That remainder accumulates in `.pwaste`, capped at 32000.

There is no way to lower it: neither shots nor chloroplasts touch it. The only thing that
splits it up is reproduction, because the child takes its percentage (see
[[.repro]]).

The problem is that it counts toward toxicity: the bot starts suffering random
writes to its memory when `.waste` plus `.pwaste` go past the
limit set by the option [[param:opt:56]] (400 if you haven't changed it). A long-lived bot that dumps a lot of
waste ends up near the threshold just from this remainder, and then any new
waste pushes it over. It is a form of aging: reproducing in time
dilutes it.

```adn
' If permanent waste is already high, reproduce to split it up
cond
 *.pwaste 200 >
start
 50 .repro store
stop
```
