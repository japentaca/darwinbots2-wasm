---
titulo: Ojos
resumen: "Los nueve ojos del bot, el ojo con foco y las celdas que apuntan y ensanchan cada ojo: cómo ve un bot y qué número le da cada ojo."
etiquetas: [ojos, visión, sentidos, focuseye]
estado: revisada
---
Un bot tiene nueve ojos, de [[.eye1]] a [[.eye9]], repartidos como un abanico
alrededor de hacia donde apunta ([[.aim]]). Cada ojo es una celda que el motor
llena en cada ciclo con un número: 0 si no ve nada, y más grande cuanto más
cerca está lo que ve. Es el sentido más usado de todos; casi cualquier bot que
busca comida o pelea empieza con algo como `*.eye5 0 >`. Cómo funciona la vista
por dentro lo cuenta [[simulacion/vision]].
<!-- 32-VISION §0.1, §1; sysvars.yaml .eye1 -->

## Dónde mira cada ojo {#geometria}

Por defecto cada ojo abarca 10 grados. [[.eye5]] mira justo adelante; los de
número más bajo miran a la izquierda y los más altos a la derecha, de a 10
grados: `.eye1` está centrado 40 grados a la izquierda y `.eye9` 40 a la
derecha. Entre los nueve cubren 90 grados. Un objeto grande o cercano puede
aparecer en varios ojos a la vez.
<!-- 32-VISION §0.2 -->

## Qué número dan {#valor}

El valor depende de la distancia entre los bordes y del alcance del ojo. Con
el ojo de fábrica, que llega a unas 1440 unidades:

| Distancia entre bordes | Valor |
|---|---|
| tocándose o encimados | 32000 |
| casi tocándose | unos 20700 |
| 134 | 100 |
| 278 | 25 |
| 710 | 4 |
| 1430 | 1 |

Cada ojo da el valor de lo más cercano que ve. De noche el alcance baja un 20%,
y en modo estanque se acorta con la profundidad.
<!-- 32-VISION §0.3, §0.4, §2.6 -->

## Configurar los ojos {#configurar}

Los ojos se pueden reapuntar con [[.eye1dir]]…[[.eye9dir]] y ensanchar con
[[.eye1width]]…[[.eye9width]]; un ojo más ancho ve menos lejos y da números más
chicos a la misma distancia. [[.focuseye]] elige cuál es el ojo con foco: su
valor se copia en [[.eyef]] y lo que él ve llena las celdas de
[[sysvars/ref|lo que se ve]]. Todas estas celdas de configuración quedan como
las dejás; alcanza con escribirlas una vez, por ejemplo en el primer ciclo:
<!-- 32-VISION §0.2, §0.4, §2.6; sysvars.yaml .focuseye .eye1dir .eye1width (persisten) -->

```adn
' ojo frontal un poco más ancho y foco en el ojo frontal
cond
*.robage 0 =
start
35 .eye5width store
0 .focuseye store
stop
```

Lo que ven los ojos llega con un ciclo de atraso: lo escribe el motor después
de mover a todos (ver [[adn/ejecucion#retraso]]).
<!-- 32-VISION §0.1 -->
