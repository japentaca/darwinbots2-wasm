---
titulo: .refaimdx
resumen: "Cuántas veces escribe en .aimdx el ADN del bot que estás viendo: una cifra de su firma de especie."
etiquetas: [visión, refvars, firma, reconocimiento]
estado: revisada
---
<!-- sysvars.yaml 705; core senses.hpp makeoccurrlist/lookoccurr -->
Cuenta cuántas veces aparece en el ADN del bot visto la dirección de
[[.aimdx]] (la 5, girar a la derecha) justo antes de una palabra de escritura.
Casi todo bot que busca comida gira, así que suele valer 1 o más; un vegetal
que no se mueve suele tener 0.

Las reglas son las de toda la firma (ver [[.refup]]). Tu propia cifra es
[[.myaimdx]], y la del giro contrario, [[.refaimsx]].

```adn
' lo que no sabe girar probablemente es un vegetal: a comer
cond
*.eye5 0 >
*.refaimdx 0 =
*.refaimsx 0 =
start
-1 .shoot store
stop
```
