---
titulo: .aimsx
resumen: "Gira al bot hacia la izquierda (contra las agujas del reloj) la cantidad que escribas, en una escala donde 1256 es una vuelta completa."
etiquetas: [giro, orden, aim]
estado: revisada
---
<!-- sysvars.yaml .aimsx; 30-FISICA §7 (Mod 1256) -->
`.aimsx` gira al bot hacia su izquierda: en la pantalla, contra las agujas del
reloj, y [[.aim]] sube. 314 es un cuarto de vuelta y 628 media vuelta; un bot con
`.aim` 160 que escribe `314 .aimsx store` queda en 474. Los valores que pasan de
una vuelta dan la vuelta: 2000 es lo mismo que 744.

Es la gemela de [[.aimdx]]: el motor gira `.aimsx − .aimdx` en el mismo ciclo,
borra las dos y cobra energía en proporción al ángulo. Y vale la misma regla: si
en ese ciclo escribís en [[.setaim]] un rumbo distinto del actual, gana `.setaim` y
el giro relativo se descarta.

<!-- Bestiario: Anon_Terifica2_F1_PY_-14.04.04.txt -->
Lo típico es girar una cantidad fija ante un evento. _Anon Terifica 2_, del
Bestiario, gira así cada vez que toca el borde:

```adn
cond
*.edge 0 !=
start
100 .aimsx store
stop
```

Para girar hacia un rumbo concreto, en lugar de calcular la diferencia, es más
cómodo [[.setaim]].
