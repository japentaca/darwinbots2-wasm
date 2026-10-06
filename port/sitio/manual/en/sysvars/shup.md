---
titulo: .shup
resumen: "The type of the shot that hit you head-on in the previous cycle; 0 if nothing hit you from the front."
etiquetas: [shots, senses, defense]
estado: revisada
---
<!-- 32-VISION §5 (sector frente: dang > 5.49 o < 0.78); sysvars.yaml 210; core senses.hpp taste; probado: tira.txt (el -2 de vuelta llega de frente) -->
`.shup` holds the type of the shot (the same number as [[.shflav]]) when
that shot hit you from the front: within a quarter turn centered on your
front, about 45 degrees to each side. If it hit you from another side, or nothing
hit you, it is 0. Its companions are [[.shdn]] (behind), [[.shdx]] (right) and
[[.shsx]] (left); on each hit only one of them is filled.

It arrives one cycle late and lasts one cycle. One detail: what `.shup` registers most
is usually the energy that your own −1 shots send back, which returns from the
target in front of you and registers as −2.

```adn
' someone is attacking me head-on: I return fire
cond
*.shup -1 =
start
-1 .shoot store
stop
```

For the exact angle, instead of the side, there is [[.shang]].
