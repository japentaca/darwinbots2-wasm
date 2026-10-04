---
titulo: .refnrg
resumen: "La energía del bot que estás viendo, de 0 a 32000: para elegir presas que valgan la pena o parejas bien alimentadas."
etiquetas: [visión, refvars, energía]
estado: revisada
---
<!-- sysvars.yaml 709; 32-VISION §2 (cadáveres: refnrg/refbody reales); core senses.hpp lookoccurr; probado: mira.txt contra quieto.txt (refnrg 3000) -->
`.refnrg` es la energía del bot que ve tu ojo con foco, redondeada y recortada
entre 0 y 32000. Es lo mismo que ese bot lee en su [[.nrg]].

Sirve para decidir si vale la pena atacar: un disparo de energía
([[.shoot]] en −1) le saca al otro una parte de lo que tiene, así que contra
un bot casi vacío ganás poco. También para lo contrario: _Animal Minimalis
Amorous_, del Bestiario, solo se acerca a aparearse con un compañero que tenga
más de 20000.

A diferencia de la firma ([[.refeye]] y compañía), un cadáver sí muestra su
energía real, igual que su [[.refbody]]. Si no ves nada, vale 0.

```adn
' solo le disparo a lo que tiene energía para darme
cond
*.eye5 0 >
*.refeye *.myeye !=
*.refnrg 500 >
start
-1 .shoot store
stop
```
