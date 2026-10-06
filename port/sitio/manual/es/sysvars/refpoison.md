---
titulo: .refpoison
resumen: "Cuánta toxina (poison) tiene guardada el bot que estás viendo: dispararle puede devolverte un disparo de toxina."
etiquetas: [visión, refvars, defensas, poison]
estado: revisada
---
<!-- sysvars.yaml 713 (mem 827 del visto: poison actual); 33-SHOTS §3, §5 (-1 releasenrg y shots de memoria: rebote -5 si hay poison); core senses.hpp lookoccurr -->
`.refpoison` es la reserva de _poison_ del bot que ve tu ojo con foco: lo que
ese bot lee en su [[.poison]]. Va de 0 a 32000. Es lo que tiene guardado, no
lo que está fabricando.

El poison es una defensa pasiva. Si le pegás con un disparo de energía
([[.shoot]] en −1) a un bot que tiene más poison que la potencia de tu
disparo, en vez de energía te vuelve un disparo de poison que te
envenena. Con los disparos que escriben memoria pasa
algo parecido. Mirar `.refpoison` antes de atacar evita esa trampa; los
detalles están en [[simulacion/defensas]].

Su pareja es [[.refvenom]]. Si no ves nada, vale 0.

```adn
' a los que tienen toxina no les disparo
cond
*.eye5 0 >
*.refeye *.myeye !=
*.refpoison 0 =
start
-1 .shoot store
stop
```
