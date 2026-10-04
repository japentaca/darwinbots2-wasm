---
titulo: .mkchlr
resumen: "Compra cloroplastos: suma esa cantidad en el mismo ciclo y cobra energía por cada uno."
etiquetas: [cloroplastos, acción, energía]
estado: revisada
---
<!-- comprobado: con 32000 cloroplastos, 1000 .mkchlr cobra 100 (costo 0,1) y no suma nada -->
<!-- 31-ENERGIA §1 (ChangeChlr: cobra solo al añadir, se anula si nrg < 100 o con el techo de población vegetal); port/README A3-10 (negativos no hacen nada); comprobado: con 1050 de energía y costo 10, 100 .mkchlr no compra -->
Escribí cuántos cloroplastos querés y el motor los agrega en el mismo ciclo,
cobrando por cada uno lo que fije el costo [[param:cost:8]]. La
orden se borra después, así que una compra grande se hace de una vez o se repite
ciclo a ciclo. No tiene tope por ciclo, salvo el máximo de 32000 cloroplastos (lo que pase de ahí
se cobra igual y se pierde).

La compra es todo o nada. Se cancela entera, sin cobrar, si:

- después de pagarla el bot quedaría con menos de 100 de energía;
- el bot es un vegetal y el total de cloroplastos del campo ya pasó el límite de
  población (así el motor evita que los vegetales llenen todo).

Un valor negativo no hace nada (en el DarwinBots original, un −100 en [[.rmchlr]]
junto con una compra sumaba 100 cloroplastos más; el port lo corrigió). Si en el mismo ciclo escribís también
[[.rmchlr]], se hacen las dos cosas y solo se cobra el aumento neto.

```adn
' Compra cloroplastos de a 100 mientras le sobre energía
cond
 *.chlr 1000 <
 *.nrg 500 >
start
 100 .mkchlr store
stop
```

El resultado se lee en [[.chlr]] el ciclo siguiente.

:::cuidado
Un bot con cloroplastos no puede fabricar virus: si lo intenta con [[.mkvirus]],
pierde todos sus cloroplastos (ver [[sysvars/adn-y-virus]]).
:::
