---
titulo: .rmchlr
resumen: "Se desprende de esa cantidad de cloroplastos en el mismo ciclo, sin costo y sin recuperar nada."
etiquetas: [cloroplastos, acción]
estado: revisada
---
<!-- 31-ENERGIA §1 (ChangeChlr: no cobra ni devuelve al quitar); port/README A3-10 -->
Escribí cuántos cloroplastos querés sacar y el motor los quita en el mismo ciclo. No
cuesta energía, pero tampoco la devuelve: lo que pagaste con [[.mkchlr]] se pierde.
Si pedís sacar más de los que hay, quedan en 0. La orden se borra después de
usarse. Un valor negativo no hace nada y queda escrito en la celda.

Sirve para alivianar al bot (los cloroplastos pesan mucho, ver [[.mass]]) o para
dejar de ser planta, por ejemplo antes de fabricar un virus, que exige no tener
ninguno:

```adn
' Se saca todos los cloroplastos
cond
 *.chlr 0 >
start
 *.chlr .rmchlr store
stop
```

Si en el mismo ciclo también comprás con [[.mkchlr]], se aplican las dos y se cobra
solo el aumento neto.
