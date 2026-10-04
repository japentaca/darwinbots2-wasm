---
titulo: .aimshoot
resumen: "Desvía el próximo disparo un ángulo respecto de tu frente, sin girar: positivo hacia la derecha, negativo hacia la izquierda."
etiquetas: [disparos, puntería, acción]
estado: revisada
---
<!-- 33-SHOTS §2.2; sysvars.yaml 901 (Mod 1256 en la celda); core shots.hpp newshot (aim - aimshoot/200); probado: a140.txt (140 le pega a lo que ve el eye9), a-140.txt -->
`.aimshoot` hace que el próximo disparo no salga derecho hacia adelante sino
desviado un ángulo, medido en las mismas unidades que [[.aimdx]] (1256 son
una vuelta completa). Positivo desvía hacia la derecha y negativo, hacia la
izquierda, igual que girar con `.aimdx`. La diferencia es que tu cuerpo no
gira: seguís mirando para el mismo lado.

Combina muy bien con los ojos laterales. Cada ojo está corrido unos 35
(10 grados) respecto del vecino: [[.eye9]], el de más a la derecha, mira unos
140 a la derecha de tu frente, y [[.eye1]], 140 a la izquierda. Así se le
dispara a lo que ve un costado sin dejar de mirar al frente:

```adn
cond
*.eye9 0 >
start
140 .aimshoot store
-1 .shoot store
stop
```

En la prueba, un bot que tenía a su blanco solo en el `.eye9` le pegó con
140 y no con −140.

El motor la reduce a menos de una vuelta (módulo 1256) y la vuelve a 0 cuando
sale el disparo; si no disparás, queda puesta para el próximo. Si además
escribiste [[.backshot]], gana `.aimshoot`. El tiro conserva la pequeña
desviación al azar de todo disparo (ver [[.shoot]]).
