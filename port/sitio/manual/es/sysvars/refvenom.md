---
titulo: .refvenom
resumen: "Cuánto veneno de ataque (venom) tiene guardado el bot que estás viendo: con eso puede paralizarte."
etiquetas: [visión, refvars, defensas, venom]
estado: revisada
---
<!-- sysvars.yaml 714 (mem 825 del visto); 33-SHOTS §5 (-3 takeven: Paracount, Vloc/Vval); 21-MEMORIA §4.3 (mem(Vloc)=Vval cada ciclo mientras dure); core senses.hpp lookoccurr -->
`.refvenom` es la reserva de _venom_ del bot que ve tu ojo con foco: lo que
ese bot lee en su [[.venom]]. Va de 0 a 32000.

El venom es un arma: se dispara con [[.shoot]] en −3 y paraliza al que
recibe el golpe, que durante un tiempo ve una celda de su memoria pisada cada ciclo
con el valor que eligió el atacante. Un bot con `.refvenom` alto puede hacerte eso a vos; uno con 0,
no (al menos hasta que fabrique). Los detalles están en
[[simulacion/defensas]].

Su pareja es [[.refpoison]], el veneno de defensa. Si no ves nada, vale 0.

```adn
' alguien armado con venom: me alejo
cond
*.eye5 0 >
*.refvenom 100 >
*.refeye *.myeye !=
start
628 .aimdx store
stop
```
