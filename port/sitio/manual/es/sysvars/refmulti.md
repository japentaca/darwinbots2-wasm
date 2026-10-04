---
titulo: .refmulti
resumen: "Vale 1 si el bot que estás viendo es parte de un multibot, un organismo de varias células unidas por lazos."
etiquetas: [visión, refvars, multibots, lazos]
estado: revisada
---
<!-- sysvars.yaml 686; core senses.hpp lookoccurr (Multibot ? 1 : 0); sysvars.yaml 470 (multi) -->
`.refmulti` vale 1 si el bot que ve tu ojo con foco forma parte de un
multibot, y 0 si es un bot suelto. El propio bot sabe si es multibot por su
[[.multi]].

Los multibots la usan para reconocer a otras células, y los cazadores, para
distinguir un organismo grande de un bot suelto antes de meterse con él (ver
[[simulacion/lazos]]).

Si no ves nada, o ves una forma, vale 0.

```adn
' a los multibots no los ataco
cond
*.eye5 0 >
*.refmulti 0 =
*.refeye *.myeye !=
start
-1 .shoot store
stop
```
