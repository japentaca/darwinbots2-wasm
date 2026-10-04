---
titulo: .mass
resumen: "La masa del bot: sale del cuerpo, del caparazón y sobre todo de los cloroplastos, y decide cuánto lo mueve cada empujón."
etiquetas: [masa, física, sentido, cloroplastos]
estado: revisada
---
La masa es lo que pesa el bot para la física. Un bot más pesado acelera menos con
el mismo empujón de [[.up]], cuesta más frenarlo y, si hay gravedad, cae con más
fuerza (ver [[simulacion/fisica]]).

<!-- sysvars.yaml .mass (body/1000 + shell/200 + chlr/32000·31680, clamp 1..32000) -->
Sale de tres cosas:

| Qué | Cuánto pesa |
|---|---|
| [[.body]] | 1 cada 1000 de cuerpo |
| [[.shell]] | 1 cada 200 de caparazón |
| [[.chlr]] | casi 1 por cloroplasto (0,99) |

La diferencia es enorme: un bot típico, con 1000 de cuerpo, pesa 1, pero apenas
compra 500 cloroplastos pasa a pesar unos 500. Por eso un bot cargado de
cloroplastos responde muy poco a sus propios empujones. El valor nunca baja de 1 ni pasa de 32000.

<!-- sysvars.yaml .mass (publicada en P3, antes de ManageChlr P5); comprobado: 500 .mkchlr se lee en .chlr al ciclo siguiente y en .mass dos ciclos después -->
Se lee con un ciclo de atraso, y además el motor la calcula antes de aplicar las
compras y conversiones del ciclo: si comprás cloroplastos, la masa nueva aparece
recién dos ciclos después. Un bot recién cargado la lee en 0 en su primer ciclo.

```adn
' Si pesa demasiado, se desprende de cloroplastos
cond
 *.mass 100 >
start
 100 .rmchlr store
stop
```

Ver también [[.mkchlr]] y [[.rmchlr]].
