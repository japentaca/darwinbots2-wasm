---
titulo: .aimshoot
resumen: "Offsets the next shot by an angle from your front, without turning: positive to the right, negative to the left."
etiquetas: [shots, aiming, action]
estado: revisada
---
<!-- 33-SHOTS §2.2; sysvars.yaml 901 (Mod 1256 en la celda); core shots.hpp newshot (aim - aimshoot/200); probado: a140.txt (140 le pega a lo que ve el eye9), a-140.txt -->
`.aimshoot` makes the next shot go out not straight ahead but offset by an
angle, measured in the same units as [[.aimdx]] (1256 is a full turn).
Positive offsets to the right and negative to the left, just like turning with
`.aimdx`. The difference is that your body doesn't turn: you keep facing the
same way.

It combines very well with the side eyes. Each eye is offset about 35
(10 degrees) from its neighbor: [[.eye9]], the one farthest to the right, looks about
140 to the right of your front, and [[.eye1]] looks 140 to the left. That way you
can shoot at what you see to one side while still facing forward:

```adn
cond
*.eye9 0 >
start
140 .aimshoot store
-1 .shoot store
stop
```

In testing, a bot whose target was only in `.eye9` hit it with
140 and not with −140.

The engine reduces it to less than one turn (modulo 1256) and sets it back to 0 when
the shot goes out; if you don't shoot, it stays set for the next one. If you also
wrote [[.backshot]], `.aimshoot` wins. The shot keeps the small random
deviation that every shot has (see [[.shoot]]).
