---
titulo: .reftype
resumen: "Qué es lo que estás viendo: 0 si es un bot y 1 si es una forma (un obstáculo del escenario)."
etiquetas: [visión, refvars, formas]
estado: revisada
---
<!-- sysvars.yaml 685; 32-VISION §3.6; core senses.hpp lookoccurr (0) y lookoccurrShape (1), physics.hpp (1 al tocar una forma con eyef 0); 32-VISION §1.3 (formas visibles solo con shapesAreVisable); lookoccurrShape deja en 0 todo salvo posición, velocidades y reffixed -->
`.reftype` dice qué clase de objeto ve tu ojo con foco: 0 para un bot, 1 para
una forma, los obstáculos que se pueden poner en el escenario (si la
simulación deja ver las formas). Cuando lo que
ves es una forma, el resto de las `ref*` vienen en 0 salvo la posición, la
velocidad y [[.reffixed]].

La trampa es que 0 también es lo que vale cuando no ves nada. `.reftype` en 0
no quiere decir «hay un bot»: para eso combinala con un ojo, como [[.eye5]] o
[[.eyef]].

Hay un caso más en que vale 1: cuando chocás con una forma sin estar viendo
nada. Así un bot ciego también se entera de que topó con una pared.

```adn
' una pared adelante: giro
cond
*.eye5 0 >
*.reftype 1 =
start
314 .aimdx store
stop
```
