---
titulo: .eye7
resumen: "El ojo centrado 20 grados a la derecha del frente: vale 0 si no ve nada y más cuanto más cerca está lo que ve."
etiquetas: [ojos, visión, sentidos]
estado: revisada
---
Uno de los nueve [[sysvars/ojos|ojos]] del bot. Con la configuración de fábrica
mira 20 grados a la derecha de [[.aim]], con un campo de 10 grados.
Queda entre [[.eye6]] y [[.eye8]]. Vale 0 si no ve nada, y si ve algo, un número que crece al acercarse:
1 en el límite del alcance, 100 a unas 134 unidades de borde a borde y 32000
cuando se tocan (la tabla está en [[sysvars/ojos#valor]]).
<!-- 32-VISION §0.2, §0.3; sysvars.yaml .eye7 -->

Como todos los ojos, lo escribe el motor al final del ciclo, así que lo que leés
es lo que se veía después del último movimiento. Se puede apuntar a otro lado
con [[.eye7dir]] y ensanchar con [[.eye7width]]; si lo ensanchás, ve menos
lejos y da números más chicos a la misma distancia.
<!-- 32-VISION §0.1, §0.4 -->

Un uso típico de los ojos laterales es girar hacia lo que ven para ponerlo
delante de [[.eye5]]. 20 grados son unas 70 unidades de [[.aimdx]]:

```adn
' algo a la derecha y nada adelante: girar hacia eso
cond
*.eye7 0 >
*.eye5 0 =
start
70 .aimdx store
stop
```
