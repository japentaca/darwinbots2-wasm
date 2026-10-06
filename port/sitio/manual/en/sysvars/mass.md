---
titulo: .mass
resumen: "The bot's mass: it comes from the body, the shell and above all the chloroplasts, and decides how much each push moves it."
etiquetas: [mass, physics, sense, chloroplasts]
estado: revisada
---
Mass is how much the bot weighs for the physics. A heavier bot accelerates less
with the same push from [[.up]], is harder to stop and, if there is gravity,
falls harder (see [[simulacion/fisica]]).

<!-- sysvars.yaml .mass (body/1000 + shell/200 + chlr/32000·31680, clamp 1..32000) -->
It comes from three things:

| What | How much it weighs |
|---|---|
| [[.body]] | 1 per 1000 of body |
| [[.shell]] | 1 per 200 of shell |
| [[.chlr]] | almost 1 per chloroplast (0.99) |

The difference is huge: a typical bot, with 1000 of body, weighs 1, but as soon
as it buys 500 chloroplasts it weighs about 500. That is why a bot loaded with
chloroplasts responds very little to its own pushes. The value never drops below
1 nor goes above 32000.

<!-- sysvars.yaml .mass (publicada en P3, antes de ManageChlr P5); comprobado: 500 .mkchlr se lee en .chlr al ciclo siguiente y en .mass dos ciclos después -->
It is read one cycle late, and besides, the engine computes it before applying
the cycle's purchases and conversions: if you buy chloroplasts, the new mass only
shows up two cycles later. A freshly loaded bot reads it as 0 in its first
cycle.

```adn
' If it weighs too much, it sheds chloroplasts
cond
 *.mass 100 >
start
 100 .rmchlr store
stop
```

See also [[.mkchlr]] and [[.rmchlr]].
