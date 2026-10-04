---
titulo: .refshoot
resumen: "Cuántas veces escribe en .shoot el ADN del bot que estás viendo: si es mayor que 0, sabe disparar."
etiquetas: [visión, refvars, firma, disparos]
estado: revisada
---
<!-- sysvars.yaml 707; core senses.hpp makeoccurrlist; probado: firma2.txt (dos 0 .shoot store dan 2); makeoccurrlist solo cuenta un número literal 1..7 seguido de un store (tipo 7), así que una dirección calculada no suma -->
Cuenta cuántas veces aparece en el ADN del bot visto la dirección de
[[.shoot]] (la 7) justo antes de una palabra de escritura. Además de ser una
cifra de la firma, como [[.refup]], tiene una lectura directa: un bot con
`.refshoot` en 0 no tiene ninguna orden de disparo escrita de la manera
habitual, así que difícilmente te ataque a tiros (podría disparar con una
dirección calculada, que la firma no cuenta). Los vegetales suelen estar
en 0.

Ojo: cuenta lo escrito, no lo que se ejecuta. Un bot con un `-1 .shoot store`
en un gen que nunca se activa también suma. Tu propia cifra es [[.myshoot]].

```adn
' si el otro sabe disparar y no es de los míos, me doy vuelta
cond
*.eye5 0 >
*.refshoot 0 >
*.refeye *.myeye !=
start
628 .aimdx store
stop
```
