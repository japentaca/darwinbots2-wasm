---
titulo: .refsx
resumen: "Cuántas veces escribe en .sx el ADN del bot que estás viendo: una cifra de su firma de especie."
etiquetas: [visión, refvars, firma, reconocimiento]
estado: revisada
---
<!-- sysvars.yaml 703; core senses.hpp makeoccurrlist/lookoccurr -->
Cuenta cuántas veces aparece en el ADN del bot visto la dirección de [[.sx]]
(la 3, empuje hacia la izquierda) justo antes de una palabra de escritura. Es
una de las cifras de la firma; las reglas son las de [[.refup]]: se cuenta lo
escrito, no lo que corre, no se recalcula en cada ciclo y vale 0 si no hay nada a la
vista.

Tu propia cifra es [[.mysx]]. Combinada con [[.refdx]] te dice si el otro
tiene movimiento lateral en su repertorio, algo típico de los bots que
esquivan.

```adn
cond
*.eye5 0 >
*.refsx *.mysx !=
*.refdx *.mydx != or
start
-1 .shoot store
stop
```
