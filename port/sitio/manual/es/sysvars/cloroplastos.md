---
titulo: Cloroplastos y luz
resumen: "Las sysvars para comprar, sacar, contar y compartir cloroplastos, y para saber cuánta luz queda en el campo."
etiquetas: [cloroplastos, luz, fotosíntesis, vegetales]
estado: revisada
---
<!-- 50-MUNDO §2.2 (fotosíntesis dentro de la banda, de día) -->
Los cloroplastos le permiten a un bot vivir del sol: en los ciclos de día, un bot con
cloroplastos que está dentro de la franja iluminada gana energía y cuerpo sin hacer
nada. Los vegetales nacen con ellos, pero cualquier bot puede comprarlos. Cómo se
calcula esa ganancia está en [[simulacion/cloroplastos]].

Las sysvars del grupo son:

- [[.chlr]]: cuántos cloroplastos tiene el bot.
- [[.mkchlr]]: comprar; cuesta energía por cloroplasto.
- [[.rmchlr]]: sacar; gratis, pero no devuelve nada.
- [[.light]]: cuánta luz queda libre en el campo, que baja cuando está lleno de bots.
- [[.sharechlr]]: repartir cloroplastos con los compañeros de un organismo.

<!-- 31-ENERGIA §3 (decaimiento 0,5/100^(chlr/16000), masa, reparto en partos); 35-VIRUS §0.2 -->
Antes de comprar conviene saber lo que traen. Los cloroplastos se pierden solos un
poco cada ciclo (hasta medio por ciclo cuando son pocos, casi nada cuando son
miles), pesan
mucho (cada uno suma casi 1 de [[.mass]], así que el bot apenas se mueve), y son
incompatibles con los virus: si un bot con cloroplastos intenta fabricar uno con
[[.mkvirus]], los pierde todos. Al reproducirse, el hijo se lleva su porcentaje.

La idea más común es un bot que se mantiene en un nivel fijo, reponiendo lo que se
pierde mientras le alcance la energía:

```adn
' Mantiene unos 2000 cloroplastos
cond
 *.chlr 2000 <
 *.nrg 1000 >
start
 100 .mkchlr store
stop
```
