---
titulo: .dn
resumen: "Empuja al bot hacia atrás, en sentido contrario a donde apunta, sin darlo vuelta."
etiquetas: [movimiento, empuje, orden]
estado: revisada
---
<!-- sysvars.yaml .dn; 30-FISICA §2.1 -->
`.dn` es el empujón hacia atrás: mueve al bot en sentido contrario a [[.aim]] sin
girarlo, así que sigue mirando hacia adelante mientras retrocede. Funciona igual
que [[.up]] con el signo cambiado: el motor resta `.up − .dn` y empuja con lo que
queda, de modo que `30 .dn store` equivale a `-30 .up store`, y escribir lo mismo
en las dos se anula.

Como toda orden de movimiento, el motor la aplica en el mismo ciclo y la vuelve a
0; es una aceleración que se suma a la velocidad que traía el bot, con el mismo
tope ([[.maxvel]]) y el mismo costo que `.up`.

Sirve para alejarse de algo sin perderlo de vista, o para frenar: un bot que va
hacia adelante a [[.velup]] 20 y empuja `.dn` va perdiendo velocidad.

```adn
' si algo lo toca de frente, retrocede
cond
*.hitup 0 !=
start
30 .dn store
stop
```

<!-- sysvars.yaml (latencia por defecto); 10-CICLO §2 -->
[[.hitup]] se lee con un ciclo de atraso: el bot retrocede en el ciclo siguiente al
choque.
