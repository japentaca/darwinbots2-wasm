---
titulo: .strpoison
resumen: "Orden para fabricar toxina (poison): cada 1 de energía da 4 de toxina, hasta 100 por ciclo. También se llama .mkpoison."
etiquetas: [defensas, poison, energía]
estado: revisada
---
Escribí cuánta toxina querés sumar en este ciclo; `.mkpoison` es otro nombre para
la misma celda. El motor la fabrica al final del ciclo, cobra 1 de energía por
cada 4 de toxina y deja la orden en 0. El tope es 100 por ciclo, o sea 25 de
energía. Es cuatro veces más barata que el veneno de [[.strvenom]], una asimetría
que viene del DarwinBots original.

<!-- sysvars.yaml .strpoison (alias mkpoison; MakeStuff P5, ±100/ciclo); 31-ENERGIA §0.3 y §4.2 (venom 1:1 contra poison 4:1) -->

Como en [[.mkshell]], un valor negativo desarma toxina pero cobra energía igual,
se suma un costo de transacción que va a desecho, y con la energía en 0 o menos la
orden queda escrita sin ejecutarse.

<!-- port/core robots.hpp storepoison (nrg -= |Delta|·0.25; Waste += Cost; guarda nrg > 0) -->

La toxina se evapora un 2 % por ciclo, así que una reserva se mantiene reponiendo.
El resultado se lee en [[.poison]].

<!-- 31-ENERGIA §1 (poison ×0.98 en P1) -->

```adn
' sostener unos 500 de toxina
cond
*.poison 500 <
start
100 .strpoison store
stop
```
