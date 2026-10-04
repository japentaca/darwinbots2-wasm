---
titulo: .setaim
resumen: "Gira al bot hasta un rumbo absoluto: escribís hacia dónde querés que apunte y el motor lo pone ahí en el mismo ciclo."
etiquetas: [giro, orden, rumbo, aim]
estado: revisada
---
<!-- sysvars.yaml .setaim; 30-FISICA §7 -->
`.setaim` es el giro absoluto: escribís el rumbo que querés, en la misma escala que
[[.aim]] (0 a la derecha de la pantalla, 314 arriba, 1256 una vuelta), y el bot
queda apuntando ahí al final del ciclo, por grande que sea el giro. Cualquier
número sirve: se toma su resto de dividir por 1256, así que -314 es 942 y 1570
es 314. El giro cuesta energía según el ángulo recorrido.

El motor no la borra a 0: después de girar al bot le copia el rumbo actual. Por eso
`*.setaim` siempre se puede leer como el rumbo del bot, y en el primer ciclo de
vida es más fiable que `*.aim`, que todavía vale 0.

:::cuidado
Lo que decide es si el valor _difiere_ del rumbo actual. Si escribís un rumbo
distinto, manda `.setaim` y lo que pongas en [[.aimsx]] y [[.aimdx]] ese ciclo se
ignora. Si escribís exactamente el rumbo actual, `.setaim` no hace nada y sí se
aplican `.aimsx` y `.aimdx`. Un gen que escribe siempre `314 .setaim store` y otro
que escribe `50 .aimsx store` hacen oscilar al bot entre 314 y 364.
:::

El uso clásico es girar relativo al rumbo actual sumándole algo, o apuntar a lo
que ve combinando [[.refxpos]] y [[.refypos]] con su posición. Este bot gira de a
100 por ciclo leyendo el rumbo en la propia `.setaim`:

```adn
cond
start
*.setaim 100 add .setaim store
stop
```
