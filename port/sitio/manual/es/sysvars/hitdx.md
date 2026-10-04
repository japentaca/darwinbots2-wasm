---
titulo: .hitdx
resumen: "Vale 1 en el ciclo siguiente a un choque por el costado derecho del bot."
etiquetas: [choque, tacto, sentido, dirección]
estado: revisada
---
<!-- sysvars.yaml .hitdx; umbrales del tacto en el core (touch, senses.hpp): 0,78 a 2,36 rad, lado derecho -->
`.hitdx` se enciende cuando el bot choca con algo que tiene a su derecha: el centro
del otro cae dentro de un cuarto de vuelta centrado en el costado derecho (unos 45
grados para cada lado), mirando desde su rumbo ([[.aim]]). Es una de las direcciones de [[.hit]]; su
opuesta es [[.hitsx]] y las otras dos son [[.hitup]] y [[.hitdn]].

Como todo el tacto, la escribe el motor en el paso de física y tu ADN la lee en el
ciclo siguiente, una sola vez.

Para mirar lo que lo tocó por la derecha, el bot gira un cuarto de vuelta hacia ese
lado con [[.aimdx]]:

```adn
cond
*.hitdx 0 !=
start
314 .aimdx store
stop
```
