---
titulo: .refvelsx
resumen: "How fast what you are looking at is moving to your left: it is .refveldx with the sign flipped."
etiquetas: [vision, refvars, velocity]
estado: revisada
---
<!-- sysvars.yaml 696 ([PROBABLE BUG] siempre 0 en el original); README A3-1 (corregido: -refveldx); core senses.hpp lookoccurr; probado: firma.txt, apunta.txt -->
`.refvelsx` is [[.refveldx]] with the sign flipped: positive when what you see
is moving to your left. It is to `.refveldx` what [[.sx]] is to [[.dx]].

```adn
' it's slipping away on the left: turn that way
cond
*.eye5 0 >
*.refvelsx 10 >
start
20 .aimsx store
stop
```

:::nota
In the original DarwinBots 2.48.32 this sysvar was broken and always read 0.
This port fixes it: it is now the opposite of `.refveldx`, just as
[[.refveldn]] is the opposite of [[.refvel]]. An old bot that read it behaved
as if the other bot never moved to the left; in the port it may act
differently.
:::

If you don't see anything, it is 0.
