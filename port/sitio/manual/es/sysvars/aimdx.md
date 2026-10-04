---
titulo: .aimdx
resumen: "Gira al bot hacia la derecha (en el sentido de las agujas del reloj) la cantidad que escribas, en una escala donde 1256 es una vuelta completa."
etiquetas: [giro, orden, aim]
estado: revisada
---
<!-- sysvars.yaml .aimdx; 30-FISICA §7 -->
`.aimdx` gira al bot hacia su derecha. El número es el ángulo: 1256 es una vuelta
entera, 314 un cuarto de vuelta, y unos 3,5 equivalen a un grado. En la pantalla
el giro va en el sentido de las agujas del reloj, así que [[.aim]] baja: un bot con
`.aim` 160 que escribe `100 .aimdx store` queda en 60.

El motor aplica el giro en el mismo ciclo, en la fase de movimiento, y deja la
celda en 0. Su opuesta es [[.aimsx]]: el motor gira `.aimsx − .aimdx`, así que un valor
negativo gira hacia la izquierda. El giro cuesta energía en proporción al ángulo
(ver [[adn/ejecucion#costos]]).

:::cuidado
Si en el mismo ciclo escribís en [[.setaim]] un rumbo distinto del actual, manda
`.setaim` y lo que hayas puesto en `.aimdx` y `.aimsx` se ignora.
:::

<!-- 30-FISICA §2.1 (VoluntaryForces en P1 usa el rumbo previo) y §7 (SetAimFunc en P3) -->
Como el empujón de [[.up]] se calcula con el rumbo de _antes_ del giro, un bot que
gira y avanza en el mismo ciclo sale con el rumbo viejo y recién en el siguiente
avanza hacia el nuevo.

```adn
' barre el entorno girando de a poco mientras no ve nada
cond
*.eye5 0 =
start
50 .aimdx store
stop
```
