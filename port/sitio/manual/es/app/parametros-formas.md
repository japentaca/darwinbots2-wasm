---
titulo: "Parámetros: Formas (visión y deriva)"
resumen: "Cómo se llevan los obstáculos con la vista y los disparos de los bots, y si se mueven solos por el campo."
etiquetas: [formas, obstáculos, visión, deriva, laberintos, parámetros]
estado: revisada
---
<!-- opciones.js «Formas»; core vision.hpp (shapesAreVisable, shapesAreSeeThrough), shots.hpp DoShotObstacleCollisions, physics.hpp DriftObstacles/MoveObstacles/TrashCompactorMove; 50-MUNDO §4 -->

Las formas son los obstáculos rectangulares que se ponen en el mundo, sueltos o
en laberintos, desde la barra **Mundo** de Observar o desde los objetos del
escenario en Experimentar (ver [[simulacion/mundo#obstaculos]]). Para el cuerpo
de un bot son sólidas siempre, se configure como se configure: el que se mete en
una vuelve a quedar afuera (ver [[simulacion/fisica#formas]]). Lo que este grupo
decide es todo lo demás: si los
ojos las ven, si tapan lo que hay detrás, qué les pasa a los disparos que las
tocan y si se mueven.

Todos se pueden cambiar con la simulación corriendo, y sin formas en el mundo no
hacen nada.

## Ver y tapar {#vista}
<!-- 32-VISION §0.5, §3; simulacion/vision.md#formas -->

Las dos opciones de la vista se combinan así:

| | Tapan lo de atrás | No tapan ([[param:opt:81]]) |
|---|---|---|
| **Invisibles** (de fábrica) | Paredes fantasma: no se ven, pero esconden a los bots que están detrás. | No existen para la vista: los ojos ven a través y no las registran. |
| **Visibles** ([[param:opt:80]]) | Se ven como paredes y esconden lo de atrás. | Se ven, y también lo que hay detrás. |

La combinación de fábrica es la más rara: un bot escondido detrás de una pared
no aparece en ningún ojo, y la pared tampoco. Si querés que los bots aprendan a
esquivar paredes, encendé la visibilidad. Cómo mide el ojo una forma y qué
sentidos cambia está en [[simulacion/vision#formas]].

## La deriva {#deriva}
<!-- physics.hpp DriftObstacles: vel += Random(−r, r) × rnd × 0,01 por eje; bordes: re-arma ±r × 0,01 hacia adentro; tope invertido replicado; comprobado: forma de 500 con deriva horizontal y velocidad 20 → 25 unidades en 200 ciclos; con 2000 → 222 en 50; revisor: MoveObstacles re-arma solo con pos < −Width o pos > FieldWidth; forma de 300 en campo de 8000 con 85=2000 → x entre −300 y 8000, saltos de lado a lado -->

Con la deriva encendida, cada forma cambia su velocidad un poco al azar en cada
ciclo, de lado ([[param:opt:84]]), de arriba abajo ([[param:opt:83]]) o en las dos
direcciones; [[param:opt:85]] dice cuánto. Como lo que cambia al azar es la
velocidad y no la posición, el movimiento se acumula: la forma toma un rumbo y lo
va torciendo de a poco. Una forma puede salir del campo casi entera; cuando sale
del todo, el motor la deja justo afuera del borde y la hace volver a entrar
despacio.

:::cuidado
El tope de velocidad de las formas tiene un error del original que el port
conserva: una forma que pasa el tope de velocidad del mundo ([[param:opt:11]]),
en lugar de frenarse, se acelera. Con velocidades de deriva chicas no pasa
nunca; con valores de cientos o miles, las formas pueden salir disparadas de un
borde al otro.
:::

## Los laberintos que se mueven {#laberintos}
<!-- dbcore_api.cpp db_sim_maze_polar_ice (83=84=1, 85=20), db_sim_maze_trash_compactor (vel ±85 × 0,1); web2 ordenes.js DERIVA_POLAR; comprobado: escombros con 85=0 quietos en 200 ciclos, con 20 avanzan 400 -->

Dos laberintos de la barra **Mundo** usan estos parámetros:

- **Polar** enciende la deriva en los dos ejes y pone la velocidad en 20 al
  crearse. Es un cambio de opciones como cualquier otro: queda en el escenario y
  sigue aunque después borres las placas.
- **Escombros** mueve sus dos paredes a una velocidad de 0,1 × [[param:opt:85]]
  unidades por ciclo, aunque la deriva esté apagada. Con la velocidad en 0, que es
  el valor de fábrica, las paredes se quedan quietas: poné un valor antes de
  crear el laberinto (con 20 avanzan 2 unidades por ciclo).

:::parametro opt:80
<!-- vision.hpp:547 CompareShapes si shapesAreVisable -->
Encendido, los ojos registran las formas como registran a un bot: dan un valor
según la distancia al punto más cercano de la forma, y si lo más cercano en el ojo
con foco es una forma, [[.reftype]] vale 1. Apagado (de fábrica), los ojos no las
ven, y un bot se entera de una pared recién cuando choca ([[.hit]]). Ver
[[simulacion/vision#formas]].
:::

:::parametro opt:81
<!-- vision.hpp:181 if (!shapesAreSeeThrough) — sombras -->
Encendido, las formas no tapan: los ojos ven a los bots que están detrás. Apagado
(de fábrica), cada forma proyecta una sombra y lo que queda detrás no aparece en
ningún ojo, aunque la forma misma sea invisible. Combinado con [[param:opt:80]]
apagado, las formas desaparecen por completo de la vista.
:::

:::parametro opt:82
<!-- shots.hpp DoShotObstacleCollisions: absorbe → s.exist = false; si no, invierte el eje por el que entró -->
Encendido, un disparo que toca una forma desaparece, con su energía o su
contenido. Apagado (de fábrica), rebota: invierte la dirección por el lado por el
que entró, como una pelota contra una pared, y sigue viaje hasta agotar su
alcance. Con los rebotes, un bot puede recibir disparos que no vienen de donde
está el tirador. Ver [[simulacion/disparos]].
:::

:::parametro opt:84
<!-- DriftObstacles: eje x -->
Hace que las formas cambien al azar su velocidad de lado, ciclo a ciclo. Solo
mueve algo si [[param:opt:85]] es mayor que 0. No afecta a las paredes del
laberinto de escombros, que tienen su propio movimiento.
:::

:::parametro opt:83
<!-- DriftObstacles: eje y -->
Lo mismo que [[param:opt:84]], para la velocidad de arriba abajo. Con los dos
encendidos, las formas vagan en cualquier dirección.
:::

:::parametro opt:85
<!-- vel += Random(−r, r) × Rndy × 0,01; bordes ±r × 0,01; compactador ±r × 0,1 -->
Cuánto puede cambiar la velocidad de una forma en cada ciclo: como mucho una
centésima de este número, en cada eje con deriva. Con 20, el cambio es de 0,2 por
ciclo como máximo, y una forma tarda cientos de ciclos en moverse una distancia
apreciable. También fija la velocidad con la que una forma que salió del campo
vuelve a entrar (una centésima de este valor) y la de las paredes del laberinto
de escombros (una décima). Con 0, nada se mueve.
:::
