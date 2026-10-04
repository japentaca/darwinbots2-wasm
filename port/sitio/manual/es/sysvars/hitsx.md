---
titulo: .hitsx
resumen: "Vale 1 en el ciclo siguiente a un choque por el costado izquierdo del bot."
etiquetas: [choque, tacto, sentido, dirección]
estado: revisada
---
<!-- sysvars.yaml .hitsx; umbrales del tacto en el core (touch, senses.hpp): 3,92 a 5,49 rad, lado izquierdo -->
`.hitsx` se enciende cuando el bot choca con algo que tiene a su izquierda: el
centro del otro cae dentro de un cuarto de vuelta centrado en el costado izquierdo (unos
45 grados para cada lado), mirando desde su rumbo ([[.aim]]). Es una de las direcciones de
[[.hit]]; su opuesta es [[.hitdx]] y las otras dos son [[.hitup]] y [[.hitdn]].

Como todo el tacto, la escribe el motor en el paso de física y tu ADN la lee en el
ciclo siguiente, una sola vez.

Para mirar lo que lo tocó por la izquierda, el bot gira un cuarto de vuelta hacia
ese lado con [[.aimsx]]:

```adn
cond
*.hitsx 0 !=
start
314 .aimsx store
stop
```
