---
titulo: .shang
resumen: "The angle the shot that hit you came from, measured from your front toward the right: write it to .aimdx and you end up facing the shooter."
etiquetas: [shots, senses, defense, angles]
estado: revisada
---
<!-- 32-VISION §5 (shang = dang·200); sysvars.yaml 209; core senses.hpp taste; probado: gira.txt (tras girar, el eye5 ve al tirador); revisor: tira.txt contra blanco.txt, golpes de frente con shang 10, 19 y 1238 (32-VISION §5: de frente dang ≈ 6.28); shflav nunca 0 con golpe: tipos de memoria (t-1) Mod 1000 + 1 (33-SHOTS §3.4) -->
<!-- 32-VISION §5 tabla de sectores: derecha 0.78-2.36 rad (156-472), atrás 2.36-3.92, izquierda 3.92-5.49 -->
`.shang` tells you where the last shot that hit you came from, as an angle
between 0 and 1256 measured from your front and turning toward the right: 314 is from
the right, 628 from behind and 942 from the left. A head-on hit gives a
value near 0 or near 1256, depending on which side of center it arrives.
Like [[.shflav]], it arrives one cycle late, lasts one cycle and is 0 if
nothing hit you.

Since it is measured in the same direction as [[.aimdx]], copying it there makes you
turn straight toward the shooter. This example only reacts to energy steals
(`.shflav` −1); with `*.shflav 0 !=` it would react to any hit:

```adn
cond
*.shflav -1 =
start
*.shang .aimdx store
stop
```

In the test, a bot that took a shot with `.shang` at 835 turned and in the
next cycle already had the shooter in its [[.eye5]].

To know whether there was a hit, don't look at `.shang`: a 0 or a very small value
can mean “nothing hit me” or “I was hit head-on”. Look at `.shflav`, which
is never 0 when there was a hit. If you only care about the side
and not the exact angle, there are [[.shup]], [[.shdn]], [[.shdx]] and [[.shsx]].
