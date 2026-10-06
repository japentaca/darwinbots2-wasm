---
titulo: .dn
resumen: "Pushes the bot backward, opposite to where it points, without turning it around."
etiquetas: [movement, thrust, command]
estado: revisada
---
<!-- sysvars.yaml .dn; 30-FISICA §2.1 -->
`.dn` is the backward push: it moves the bot opposite to [[.aim]] without
turning it, so it keeps facing forward while it backs up. It works just
like [[.up]] with the sign flipped: the engine subtracts `.up − .dn` and pushes with what
is left, so `30 .dn store` is equivalent to `-30 .up store`, and writing the same value
to both cancels out.

Like every movement command, the engine applies it in the same cycle and sets it back to
0; it is an acceleration added to the velocity the bot already had, with the same
cap ([[.maxvel]]) and the same cost as `.up`.

It's useful for moving away from something without losing sight of it, or for braking: a bot that is going
forward at [[.velup]] 20 and pushes with `.dn` keeps losing speed.

```adn
' if something touches it from the front, it backs up
cond
*.hitup 0 !=
start
30 .dn store
stop
```

<!-- sysvars.yaml (latencia por defecto); 10-CICLO §2 -->
[[.hitup]] is read one cycle late: the bot backs up in the cycle after the
collision.
