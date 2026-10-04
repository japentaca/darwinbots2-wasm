---
titulo: .rdboy
resumen: "La flotabilidad del bot, de 0 a 32000, tal como quedó la última vez que la cambió con .setboy."
etiquetas: [flotabilidad, estanque, sentido]
estado: revisada
---
Muestra la flotabilidad del bot en la escala de 0 a 32000 (32000 es la máxima). Lo
que hace la flotabilidad está en [[.setboy]].

<!-- sysvars.yaml .rdboy (solo cuando setboy ≠ 0); 21-MEMORIA §5 (mem del hijo en 0); comprobado: 1 .setboy store publica el valor -->
La trampa es que el motor solo la actualiza en los ciclos en que el bot escribe
[[.setboy]] con algo distinto de 0. El resto del tiempo conserva el último valor, o
lo que hayas escrito vos en la celda. Y un hijo nace con la flotabilidad del padre
pero con `.rdboy` en 0, porque la memoria no se hereda: hasta que no toque
`.setboy` por primera vez, va a leer 0 aunque esté flotando.

Una forma de sincronizarla al nacer es mandar un cambio nulo en la práctica: un
`.setboy` de 1 mueve la flotabilidad en apenas 1/32000 y obliga al motor a
publicarla.

```adn
' Al nacer, pide que se publique su flotabilidad real
cond
 *.robage 0 =
start
 1 .setboy store
stop
```
