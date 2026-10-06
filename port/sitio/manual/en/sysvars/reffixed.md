---
titulo: .reffixed
resumen: "It is 1 if what you are looking at can't move: a bot anchored with .fixpos or a still shape."
etiquetas: [vision, refvars, movement]
estado: revisada
---
<!-- sysvars.yaml 477; core senses.hpp lookoccurr (Fixed) y lookoccurrShape (vel de la forma = 0); sysvars.yaml 216 (fixpos: >0 fija, <=0 libera); Bestiario: Alga_Cohesum_V_Elite_-01.06.06.txt hace 1 .fixpos store -->
`.reffixed` is 1 if the bot your focus eye sees is anchored in place,
because it put a positive value in its [[.fixpos]]; it is 0 if it can move. When what you see
is a shape, it is 1 if the shape is still.

Against something anchored you don't need to chase or correct your aim for its
movement: it is enough to stay pointing and shoot. Many Bestiary vegetables
anchor themselves this way, for example _Alga Cohesum_.

If you see nothing, it is 0.

```adn
' a target that doesn't move: I stay still and shoot
cond
*.eye5 0 >
*.reffixed 1 =
*.refeye *.myeye !=
start
-1 .shoot store
stop
```
