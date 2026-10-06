---
titulo: .shdn
resumen: "The type of the shot that hit you from behind in the previous cycle; 0 if nothing hit you from behind."
etiquetas: [shots, senses, defense]
estado: revisada
---
<!-- 32-VISION §5 (sector atrás: dang 2.36-3.92); sysvars.yaml 211; core senses.hpp taste -->
`.shdn` holds the type of the shot (the same number as [[.shflav]]) when
that shot hit you from behind, within a quarter turn centered on your
back. If it hit you from another side, or nothing hit you, it is 0. It is the counterpart of
[[.shup]]; the ones for the sides are [[.shdx]] and [[.shsx]].

It arrives one cycle late and lasts one cycle. Against an attack from behind there are
two typical responses:
turning around to fight, or returning fire without stopping, with
[[.backshot]].

```adn
' I'm being hit from behind: half turn
cond
*.shdn 0 !=
start
628 .aimdx store
stop
```

For the exact angle, instead of the side, there is [[.shang]].
