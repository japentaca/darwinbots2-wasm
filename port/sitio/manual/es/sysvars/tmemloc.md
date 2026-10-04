---
titulo: .tmemloc
resumen: "Elige qué celda de la memoria del bot atado se copia en .tmemval."
etiquetas: [memoria, espionaje, lazos, configuracion]
estado: revisada
---
<!-- sysvars.yaml .tmemloc (persiste, reset comentado adrede); 21-MEMORIA §3; ejemplo comprobado con probar-adn -->
Es la dirección que el motor espía en el bot atado para llenar [[.tmemval]]. Como
[[.memloc]], es de configuración: no se borra nunca, ni siquiera cuando perdés el
lazo, así que alcanza con escribirla una vez. Solo valen las direcciones de 1 a
1000, sin ajuste de rango.

Además de reconocer especies, sirve para que las células de un organismo se lean
entre sí sin gastar canales: cada una deja su estado en una celda propia y la otra
la espía.

```adn
' Se reproduce a los 10 ciclos y espia la celda 61 del atado
cond
*.robage 10 =
start
50 .repro store
61 .tmemloc store
stop

' Todos anotan su edad en la celda 61
cond
start
*.robage 61 store
stop
```

Desde el ciclo siguiente al parto, el padre lee en `.tmemval` lo que su hijo anotó
en la celda 61 el ciclo anterior: 0, 1, 2… El hijo, en cambio, no espía nada: nace
con `.tmemloc` en 0, porque la memoria de un recién nacido arranca vacía.
Para mandar datos en vez de leerlos, están [[.tout1]] y [[.tieloc]].
