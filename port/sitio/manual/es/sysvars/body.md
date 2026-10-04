---
titulo: .body
resumen: "El cuerpo del bot, entre 0 y 32000: reserva que vale 10 de energía por punto y que define su tamaño y su peso."
etiquetas: [cuerpo, sentido, reserva, tamaño]
estado: revisada
---
<!-- 31-ENERGIA §0.3, §1, §3; 36-REPRO §2 (guarda body < 5, reparto por per) -->
El cuerpo es la segunda moneda del bot. Cada punto equivale a 10 de energía: lo
cargás con [[.strbody]] y lo gastás con [[.fdbody]]. Mientras tanto no se usa para
pagar nada, pero tiene efectos:

- **Tamaño y peso.** Más cuerpo es un bot más grande (más fácil de ver y de
  acertarle) y más pesado (ver [[.mass]]).
- **Mantenimiento.** Si la simulación cobra por el cuerpo, cuesta energía tenerlo
  cada ciclo (ver [[simulacion/energia]]).
- **Vida.** Si el cuerpo baja de 0,5, el bot muere aunque tenga energía.
- **Reproducción.** Al reproducirse, el hijo se lleva su porcentaje del cuerpo (ver
  [[.repro]]); con muy poco cuerpo no hay parto.

<!-- sysvars.yaml .body (ManageBody P5); comprobado: sembrado e hijo la leen en 0 en su primer ciclo -->
El motor la publica al final del ciclo, entre 0 y 32000. En su primer ciclo de vida
un bot la lee en 0, tanto si lo cargaste vos como si acaba de nacer: no la uses sola
para decidir algo grave en ese ciclo.

```adn
' Se reproduce solo cuando tiene cuerpo de sobra
cond
 *.body 2000 >
start
 50 .repro store
stop
```

Lo que ganó o perdió de cuerpo en el último ciclo está en [[.bodgain]] y
[[.bodloss]]; el cuerpo del bot que tenés enfrente, en [[.refbody]].
