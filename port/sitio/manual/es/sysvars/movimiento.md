---
titulo: Movimiento
resumen: "Las sysvars para empujar al bot, girarlo, saber hacia dónde apunta y a qué velocidad va, y dejarlo anclado en un lugar."
etiquetas: [movimiento, giro, velocidad, física]
estado: revisada
---
<!-- 30-FISICA §2.1, §6, §7; sysvars.yaml .up .aimsx .setaim -->
Un bot no camina: se empuja. Las cuatro órdenes de movimiento, [[.up]], [[.dn]],
[[.sx]] y [[.dx]], son empujones hacia adelante, hacia atrás, a la izquierda y a la
derecha, siempre medidos desde donde apunta el bot. El motor las aplica en el mismo
ciclo y las deja en 0, así que para seguir empujando hay que escribirlas cada ciclo.
Cada empujón se suma a la velocidad que ya traía: es una aceleración, no una
velocidad.

Para girar hay dos caminos. [[.aimsx]] y [[.aimdx]] giran _tanto_ hacia la izquierda
o la derecha; [[.setaim]] gira _hasta_ un rumbo absoluto. El rumbo actual se lee en
[[.aim]]. Los ángulos se miden en una unidad propia: una vuelta completa son 1256,
así que 314 es un cuarto de vuelta. 0 mira a la derecha de la pantalla, 314 hacia
arriba, 628 a la izquierda y 942 hacia abajo.

<!-- sysvars.yaml .velup .velscalar .maxvel .fixpos -->
Las de velocidad cuentan cómo se movió el bot en el último ciclo: [[.velup]] y
[[.veldn]] hacia adelante y atrás, [[.veldx]] y [[.velsx]] de costado, y
[[.velscalar]] la rapidez total. [[.maxvel]] dice el tope que impone la simulación.
Por último, [[.fixpos]] clava al bot en su lugar y [[.fixed]] informa si está anclado.

<!-- probado: el ejemplo sale del borde y sigue -->
Las más usadas son `.up` y `.setaim`: apuntar y avanzar. Este bot avanza siempre
y, mientras está contra el borde del mundo (lo avisa [[.edge]]), gira un poco en
cada ciclo hasta despegarse:

```adn
cond
start
20 .up store
stop

cond
*.edge 0 !=
start
100 .aimsx store
stop
```

El costo de moverse y de girar depende de la configuración de la simulación (ver
[[adn/ejecucion#costos]]), y la física completa está en [[simulacion/fisica]].
