---
titulo: .reftype
resumen: "What you are looking at: 0 if it is a bot and 1 if it is a shape (an obstacle of the scenario)."
etiquetas: [vision, refvars, shapes]
estado: revisada
---
<!-- sysvars.yaml 685; 32-VISION §3.6; core senses.hpp lookoccurr (0) y lookoccurrShape (1), physics.hpp (1 al tocar una forma con eyef 0); 32-VISION §1.3 (formas visibles solo con shapesAreVisable); lookoccurrShape deja en 0 todo salvo posición, velocidades y reffixed -->
`.reftype` says what kind of object your focus eye sees: 0 for a bot, 1 for
a shape, the obstacles that can be placed in the scenario (if the
simulation lets shapes be seen). When what you
see is a shape, the rest of the `ref*` sysvars come in at 0 except position,
velocity and [[.reffixed]].

The catch is that 0 is also what it is when you see nothing. `.reftype` at 0
doesn't mean “there is a bot”: for that, combine it with an eye, such as [[.eye5]] or
[[.eyef]].

There is one more case where it is 1: when you collide with a shape without seeing
anything. That way a blind bot also finds out that it bumped into a wall.

```adn
' a wall ahead: I turn
cond
*.eye5 0 >
*.reftype 1 =
start
314 .aimdx store
stop
```
