---
titulo: .refshell
resumen: "Cuánto caparazón tiene el bot que estás viendo: el caparazón frena los disparos de veneno y de body."
etiquetas: [visión, refvars, defensas, caparazón]
estado: revisada
---
<!-- sysvars.yaml 687; 33-SHOTS §5 (-3 takeven y -6 releasebod: el shell absorbe); core senses.hpp lookoccurr -->
`.refshell` es el caparazón del bot que ve tu ojo con foco: lo que ese bot lee
en su [[.shell]] y fabrica con [[.mkshell]]. Va de 0 a 32000.

El caparazón no frena los disparos de energía, pero sí los de veneno
([[.shoot]] en −3), que contra él rinden muy poco, y los de body (−6). Así que
`.refshell` sirve para elegir el arma: si el otro está blindado, mejor
energía que veneno. Los detalles de cada tipo están en
[[simulacion/defensas]].

Si no ves nada, o lo que ves es una forma, vale 0.

```adn
' sin caparazón, veneno; con caparazón, energía
cond
*.eye5 0 >
*.refeye *.myeye !=
*.refshell 0 =
start
-3 .shoot store
stop

cond
*.eye5 0 >
*.refeye *.myeye !=
*.refshell 0 >
start
-1 .shoot store
stop
```
