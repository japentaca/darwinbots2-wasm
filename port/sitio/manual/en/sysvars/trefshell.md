---
titulo: .trefshell
resumen: "The shell that the tied bot at the other end of the tie has."
etiquetas: [tref, ties, defenses, shell]
estado: revisada
---
<!-- sysvars.yaml .trefshell; 21-MEMORIA §9.2 (el original no la borra); port/README A3-2 (el port la borra con las demás) -->
It holds the [[.shell]] of the tied bot, rounded to an integer. It's useful, for example, for
dividing the work in a multibot: if the partner already has a shell, you
don't need to make one (see [[.mkshell]]).

```adn
' Makes shell only if the tied bot has little
cond
*.numties 0 >
*.trefshell 100 <
start
10 .mkshell store
stop
```

:::nota
In the original DarwinBots this sysvar was never cleared: when you lost the tie
you kept reading the shell of the last partner. In this version it is cleared along with the other [[sysvars/tref|tref*]] (see
[[tecnico/diferencias]]).
:::
