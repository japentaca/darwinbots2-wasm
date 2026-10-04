---
titulo: .refvelsx
resumen: "Con qué velocidad se desplaza hacia tu izquierda lo que estás viendo: es .refveldx con el signo cambiado."
etiquetas: [visión, refvars, velocidad]
estado: revisada
---
<!-- sysvars.yaml 696 ([PROBABLE BUG] siempre 0 en el original); README A3-1 (corregido: -refveldx); core senses.hpp lookoccurr; probado: firma.txt, apunta.txt -->
`.refvelsx` es [[.refveldx]] con el signo cambiado: positiva cuando lo que ves
se desplaza hacia tu izquierda. Es a `.refveldx` lo que [[.sx]] es a [[.dx]].

```adn
' se me escapa por la izquierda: giro hacia ese lado
cond
*.eye5 0 >
*.refvelsx 10 >
start
20 .aimsx store
stop
```

:::nota
En el DarwinBots 2.48.32 original esta sysvar estaba rota y valía siempre 0.
Este port la corrige: ahora es el opuesto de `.refveldx`, como
[[.refveldn]] lo es de [[.refvel]]. Un bot viejo que la leía se comportaba
como si el otro nunca se moviera hacia la izquierda; en el port puede actuar
distinto.
:::

Si no ves nada, vale 0.
