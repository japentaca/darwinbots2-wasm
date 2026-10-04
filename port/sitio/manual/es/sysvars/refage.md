---
titulo: .refage
resumen: "La edad en ciclos del bot que estás viendo, hasta 32000: para reconocer recién nacidos."
etiquetas: [visión, refvars, edad]
estado: revisada
---
<!-- sysvars.yaml 710; core senses.hpp lookoccurr (age con tope 32000); probado: mira.txt contra quieto.txt -->
`.refage` es la edad del bot que ve tu ojo con foco, en ciclos, con tope en
32000. Es la misma cuenta que ese bot lee en su [[.robage]].

El uso típico es no atacar a los recién nacidos, que casi siempre son hijos
propios o de un vecino: un bot recién nacido está pegado a su padre y es fácil
confundirlo con una presa. Combinada con la firma ([[.refeye]]), también sirve
para lo contrario: buscar pareja solo entre los adultos de tu especie.

Si no ves nada, vale 0, así que una condición como `*.refage 50 <` también
se cumple sin nada a la vista: combinala siempre con un ojo ([[.eye5]]).

```adn
' a un recién nacido no lo toco: sigo de largo
cond
*.eye5 0 >
*.refage 50 <
start
314 .aimdx store
stop
```
