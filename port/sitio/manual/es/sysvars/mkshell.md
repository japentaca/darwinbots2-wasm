---
titulo: .mkshell
resumen: "Orden para fabricar caparazón (shell): cada 1 de energía da 10 de shell, hasta 100 por ciclo."
etiquetas: [defensas, shell, energía]
estado: revisada
---
Escribí cuánto caparazón querés sumar en este ciclo. El motor lo fabrica al final
del ciclo, cobra 1 de energía por cada 10 de shell y deja la orden en 0, así que
hay que volver a escribirla cada ciclo que quieras seguir fabricando. Más de 100
por ciclo no se puede: un 500 fabrica 100.

<!-- sysvars.yaml .mkshell (MakeStuff P5, ±100/ciclo, =0 al consumir); 31-ENERGIA §0.3 -->

Un número negativo desarma caparazón, pero ojo: desarmar también cuesta energía,
no la devuelve. Con `-50` perdés 50 de shell y 5 de energía. Además se cobra el
costo de transacción de la simulación, que termina como desecho; en un bot
multicelular ([[.multi]]) la parte que pagás en energía se divide por la cantidad
de lazos más uno.

<!-- port/core robots.hpp makeshell (nrg -= |Delta|·0.1; Cost/(numties+1) si Multibot; Waste += Cost completo); 34-TIES §3 -->

Si la energía está en 0 o menos, la orden no se ejecuta y tampoco se borra: queda
escrita hasta que haya energía.

<!-- port/core robots.hpp makeshell (guarda nrg > 0 antes del reset de mem(822)) -->

El resultado se lee en [[.shell]].

```adn
' mantener 300 de caparazón cuando sobra energía
cond
*.shell 300 <
*.nrg 1000 >
start
100 .mkshell store
stop
```
