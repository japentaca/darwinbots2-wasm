---
titulo: .light
resumen: "Cuánta luz queda disponible en el campo, de 0 a 32000: baja a medida que los bots ocupan más superficie."
etiquetas: [luz, cloroplastos, sentido, población]
estado: revisada
---
<!-- sysvars.yaml .light (32000 − LightAval·32000); 50-MUNDO §2.2 (LightAval = área de los bots / área del campo menos formas, solo con sol) -->
Mide qué parte del campo no está tapada por bots. El motor suma la superficie de
todos los bots vivos, la compara con la del campo y publica el resto en la escala de
0 a 32000: 32000 es un campo vacío, y cuanto más poblado, más baja. También se llama
`.availability`.

Importa porque la fotosíntesis depende de eso: en un campo lleno, cada cloroplasto
rinde menos (ver [[simulacion/cloroplastos]]). Es un dato del campo entero, no de
dónde está el bot: todos leen el mismo número, estén o no al sol.

Dos detalles:

- El motor solo la recalcula en los ciclos de día. De noche (ver [[.daytime]]) se
  sigue publicando el último valor de día, aunque la población haya cambiado.
- Un bot recién cargado la lee en 0 en su primer ciclo.

```adn
' Solo compra cloroplastos si el campo no está saturado
cond
 *.light 24000 >
 *.chlr 500 <
 *.nrg 1000 >
start
 100 .mkchlr store
stop
```

Ver también [[.chlr]] y [[.mkchlr]].
