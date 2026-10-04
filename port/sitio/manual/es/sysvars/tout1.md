---
titulo: .tout1
resumen: "Primer canal de salida por lazo: el número que escribís acá lo lee en su .tin1 el bot atado a vos."
etiquetas: [comunicacion, lazos, tout, tin]
estado: revisada
---
`.tout1` es como [[.out1]], pero en vez de llegar a quien te mira llega a quien
está atado a vos: el motor copia tu `.tout1` en el [[.tin1]] del bot del otro
extremo del lazo, y él lo lee en el ciclo siguiente. Si no tenés lazos, no lo
lee nadie.
<!-- sysvars.yaml .tout1; 34-TIES §2 (readtie → ReadTRefVars en P1, después del ADN) -->

El motor no la borra: el valor queda publicado hasta que lo cambies. Un hijo nace
con `.tout1` en 0.
<!-- sysvars.yaml .tout1 (borra: no); 36-REPRO §2 (el hijo no hereda mem) -->

Hay una condición del lado del que escucha: cada bot lee **un solo lazo** por
ciclo, el que elige con [[.readtie]] o, si no eligió ninguno, el último que se
creó ([[.tiepres]]). Si estás atado a varios, tu `.tout1` solo le llega a los que
estén escuchando justamente el lazo que los une con vos.
<!-- 34-TIES §2 (readtie: tie readtie o, si vale 0, tiepres) -->

El caso más simple es el de padre e hijo: al nacer quedan atados por un lazo que
dura unos 100 ciclos, y los dos lo escuchan sin hacer nada. El hijo, eso sí,
recién recibe algo cuando su [[.robage]] llega a 3: antes, su `.tin1` vale 0.
Este bot publica su edad más 1000 y anota en la 50 lo que le llega del otro lado:

```adn
cond
*.robage 2 =
start
50 .repro store
stop

start
*.robage 1000 add .tout1 store
*.tin1 50 store
stop
```

El padre ve en `.tin1` la edad del hijo (más 1000) y el hijo la del padre,
siempre con un ciclo de atraso.
<!-- 34-TIES §1 (tie de nacimiento: last = 100), §2 (newage ≥ 2); comprobado con probar-adn: el padre lee 1000, 1001…; el hijo ve 0 con robage 0 a 2 -->

Hay diez canales iguales, de `.tout1` a [[.tout10]]; ver
[[sysvars/entradas-salidas]].
