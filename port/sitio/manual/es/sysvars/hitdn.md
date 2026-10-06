---
titulo: .hitdn
resumen: "Vale 1 en el ciclo siguiente a un choque por detrás, con algo que el bot tenía a la espalda."
etiquetas: [choque, tacto, sentido, dirección]
estado: revisada
---
<!-- sysvars.yaml .hitdn; umbrales del tacto en el core (touch, senses.hpp): 2,36 a 3,92 rad -->
`.hitdn` se enciende cuando el bot choca con algo que tiene detrás: el centro del
otro cae dentro de un cono de unos 45 grados a cada lado de la dirección opuesta a
su rumbo ([[.aim]]). Es la dirección de [[.hit]] opuesta a [[.hitup]]; las otras
dos son [[.hitdx]] y [[.hitsx]].

Como todo el tacto, la escribe el motor en el paso de física y tu ADN la lee en el
ciclo siguiente, una sola vez.

Es el aviso típico de «algo me alcanzó por la espalda», donde los ojos no llegan.
La respuesta clásica es darse vuelta para mirarlo:

```adn
cond
*.hitdn 0 !=
start
628 .aimsx store
stop
```

Media vuelta son 628. En el ciclo siguiente al giro, el bot ya lo tiene enfrente y
puede verlo con [[.eye5]].
