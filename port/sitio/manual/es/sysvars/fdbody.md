---
titulo: .fdbody
resumen: "Convierte cuerpo en energía: hasta 100 de energía por ciclo, a 10 de energía por punto de cuerpo."
etiquetas: [cuerpo, energía, acción, conversión]
estado: revisada
---
<!-- 31-ENERGIA §0.3 (feedbody, tope 100); port/README A3-7 (negativos se borran) -->
Escribí cuánta energía querés sacarle al cuerpo y el motor la convierte en el mismo
ciclo: `100 .fdbody store` suma 100 a [[.nrg]] y resta 10 a [[.body]]. Es la
operación inversa de [[.strbody]], y no tiene costo extra.

Algunos detalles:

- **Tope de 100 por ciclo.** Un valor mayor cuenta como 100. Para sacar más, escribí
  de nuevo en los ciclos siguientes.
- **Se borra al usarse.** Después de la conversión vuelve a 0, así que hay que
  escribirla en cada ciclo en que la quieras.
- **Los negativos no hacen nada**: el motor los borra sin convertir. (En el
  DarwinBots original quedaban escritos en la celda; el port lo corrigió.)
- **No mira cuánto cuerpo te queda.** Si el cuerpo cae por debajo de 0,5, el bot
  muere. Conviene ponerle una condición sobre `*.body`.
- **La energía no pasa de 32000.** Si ya estás cerca del tope, lo que sobra se
  pierde, y el cuerpo se descuenta igual.

```adn
' Si se queda sin energía, come de su cuerpo
cond
 *.nrg 1000 <
 *.body 50 >
start
 100 .fdbody store
stop
```

El uso típico, junto con [[.strbody]], está en [[sysvars/cuerpo]].
