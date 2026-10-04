---
titulo: .chlr
resumen: "Cuántos cloroplastos tiene el bot, de 0 a 32000, después de la pérdida natural del ciclo."
etiquetas: [cloroplastos, sentido, fotosíntesis]
estado: revisada
---
<!-- 50-MUNDO §2.2 (ganancia con −(chlr/32000)² y descuento por edad) -->
Es la cantidad de cloroplastos del bot. Con más cloroplastos gana más con el sol,
aunque no en proporción: la ganancia tiene un descuento que pesa más cuantos más
tiene, y otro que crece con la edad (la fórmula está en
[[simulacion/cloroplastos]]).

<!-- sysvars.yaml .chlr (ManageChlr P5, tras el decaimiento); 31-ENERGIA §3 -->
El motor la publica al final de cada ciclo, después de aplicar las compras de
[[.mkchlr]], las bajas de [[.rmchlr]] y la pérdida natural. Esa pérdida es de medio
cloroplasto por ciclo cuando tiene pocos y se achica a medida que tiene más: con
8000 es de una vigésima, con 16000 de una ducentésima. Como la celda se publica
redondeada, un bot con pocos cloroplastos ve cómo el número baja de a 1 cada
algunos ciclos.

Se reparte al reproducirse (el hijo se lleva su porcentaje) y se puede compartir
dentro de un organismo con [[.sharechlr]]. Un bot recién cargado la lee en 0 en su
primer ciclo, aunque sea un vegetal.

```adn
' A los 500 ciclos, si no tiene cloroplastos, compra mil
cond
 *.robage 500 >
 *.chlr 0 =
 *.nrg 2000 >
start
 1000 .mkchlr store
stop
```
