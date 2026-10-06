---
titulo: .shdx
resumen: "The type of the shot that hit you from the right in the previous cycle; 0 if nothing hit you from that side."
etiquetas: [shots, senses, defense]
estado: revisada
---
<!-- 32-VISION §5 (sector derecha: dang 0.78-2.36); sysvars.yaml 212; core senses.hpp taste -->
`.shdx` holds the type of the shot (the same number as [[.shflav]]) when
that shot hit you from the right, within a quarter turn centered on
your right side. If it hit you from another side, or nothing hit you, it is 0. Its
companions are [[.shup]], [[.shdn]] and [[.shsx]].

It arrives one cycle late and lasts one cycle. A quarter turn is 314
turn units, so the direct response is to turn that much to the right
with [[.aimdx]]:

```adn
' I'm being hit from the right: I turn that way
cond
*.shdx 0 !=
start
314 .aimdx store
stop
```

To aim more precisely, use the exact angle from [[.shang]].
