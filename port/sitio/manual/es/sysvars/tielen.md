---
titulo: .tielen
resumen: "El largo del lazo de .tiepres, medido de borde a borde entre los dos bots."
etiquetas: [lazos, tie, sentidos]
estado: revisada
---
Es la distancia entre el bot y su compañero descontando los dos radios: cerca de
0 cuando se tocan, y puede ser un poco negativa si se superponen. Lo publica el
motor al final de cada ciclo, así que lo leés con un ciclo de atraso. Vale 0 si
no hay lazo.

<!-- sysvars.yaml .tielen (UpdateTieAngles P5 = CInt(dist − radios); 0 sin tie) -->

Como [[.tieang]], mide siempre el lazo de [[.tiepres]], aunque escribas otro en
[[.tienum]]; y el padre, que ve el lazo de nacimiento con el puerto 0, lee 0
hasta tener otro lazo.

Sirve para controlar la forma de un organismo o para saber si te están
arrastrando: un lazo que se corta es uno que pasó los 1000 de borde a borde.

<!-- 34-TIES §1 (borrado por longitud > 1000 + radios) -->

```adn
' si el compañero quedó lejos, ir hacia él
cond
*.tielen 200 >
start
*.tieang .aimdx store
10 .up store
stop
```

Para fijar el largo está [[.fixlen]], y para medir los cuatro primeros lazos de
un multicelular, [[.tielen1]]…`.tielen4`.
