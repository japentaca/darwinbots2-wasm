---
titulo: .shsx
resumen: "The type of the shot that hit you from the left in the previous cycle; 0 if nothing hit you from that side."
etiquetas: [shots, senses, defense]
estado: revisada
---
<!-- 32-VISION §5 (sector izquierda: dang 3.92-5.49); sysvars.yaml 213; core senses.hpp taste; probado: tira.txt contra blanco.txt (golpe por la izquierda: shsx -1, shang 835) -->
`.shsx` holds the type of the shot (the same number as [[.shflav]]) when
that shot hit you from the left, within a quarter turn centered
on your left side. If it hit you from another side, or nothing hit you, it is 0.
Its companions are [[.shup]], [[.shdn]] and [[.shdx]].

It arrives one cycle late and lasts one cycle. In the test, a bot that was being
shot at from its left read `.shsx` at −1, and [[.shang]] at 835.

```adn
' I'm being hit from the left: I turn that way
cond
*.shsx 0 !=
start
314 .aimsx store
stop
```

To aim more precisely, use the exact angle from `.shang`.
