---
titulo: .refvelscalar
resumen: "Qué tan rápido se mueve lo que estás viendo respecto de vos, sin importar la dirección."
etiquetas: [visión, refvars, velocidad]
estado: revisada
---
<!-- sysvars.yaml 695 (Sqr(refvelup²+refveldx²), tope 32000); core senses.hpp lookoccurr; probado: firma.txt (4 y 1 dan 4; 3 y 4 dan 5) -->
`.refvelscalar` es el módulo de la velocidad relativa de lo que ve tu ojo con
foco: la raíz de [[.refvel]] al cuadrado más [[.refveldx]] al cuadrado,
redondeada. Con `.refvel` en 3 y `.refveldx` en 4 da 5. Nunca es negativa.

Sirve cuando no te importa hacia dónde se mueve el otro, solo si se mueve.
Como es relativa, si vos y el otro van a la par vale 0 aunque los dos estén
corriendo. Es la manera de saber si ya lo alcanzaste en una persecución, o
de distinguir un blanco fácil de uno que va a ser difícil de pegarle.

```adn
' blanco quieto respecto de mí: disparo
cond
*.eye5 0 >
*.refvelscalar 5 <
*.refeye *.myeye !=
start
-1 .shoot store
stop
```

Si no ves nada, vale 0.
