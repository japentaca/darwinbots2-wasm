---
titulo: .mkslime
resumen: "Orden para fabricar baba (slime): cada 1 de energía da 10 de slime, hasta 200 por ciclo."
etiquetas: [defensas, slime, energía, lazos]
estado: revisada
---
Escribí cuánta baba querés sumar en este ciclo. El motor la fabrica al final del
ciclo, cobra 1 de energía por cada 10 de slime y deja la orden en 0. Es la única
de las cuatro sustancias con tope de 200 por ciclo en vez de 100.

<!-- sysvars.yaml .mkslime (MakeStuff P5, ±200/ciclo, =0 al consumir); 31-ENERGIA §0.3 -->

La baba se evapora: pierde un 2 % por ciclo. Para tener una capa estable hay que
reponer todos los ciclos, y cuanto más alta la capa, más se pierde. Con 200 por
ciclo la capa se estabiliza cerca de 10000 (el 2 % de 10000 es justo 200).

<!-- 31-ENERGIA §1 (Upkeep P1: slime ×0.98) -->

Como en [[.mkshell]], un valor negativo desarma baba pero igual cobra energía, se
suma un costo de transacción que va a desecho (en un bot multicelular, la parte
que pagás en energía se divide por la cantidad de lazos más uno) y con la energía
en 0 o menos la orden queda escrita sin ejecutarse.

<!-- 34-TIES §3 (costes divididos por numties+1); port/core robots.hpp makeslime (guarda nrg > 0, Cost/(numties+1) si Multibot) -->

El resultado se lee en [[.slime]].

```adn
' una capa de baba suficiente para que no me aten
cond
*.slime 150 <
start
50 .mkslime store
stop
```
