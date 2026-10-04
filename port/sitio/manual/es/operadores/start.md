---
titulo: start
resumen: "Cierra las condiciones del gen y abre su cuerpo, que corre si todas dieron verdadero; sin cond delante, corre siempre."
etiquetas: [start, gen, cuerpo, flujo]
estado: revisada
---
<!-- 20-VM §5.2 (AddupCond: AND de toda la pila booleana, la vacía; vacío = verdadero; start sin cond = incondicional), §5.5, §5.6; comprobado en el port -->

`start` abre el _cuerpo_ del gen: la parte donde los stores sí escriben.
Qué pasa al llegar depende de lo que haya antes:

- **Después de un [[op:cond]]**, hace un _y_ de todo lo que quedó en la pila
  booleana y la deja vacía. Si todo era verdadero (o no había nada), el
  cuerpo corre; si no, se saltea hasta el próximo marcador.
- **Sin `cond` delante** (al principio del ADN, después de un [[op:stop]] o
  de otro cuerpo), abre un gen nuevo **sin condiciones**, que corre siempre.

```adn
' el primer gen corre siempre; el segundo, solo hasta los 20 ciclos de vida
start
 10 .up store
stop
cond
 *.robage 20 <
start
 30 .aimdx store
stop
```

El bot avanza todo el tiempo con [[.up]] y gira con [[.aimdx]] hasta el
ciclo 20. Después de eso [[.robage]] llega a 20 y el segundo cuerpo deja de
correr.

Dos trampas:

- Un segundo `start` seguido no es un «y además»: abre **otro gen sin
  condiciones**. Si querés dos cuerpos con la misma condición, repetí el
  `cond`.
- Un `start` sin `cond` no vacía la pila booleana. Si el gen anterior dejó un
  falso arriba con una condición en línea, ese falso sigue frenando los
  stores (ver [[op:stop]] y [[adn/pilas#rareza]]). `cond start` es más
  seguro.

Dentro del cuerpo, una condición nueva gobierna los stores que vienen
después; eso se cuenta en [[adn/condiciones#en-linea]]. El resto del gen
está en [[adn/genes]].
