---
titulo: .eye1
resumen: "El ojo centrado 40 grados a la izquierda del frente: vale 0 si no ve nada y más cuanto más cerca está lo que ve."
etiquetas: [ojos, visión, sentidos]
estado: revisada
---
Uno de los nueve [[sysvars/ojos|ojos]] del bot. Con la configuración de fábrica
mira 40 grados a la izquierda de [[.aim]], con un campo de 10 grados.
Es el ojo de más a la izquierda. Vale 0 si no ve nada, y si ve algo, un número que crece al acercarse:
1 en el límite del alcance, 100 a unas 134 unidades de borde a borde y 32000
cuando se tocan (la tabla está en [[sysvars/ojos#valor]]).
<!-- 32-VISION §0.2, §0.3; sysvars.yaml .eye1 -->

Como todos los ojos, lo escribe el motor al final del ciclo, así que lo que leés
es lo que se veía después del último movimiento. Se puede apuntar a otro lado
con [[.eye1dir]] y ensanchar con [[.eye1width]]; si lo ensanchás, ve menos
lejos y da números más chicos a la misma distancia.
<!-- 32-VISION §0.1, §0.4 -->

Con los ojos de fábrica, lo que queda entero a más de 45 grados a la izquierda no lo ve ningún ojo. Por eso es el candidato natural para reapuntarlo hacia el costado o la espalda.

Un uso típico de los ojos laterales es girar hacia lo que ven para ponerlo
delante de [[.eye5]]. 40 grados son unas 140 unidades de [[.aimsx]]:

```adn
' algo a la izquierda y nada adelante: girar hacia eso
cond
*.eye1 0 >
*.eye5 0 =
start
140 .aimsx store
stop
```
