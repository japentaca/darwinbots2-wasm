---
titulo: .tieang
resumen: "Hacia dónde está el lazo de .tiepres visto desde el bot: 0 si apunta justo al compañero, con signo según el lado."
etiquetas: [lazos, tie, ángulo, sentidos]
estado: revisada
---
Es el ángulo entre hacia dónde apunta el bot ([[.aim]]) y la dirección del bot
atado, en la escala de 1256 por vuelta: 0 es que lo tenés justo adelante, y el
valor va de −628 a 628 según de qué lado y cuánto haya que girar. Lo publica el
motor al final de cada ciclo, así que lo leés con un ciclo de atraso. Vale 0 si
no hay lazo.

<!-- sysvars.yaml .tieang (UpdateTieAngles P5 = −AngDiff·200, ±628; 0 sin tie) -->

Mide siempre el lazo de [[.tiepres]], aunque escribas otro en [[.tienum]] (ver
esa página). Por eso el padre, que ve el lazo de nacimiento con el puerto 0, lee
0 acá hasta que tenga otro lazo.

<!-- port/core ties.hpp UpdateTieAngles (tienum ya en 0 tras Update_Ties P3; whichTie = 0 → sale) y robots.hpp Reproduce (puerto 0 del padre) -->

El signo está pensado para girar: escribir el valor en [[.aimdx]] deja al bot
mirando hacia el compañero.

<!-- comprobado con probar-adn: tras 300 .aimdx el hijo lee .tieang −300 y con *.tieang .aimdx store vuelve a 0 -->

```adn
' girar hacia el bot atado
cond
*.numties 0 >
start
*.tieang .aimdx store
stop
```

Su pareja es [[.tielen]]. Para los cuatro primeros lazos de un multicelular están
[[.tieang1]]…`.tieang4`, que usan otra escala (de 0 a 1256).
