---
titulo: .pleas
resumen: "Cuánta energía ganó el bot en el último ciclo; negativa si perdió."
etiquetas: [energía, placer, sentido]
estado: revisada
---
<!-- sysvars.yaml .pleas = CInt(nrg − onrg) -->
`.pleas` (de _pleasure_, placer) es la energía que el bot tiene al final de este
ciclo menos la que tenía al final del anterior: positiva si ganó, negativa si
perdió. Es exactamente [[.pain]] con el signo cambiado, y vale para ella todo lo
que dice esa página: mide el cambio neto, se lee con un ciclo de atraso y en el
segundo ciclo de un bot puesto al empezar la simulación muestra toda su energía
como ganancia.

Como el cambio es neto, un bot que come pero gasta más en moverse lee un `.pleas`
negativo. Para notar que la comida rinde, conviene compararla con un umbral y no
con 0.

El uso típico es no abandonar una buena fuente de comida: mientras la energía
sube, quedarse donde está y seguir disparándole.

```adn
' mientras gana energía, sigue disparando para alimentarse
cond
*.pleas 20 >
start
-1 .shoot store
stop
```
