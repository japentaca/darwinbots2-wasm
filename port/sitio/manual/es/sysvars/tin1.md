---
titulo: .tin1
resumen: "Primer canal de entrada por lazo: el valor que publica en su .tout1 el bot del otro extremo del lazo que estás leyendo."
etiquetas: [comunicacion, lazos, tin, tout]
estado: revisada
---
`.tin1` trae lo que tiene escrito en su [[.tout1]] el bot atado a vos. El motor
la actualiza en cada ciclo, después de tu ADN, así que lo que leés es lo que el
otro tenía publicado el ciclo anterior.
<!-- sysvars.yaml .tin1; 34-TIES §2 (readtie → ReadTRefVars en P1, después del ADN) -->

Se lee **un lazo por vez**: el que elegís con [[.readtie]] (por su número) o, si
`.readtie` vale 0, el último lazo creado, cuyo número está en [[.tiepres]]. Todas
las entradas por lazo (`.tin1` a `.tin10` y los sentidos [[sysvars/tref|tref*]])
vienen de ese mismo lazo. Para escuchar a otro compañero, cambiá `.readtie`.
<!-- 34-TIES §2 (readtie: tie readtie o, si vale 0, tiepres; ReadTRefVars carga trefvars y tin juntos) -->

A diferencia de [[.in1]], no se borra después de tu ADN: el motor la vuelve a
cargar en cada ciclo mientras el lazo exista. Vuelve a 0 cuando te quedás sin lazos o cuando no tenés
ninguno con el número que pide `.readtie`. Un recién nacido no recibe nada por el
lazo mientras su [[.robage]] vale 0, 1 o 2: ahí `.tin1` vale 0 aunque el padre
ya esté publicando. El valor llega tal cual: el ±1 al azar que aparece en los datos de
arriba es de un modo de evolución del programa original que este port no
incluye.
<!-- sysvars.yaml .tin1 (borra: EraseTRefVars si no hay ties o el puerto no existe); 34-TIES §2 (newage ≥ 2); el port no implementa el fudge (capa evo, 32-VISION §4); comprobado con probar-adn: el hijo ve 0 con robage 0 a 2 -->

Un uso posible: que un bot avise por el lazo lo que ve, para que el otro se
entere aunque esté mirando para otro lado.

```adn
' todos publican por el lazo lo que tienen adelante
start
*.eye5 .tout1 store
stop

' si el de al lado ve algo y yo no, guardo el aviso en la 50
cond
*.tin1 0 >
*.eye5 0 =
start
*.tin1 50 store
stop
```

Hay diez canales iguales, de `.tin1` a [[.tin10]]; ver
[[sysvars/entradas-salidas]].
