---
titulo: .refveldx
resumen: "Con qué velocidad se desplaza de costado lo que estás viendo: positiva hacia tu derecha, negativa hacia tu izquierda."
etiquetas: [visión, refvars, velocidad, persecución]
estado: revisada
---
<!-- sysvars.yaml 697; core senses.hpp lookoccurr (componente lateral menos mi veldx); probado: apunta.txt contra lateral.txt (blanco hacia mi izquierda: refveldx negativa) -->
`.refveldx` es la componente lateral de la velocidad del bot que ve tu ojo con
foco, medida respecto de hacia dónde mirás y relativa a tu propio movimiento
de costado ([[.veldx]]). Positiva: se te va hacia la derecha. Negativa: hacia
la izquierda. Su opuesta es [[.refvelsx]].

Usa la misma convención que [[.dx]], así que copiarla ahí te hace acompañar
el desplazamiento lateral del otro y no perderlo del ojo frontal. Es la mitad
del truco de persecución de [[.refvel]]:

```adn
cond
*.eye5 0 >
start
*.refveldx .dx store
stop
```

Si querés apuntar en vez de moverte, la alternativa es girar: un valor grande
de `.refveldx` avisa que el blanco está por salirse del ojo. Para apuntar con
precisión mirá [[.refxpos]]. Si no ves nada, vale 0.
