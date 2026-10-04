---
titulo: .reffixed
resumen: "Vale 1 si lo que estás viendo no se puede mover: un bot anclado con .fixpos o una forma quieta."
etiquetas: [visión, refvars, movimiento]
estado: revisada
---
<!-- sysvars.yaml 477; core senses.hpp lookoccurr (Fixed) y lookoccurrShape (vel de la forma = 0); sysvars.yaml 216 (fixpos: >0 fija, <=0 libera); Bestiario: Alga_Cohesum_V_Elite_-01.06.06.txt hace 1 .fixpos store -->
`.reffixed` vale 1 si el bot que ve tu ojo con foco está anclado en su lugar,
porque puso un valor positivo en su [[.fixpos]]; vale 0 si se puede mover. Cuando lo que ves
es una forma, vale 1 si la forma está quieta.

Contra algo anclado no hace falta perseguir ni corregir la puntería por su
movimiento: alcanza con quedarse apuntando y disparar. Muchos vegetales del
Bestiario se anclan así, por ejemplo _Alga Cohesum_.

Si no ves nada, vale 0.

```adn
' un blanco que no se mueve: me quedo quieto y disparo
cond
*.eye5 0 >
*.reffixed 1 =
*.refeye *.myeye !=
start
-1 .shoot store
stop
```
