---
titulo: .shell
resumen: "How much shell the bot has: it stops the shots that steal body and the venom ones, and it doesn't wear off on its own."
etiquetas: [defenses, shell, senses]
estado: revisada
---
The shell is the defense against two attacks: the shots that steal body
(`-6` in [[.shoot]]) and the venom ones (`-3`). Every hit eats the
shell first and only what is left over reaches the bot. Against venom it works less well than
against body shots, and it doesn't stop energy shots (`-1`); for
those there is [[.poison]].

<!-- 33-SHOTS §5 (releasebod: shell absorbe ÷20; takeven: ×25 VenumEffectivenessVSShell; releasenrg sin shell) -->

It doesn't wear off over time: what you made with [[.mkshell]] stays until shots
eat it away or you take it apart. The hidden cost is the weight: every 200 of
shell adds as much mass as 1000 of body, so a heavily armored bot
accelerates less with the same [[.up]].

<!-- 31-ENERGIA §1 (solo slime y poison decaen); sysvars.yaml .mass (body/1000 + shell/200) -->

The cell is updated when you make shell, when a shot that wears it down hits you,
and when a partner shares shell with [[.shareshell]]. Writing to it
changes nothing.

<!-- sysvars.yaml .shell (makeshell P5, shareshell P3 en ambos bots, shots) -->

```adn
' if I'm being hit, reinforce the shell
cond
*.shflav 0 !=
*.shell 500 <
start
100 .mkshell store
stop
```

[[.shflav]] tells you what type the shot that hit you in the previous cycle was.
