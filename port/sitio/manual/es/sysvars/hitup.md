---
titulo: .hitup
resumen: "Vale 1 en el ciclo siguiente a un choque de frente, con algo que estaba delante del bot."
etiquetas: [choque, tacto, sentido, dirección]
estado: revisada
---
<!-- sysvars.yaml .hitup; umbrales del tacto en el core (touch, senses.hpp): de frente ±0,78 rad -->
`.hitup` se enciende cuando el bot choca con algo que está delante suyo: el centro
del otro cae dentro de un cono de unos 45 grados a cada lado de su rumbo
([[.aim]]). Es una de las cuatro direcciones de [[.hit]], junto con [[.hitdn]]
(atrás), [[.hitdx]] (derecha) y [[.hitsx]] (izquierda); [[.hit]] se enciende
siempre que se enciende alguna.

Como todo el tacto, la escribe el motor en el paso de física y tu ADN la lee en el
ciclo siguiente, una sola vez: después se borra.

Un choque de frente suele ser lo que el bot venía buscando (o con lo que se
tropezó por no mirar). Lo que tocó queda descrito en los `ref*`, así que se puede
reaccionar según qué es. Este bot retrocede si lo que tiene adelante es más
grande que él:

```adn
cond
*.hitup 0 !=
*.refbody *.body >
start
30 .dn store
stop
```
