---
titulo: .strbody
resumen: "Guarda energía como cuerpo: hasta 100 de energía por ciclo, que se convierten en 10 de cuerpo."
etiquetas: [cuerpo, energía, acción, conversión]
estado: revisada
---
<!-- 31-ENERGIA §0.3 (storebody, tope 100, sin mirar nrg); port/README A3-7 (negativos se borran); comprobado: con 5300 de energía sube 10 de cuerpo por ciclo hasta bajar a 5000 -->
Escribí cuánta energía querés guardar y el motor la convierte en el mismo ciclo:
`100 .strbody store` resta 100 a [[.nrg]] y suma 10 a [[.body]]. Es la operación
inversa de [[.fdbody]]. Los bots lo usan para no tener toda su riqueza en energía:
el cuerpo hace al bot más grande y se puede recuperar después.

Algunos detalles:

- **Tope de 100 por ciclo.** Un valor mayor cuenta como 100.
- **Se borra al usarse**, así que hay que escribirla en cada ciclo en que la
  quieras. Los negativos no hacen nada: el motor los borra sin convertir (en el
  DarwinBots original quedaban escritos; el port lo corrigió).
- **No mira cuánta energía tenés.** Con 50 de energía, `100 .strbody store` se cobra
  igual los 100: el bot queda sin energía y muere. Poné siempre una condición sobre
  `*.nrg`.
- **El cuerpo no pasa de 32000.** Por encima, la energía se cobra y el cuerpo no
  crece.

```adn
' Con energía de sobra, la guarda en el cuerpo
cond
 *.nrg 4000 >
start
 100 .strbody store
stop
```

Este bot baja 100 de energía y sube 10 de cuerpo por ciclo mientras tenga más de
4000. El ejemplo completo de alcancía, con las dos órdenes, está en
[[sysvars/cuerpo]].
