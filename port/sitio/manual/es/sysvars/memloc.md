---
titulo: .memloc
resumen: "Elige qué celda de la memoria del bot que ves se copia en .memval."
etiquetas: [memoria, espionaje, vista, configuracion]
estado: revisada
---
<!-- sysvars.yaml .memloc (persiste; útil 1..1000); 21-MEMORIA §3 (configuración persistente); 20-VM §7 (el ajuste de dirección es del store, no de memloc); comprobado con probar-adn (1061 no espía la 61) -->
Es una sysvar de configuración: escribís una dirección y el motor la usa en cada
ciclo para llenar [[.memval]] con lo que tiene esa celda en el bot que estás
viendo. No se borra nunca, así que alcanza con escribirla una vez, por ejemplo con
un gen que corre solo mientras valga 0.

Solo sirven las direcciones de 1 a 1000. A diferencia de un store, acá no hay ajuste
al rango: con `1061 .memloc store` la celda guarda 1061 y `.memval` queda en 0, no
espía la 61.

```adn
' Una sola vez: espiar el largo del ADN del bot que veo
cond
*.memloc 0 =
start
.dnalen .memloc store
stop
```

Fijate que `.dnalen` va sin asterisco: lo que se guarda es la _dirección_ de
[[.dnalen]] (la 336), no su valor. Con eso, `*.memval *.dnalen =` pregunta si el bot
que ves tiene tu mismo largo de ADN. Podés espiar cualquier celda: una sysvar del
otro, como su [[.eye5]], o una de sus variables privadas. Para espiar por un lazo,
usá [[.tmemloc]].
