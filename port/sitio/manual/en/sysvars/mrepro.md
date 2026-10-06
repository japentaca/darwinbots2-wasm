---
titulo: .mrepro
resumen: "Like .repro, but the child is born with a much higher chance of mutating: reproduction to explore."
etiquetas: [reproduction, asexual, mutations, action]
estado: revisada
---
<!-- 36-REPRO §2 (régimen de mutación: sin Delta2, tasas ÷10 y Mutations forzado solo para ese parto); 40-MUTACIONES (mutate no corre con las mutaciones apagadas en la simulación) -->
It works like [[.repro]]: the number is the percentage the child takes, it is
taken modulo 100, the command stays written until the birth goes through, and you
cancel it by writing 0. The difference is in the child: with the usual
configuration, its chances of mutating at birth are ten times higher than normal,
and it mutates even if its own mutation table is switched off, something that
only happens with the bots of a saved simulation that comes that way. If
mutations are switched off for the whole simulation, it does not mutate anyway.
Mutations are explained in [[simulacion/mutaciones]].

What it is for: a bot that reproduces almost always with `.repro` and now and then
with `.mrepro` keeps a stable lineage with a few children that try new things.

```adn
' One birth in ten is exploratory
cond
 *.nrg 6000 >
 *.timer 10 mod 0 =
start
 50 .mrepro store
stop
cond
 *.nrg 6000 >
 *.timer 10 mod 0 !=
start
 50 .repro store
stop
```

<!-- 36-REPRO §1 (moneda entre los dos porcentajes); el régimen mirado es mem(mrepro) > 0 -->
If `.repro` and `.mrepro` are written at the same time, a coin flip decides which
percentage is used, and the child mutates extra anyway, because it is enough for
`.mrepro` to hold something. Careful with the example: since both commands persist
until the birth, a request that fails in one cycle can stay written alongside the
one from the other gene.
