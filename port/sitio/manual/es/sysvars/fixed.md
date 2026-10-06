---
titulo: .fixed
resumen: "Vale 1 si el bot está anclado en su lugar y 0 si se puede mover."
etiquetas: [fijo, sentido, movimiento]
estado: revisada
---
<!-- sysvars.yaml .fixed (WriteSenses P5) y .fixpos (ManageFixed P1, DisableFixing) -->
`.fixed` es el informe de [[.fixpos]]: 1 si el bot está anclado y 0 si está libre. La
publica el motor al final de cada ciclo, así que escribir en ella no fija ni
libera nada; para eso hay que escribir en `.fixpos`.

La diferencia entre las dos importa. `.fixpos` es la orden y queda con el número
que le pusiste; `.fixed` dice si el bot quedó efectivamente anclado. Si la simulación
tiene desactivada la fijación, `.fixpos` puede valer 1 y `.fixed` seguir en 0.
Además `.fixed` se actualiza al final del ciclo: el ciclo en que escribís en
`.fixpos` todavía leés el estado anterior.

<!-- Bestiario: Anon_Terifica_daynight_F1_PY_-20.04.04.txt -->
Un uso típico es evitar escrituras repetidas, como hace _Anon Terifica daynight_,
del Bestiario, que se clava de noche y se suelta de día:

```adn
cond
*.daytime 1 =
*.fixed 1 =
start
0 .fixpos store
stop

cond
*.daytime 0 =
*.fixed 0 =
start
1 .fixpos store
stop
```
