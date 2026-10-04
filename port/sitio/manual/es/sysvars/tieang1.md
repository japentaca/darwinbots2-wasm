---
titulo: .tieang1
resumen: "Ángulo del primer lazo de un multicelular respecto de hacia dónde apunta el bot (0 a 1256); escribirlo fija ese ángulo."
etiquetas: [lazos, multicelular, ángulo]
estado: revisada
---
Es una celda de ida y vuelta para el **primer lazo** del bot (el más antiguo que
le queda; si se corta uno, los siguientes corren un lugar), y solo funciona si el
bot es multicelular ([[.multi]]) y ese lazo está endurecido.

<!-- sysvars.yaml .tieang1 (bidi: store de dos operandos marca TieAngOverwrite; P3 publica el ángulo real ·200, 0..1256; solo multibot con tie 1 endurecida) -->

**Leer.** En cada ciclo el motor publica la dirección del compañero vista desde el
bot, en la escala de 1256 por vuelta y siempre positiva: 0 es adelante. Es el
mismo ángulo que [[.tieang]] con el signo cambiado y llevado al rango de 0 a
1256 (un `.tieang` de −300 es un `.tieang1` de 300), y la misma escala que usa
[[.fixang]]. Se publica antes de mover a los bots,
así que puede diferir un poco del ángulo final del ciclo.

<!-- port/core ties.hpp Update_Ties (tieang1 = angnorm(ángulo − aim)·200; .tieang = −AngDiff·200); 10-CICLO §2 (Update_Ties antes de UpdatePosition en P3); comprobado con probar-adn: .tieang −333 con .tieang1 333 -->

**Escribir.** Un valor escrito con [[op:store]] (o con otro store de dos
operandos, como [[op:addstore]]) fija el ángulo de ese lazo, igual que
[[.fixang]] pero sin tener que elegirlo con [[.tienum]]. Después el motor vuelve
a escribir la medición en la celda. Ojo: [[op:inc]], [[op:dec]] y los stores de
un operando cambian el número pero no le avisan al lazo (ver [[adn/stores]]).

<!-- 20-VM §7 (TieAngOverwrite solo en los stores de dos operandos) -->

Si el bot no es multicelular o el primer lazo no está endurecido, el motor no toca
la celda.

```adn
' hacer girar el primer lazo alrededor del bot
cond
*.multi 1 =
start
40 .tieang1 addstore
stop
```

El paso tiene que superar la holgura de 5 grados (unos 17) con la que el motor
sostiene el ángulo: con `10 .tieang1 addstore` el lazo no se mueve, porque cada
ciclo pedís 10 más que lo que mide y esa diferencia queda dentro de la holgura.

<!-- 30-FISICA §3.2 (holgura de 5°); comprobado con probar-adn: con 10 .tieang1 queda fijo; con 40 el lazo da vueltas (~23 por ciclo) -->

Los otros tres lazos tienen [[.tieang2]], [[.tieang3]] y [[.tieang4]]; el largo
se maneja con [[.tielen1]].
