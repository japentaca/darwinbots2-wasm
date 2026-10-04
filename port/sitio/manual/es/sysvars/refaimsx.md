---
titulo: .refaimsx
resumen: "Cuántas veces escribe en .aimsx el ADN del bot que estás viendo: una cifra de su firma de especie."
etiquetas: [visión, refvars, firma, reconocimiento]
estado: revisada
---
<!-- sysvars.yaml 706; core senses.hpp makeoccurrlist/lookoccurr -->
Cuenta cuántas veces aparece en el ADN del bot visto la dirección de
[[.aimsx]] (la 6, girar a la izquierda) justo antes de una palabra de
escritura. Es la pareja de [[.refaimdx]].

Las reglas son las de toda la firma (ver [[.refup]]): cuenta lo escrito, no lo
que corre; no se recalcula en cada ciclo; vale 0 si no ves nada. Tu propia cifra es
[[.myaimsx]].

```adn
' gira igual que yo: probablemente es de mi especie, sigo buscando
cond
*.eye5 0 >
*.refaimsx *.myaimsx =
*.refaimdx *.myaimdx =
start
314 .aimdx store
stop
```
