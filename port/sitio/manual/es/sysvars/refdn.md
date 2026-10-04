---
titulo: .refdn
resumen: "Cuántas veces escribe en .dn el ADN del bot que estás viendo: una cifra de su firma de especie."
etiquetas: [visión, refvars, firma, reconocimiento]
estado: revisada
---
<!-- sysvars.yaml 702; core senses.hpp makeoccurrlist/lookoccurr; Bestiario: 151 de 684 bots escriben en .dn -->
Otra cifra de la firma del bot que ve tu ojo con foco: cuántas veces aparece
en su ADN la dirección de [[.dn]] (la 2) justo antes de una palabra de
escritura. Funciona igual que [[.refup]]: cuenta lo escrito aunque nunca se
ejecute, no se recalcula en cada ciclo y vale 0 si no ves nada o si lo que ves
es un cadáver.

Pocos bots retroceden (en el Bestiario, uno de cada cuatro escribe en
`.dn`), así que en la mayoría vale 0. Eso la vuelve útil como
dato extra: si tu especie usa `.dn` y el otro no, no es de los tuyos. Se
compara con tu propia cifra, [[.mydn]].

```adn
cond
*.eye5 0 >
*.refdn *.mydn !=
start
-1 .shoot store
stop
```
