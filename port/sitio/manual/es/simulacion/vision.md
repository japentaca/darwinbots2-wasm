---
titulo: Visión
resumen: "Cómo ve un bot: los nueve ojos y su abanico, el alcance según el ancho, qué número da cada ojo, el ojo con foco que llena las ref*, las formas, el espionaje y los sentidos de contacto y de sabor."
etiquetas: [visión, ojos, focuseye, ref, sentidos, formas]
estado: revisada
---
<!-- 32-VISION completo; 10-CICLO §0.4; 21-MEMORIA §3; README del port, «Bugs del original corregidos» (A3-1, B2-1, B2-3, B2-4, B2-5) -->
Un bot no sabe nada del mundo salvo lo que le cuentan sus sentidos, y el más
importante es la vista. Esta página explica el mecanismo de conjunto: dónde
mira cada ojo, hasta dónde llega, qué número da, cómo se elige qué cosa se
describe en detalle y qué otros sentidos completan el cuadro. Las celdas una
por una están en la referencia: [[sysvars/ojos]], [[sysvars/ref]] y
[[sysvars/contacto]].

## Cuándo se mira {#cuando}
<!-- 32-VISION §0.1; 10-CICLO §0.4 (visión dentro de la pasada de acciones, posiciones finales) -->

La vista se calcula una vez por ciclo, en la fase de **acciones**, cuando el
movimiento ya terminó: cada bot mira el mundo con las posiciones finales del
ciclo. Tu ADN lee ese resultado al ciclo siguiente. Si girás ahora, lo que hay
en la nueva dirección lo ves recién en el próximo ciclo (ver
[[adn/ejecucion#retraso]]).

En cada pasada los nueve ojos vuelven a 0 y se llenan de nuevo, así que un
ojo nunca arrastra lo que vio antes. Los cadáveres no miran: sus ojos quedan
en 0 desde que mueren.

## Los nueve ojos {#ojos}
<!-- 32-VISION §0.2 -->

Cada bot tiene nueve ojos, de [[.eye1]] a [[.eye9]], abiertos en abanico
alrededor de su rumbo ([[.aim]]). De fábrica cada uno abarca 10 grados y
están pegados uno al lado del otro: [[.eye5]] mira justo adelante, los de
número bajo a la izquierda y los de número alto a la derecha.

| Ojo | `.eye1` | `.eye2` | `.eye3` | `.eye4` | `.eye5` | `.eye6` | `.eye7` | `.eye8` | `.eye9` |
|---|---|---|---|---|---|---|---|---|---|
| Centro | 40° izq. | 30° izq. | 20° izq. | 10° izq. | adelante | 10° der. | 20° der. | 30° der. | 40° der. |

```
                 adelante
        eye4  .   eye5   .  eye6
   eye3   .        |        .   eye7
eye2  .            |            .  eye8
eye1               bot               eye9
      <-- izquierda       derecha -->
```

Entre los nueve cubren 90 grados; lo que queda detrás y a los costados es un
punto ciego. Como los ojos se miden hasta el _borde_ de lo que ven, un bot
grande o muy cercano ocupa varios ojos a la vez.

Los ojos giran con el bot. Pero cada uno se puede reapuntar con
[[.eye1dir]]…[[.eye9dir]] y ensanchar con [[.eye1width]]…[[.eye9width]]. Las
dos se miden en las unidades de `.aim`: 1256 es una vuelta, así que 35 son
unos 10 grados. Un `dir` positivo corre el ojo a la izquierda y uno negativo a
la derecha; el `width` se suma a los 10 grados de fábrica. El motor nunca borra
estas celdas: alcanza con escribirlas una vez.
<!-- 32-VISION §0.2 (dir/200 rad, width/400 + π/36 de semiancho); sysvars.yaml eye1dir/eye1width (persisten) -->

_Beholder_, de Welwordion (en el Bestiario), abre el abanico en su primer
ciclo: corre cada ojo 105 unidades más que su vecino (de 420 en `.eye1dir` a
−420 en `.eye9dir`) y les pone 105 de ancho a todos. Quedan nueve ojos de
unos 40 grados, separados 40 grados: entre todos cubren la vuelta entera, a
cambio de ver solo hasta unas 940 unidades.
<!-- Beholder_F3_Welwordion_28-10-08.txt; alcance 1440·(1 − ln(140/35)/4) ≈ 941 -->

## Hasta dónde llega un ojo {#alcance}
<!-- 32-VISION §0.4 (1440·(1 − ln(w/35)/4)·eyestrength; noche ×0,8; pondmode por profundidad, nunca amplifica) -->

Un ojo de fábrica ve hasta unas 1440 unidades, medidas de borde a borde. El
alcance depende del ancho: cuanto más ancho el ojo, menos lejos llega. Un ojo
de 20 grados llega a unas 1190, uno de 100 grados a unas 610 y uno que da la
vuelta entera, a unas 150. La tabla completa está en [[.eye1width]].

Dos ajustes del mundo lo recortan, nunca lo estiran:

- **La noche.** Mientras es de noche ([[param:opt:41]] apagado, ya sea por el
  reloj de [[param:opt:33]] o por los umbrales de energía; ver
  [[simulacion/cloroplastos#dia-y-noche]]), todos los ojos ven un 20 % menos.
- **El estanque.** En modo estanque ([[param:opt:30]]) la vista se apaga con
  la profundidad: cuanto más abajo está el bot, menos lejos ve. Cuánto depende
  del gradiente ([[param:opt:32]]).

## Qué número da un ojo {#valor}
<!-- 32-VISION §0.3 (1/percentdist², percentdist = (dist + 10)/alcance, clamp 32000, solape = 32000), §2.6 -->

Un ojo vale 0 si no ve nada. Si ve algo, da un número que crece al acercarse:
1 en el límite de su alcance, 100 a una décima de él, y 32000 cuando lo que ve
está tocando o encimado al bot. La cuenta es el inverso del cuadrado de la
distancia, medida como fracción del alcance de _ese_ ojo, así que el número
sube de golpe en la última parte del camino. Con el ojo de fábrica:

| Distancia de borde a borde | Valor |
|---|---|
| 1430 | 1 |
| 710 | 4 |
| 278 | 25 |
| 134 | 100 |
| hacé clic enndose | 32000 |

Si un ojo tiene varias cosas en su campo, da el valor de la más cercana: los
bots no se tapan entre sí, pero el ojo solo informa del primero.

Como la escala es relativa al alcance, un ojo ancho da números más chicos a la
misma distancia. Si tu ADN compara contra un umbral fijo, como
`*.eye5 100 >`, el umbral cambia de sentido cuando cambiás el ancho del ojo.

El ojo ve todo lo que es un bot: los de tu especie, los de otras, los
vegetales y los cadáveres. El número no dice qué es; para eso están las `ref*`.

## Ejemplo: guiarse con el abanico {#abanico}

Este bot usa los ojos de los costados para saber hacia qué lado girar y el
frontal para saber cuándo tiene algo enfrente. Gira de a 35, que es justo un
ojo: lo que veía [[.eye4]] pasa a [[.eye5]] en el ciclo siguiente.

```adn
' Nada a la vista: girar a la derecha buscando
cond
 *.eye1 *.eye2 add *.eye3 add *.eye4 add *.eye5 add
 *.eye6 add *.eye7 add *.eye8 add *.eye9 add 0 =
start
 70 .aimdx store
stop

' Lo veo mas por la izquierda: girar hacia alla
cond
 *.eye5 0 =
 *.eye1 *.eye2 add *.eye3 add *.eye4 add
 *.eye6 *.eye7 add *.eye8 add *.eye9 add >
start
 35 .aimsx store
stop

' Lo veo mas por la derecha
cond
 *.eye5 0 =
 *.eye6 *.eye7 add *.eye8 add *.eye9 add
 *.eye1 *.eye2 add *.eye3 add *.eye4 add >
start
 35 .aimdx store
stop
```

Corriéndolo frente a un bot quieto, gira hasta que el otro entra por
[[.eye9]], corrige tres veces hacia la derecha y queda con él en el ojo
frontal, sin moverse más. Si el otro está fuera del alcance, sigue dando
vueltas para siempre.
<!-- probado: centra.txt contra quieto.txt, semillas 1 y 7 (centra); semilla 4 (fuera de alcance, gira sin parar) -->

## Ejemplo: un ojo para detectar, otro para apuntar {#ancho}

Un ojo ancho detecta en todas direcciones pero de cerca; uno angosto ve lejos
pero en una franja. Este bot abre [[.eye1]] a la vuelta entera (1221 de ancho:
unas 150 unidades de alcance) y gira solo cuando ese ojo avisa que hay algo
cerca y el frontal todavía no lo tiene:

```adn
' Ojo 1 panoramico, una sola vez
cond
 *.robage 0 =
start
 1221 .eye1width store
stop

' Algo cerca, pero no adelante: girar de a 10 grados
cond
 *.eye1 0 >
 *.eye5 0 =
start
 35 .aimdx store
stop

' Guardar en 50 lo que ve el ojo frontal
cond
 *.eye5 0 >
start
 *.eye5 50 store
stop
```

En la prueba, con un bot al lado, `.eye1` marcaba 5 y el bot giró hasta que
`.eye5` lo encontró: el frontal lo vio con 476. Es el mismo bot a la misma
distancia; la diferencia es solo la escala de cada ojo.
<!-- probado: radar.txt contra quieto.txt, campo 600x600, semilla 2 (eye1 5, eye5 476) -->

## El ojo con foco y lo que se ve del otro {#foco}
<!-- 32-VISION §2.6 (lastopp = el de mayor eyevalue en el ojo con foco; Abs(x+4) Mod 9), §4; core senses.hpp lookoccurr -->

Los ojos solo dicen _qué tan cerca_ hay algo. Para saber _qué_ es, uno de los
nueve es el **ojo con foco**: [[.eye5]] de fábrica, o el que elijas con
[[.focuseye]] (−4 es `.eye1`, 4 es `.eye9`). Dos cosas salen de él:

- Su número se copia en [[.eyef]].
- Lo más cercano que ve queda descrito en las celdas `ref*`
  ([[sysvars/ref]]). Si el ojo con foco no ve nada, todas valen 0, aunque otro
  ojo esté viendo algo.

Lo que se sabe del otro bot:

| Qué | Celdas |
|---|---|
| La firma de su ADN: cuántas veces escribe ciertas sysvars y lee sus ojos | [[.refup]], [[.refdn]], [[.refsx]], [[.refdx]], [[.refaimdx]], [[.refaimsx]], [[.refshoot]], [[.refeye]], [[.reftie]] |
| Su estado | [[.refnrg]], [[.refbody]], [[.refshell]], [[.refage]], [[.refkills]], [[.refpoison]], [[.refvenom]], [[.refmulti]], [[.reffixed]] |
| Dónde está y cómo se mueve respecto de vos | [[.refxpos]], [[.refypos]], [[.refaim]], [[.refvel]], [[.refveldn]], [[.refveldx]], [[.refvelsx]], [[.refvelscalar]] |
| Qué es | [[.reftype]]: 0 un bot, 1 una forma |
| Lo que publica | [[.in1]]…[[.in10]], copia de sus [[.out1]]…[[.out10]] |

La firma es lo que permite reconocer a la propia especie: dos bots con el
mismo ADN tienen la misma, así que comparar [[.refeye]] con tu [[.myeye]] es
la prueba clásica (el paso a paso, en [[tutoriales/reconoce-especie]]). Un
cadáver se ve como cualquier bot, pero su firma llega en 0, igual que su
energía; su cuerpo, en cambio, es el real, así que se lo puede encontrar para
comerlo.
<!-- 32-VISION §2 notas (corpses: occurr borrado, refnrg/refbody reales) -->

La posición del otro es la que el motor publicó para él en su propia pasada,
que según el orden en que recorre a los bots puede ser la de este ciclo o la
del anterior.
<!-- 32-VISION §4 (refxpos de mem 219/217 del visto; asimetría por índice) -->

:::nota
En el DarwinBots 2.48.32 original, [[.refvelsx]] valía siempre 0. Esta versión
la corrige: es [[.refveldx]] con el signo cambiado, como [[.refveldn]] lo es
de [[.refvel]].
:::

## Espiar la memoria del otro {#espionaje}
<!-- 32-VISION §4; sysvars.yaml memloc/memval; core senses.hpp lookoccurr (memloc 1..1000) -->

Además de las `ref*`, se puede leer cualquier celda del bot que tiene el ojo
con foco. Escribís en [[.memloc]] una dirección entre 1 y 1000, y en cada
ciclo el motor copia en [[.memval]] lo que esa celda vale en el otro. Sirve
para mirar sus sysvars o sus variables privadas, por ejemplo una contraseña de
especie:

```adn
' Una sola vez: espiar la celda 61 del que tenga en el foco
cond
 *.memloc 0 =
start
 61 .memloc store
stop

' Buscar girando
cond
 *.eye5 0 =
start
 35 .aimdx store
stop

' Si su celda 61 vale 7, es de los mios: anotarlo en la 50
cond
 *.eye5 0 >
 *.memval 7 =
start
 1 50 store
stop
```

Frente a un bot que guarda 7 en su celda 61, este bot lo encontró girando,
leyó 7 en `.memval` y anotó el 1. Para espiar a un bot atado por un lazo, la
pareja es [[.tmemloc]] y [[.tmemval]] (ver [[sysvars/lazos]]).
<!-- probado: espia.txt contra quieto.txt (memval 7, 50 = 1) -->

## Ver formas {#formas}
<!-- 32-VISION §0.5, §3; README B2-1, B2-3, B2-4, B2-5; opciones opt:80, opt:81 -->

Las formas son los obstáculos rectangulares que se pueden poner en el mundo
(ver [[simulacion/mundo]]). Dos opciones deciden cómo se llevan con la vista:

| Opción | Apagada (de fábrica) | Encendida |
|---|---|---|
| Los bots ven las formas ([[param:opt:80]]) | los ojos no las registran | los ojos las ven como a un bot |
| Transparentes a la vista ([[param:opt:81]]) | una forma tapa a los bots que tiene detrás | se ve a través de ellas |

Fijate en la combinación de fábrica: las formas son invisibles pero tapan. Un
bot escondido detrás de una pared no aparece en ningún ojo, y la pared
tampoco.

Cuando las formas son visibles, el ojo mide hasta el punto más cercano de la
forma, con la misma escala que para un bot. Si lo más cercano en el ojo con
foco es una forma, [[.reftype]] vale 1, la posición y la velocidad describen
la forma, [[.reffixed]] dice si está quieta y todo lo demás llega en 0. Un bot
que queda metido dentro de una forma ve 32000 en los nueve ojos y en
[[.eyef]].

:::nota
En el original esta parte tenía varios errores, que esta versión corrige: la
sombra de una forma no coincidía con la forma (estaba girada y tapaba de más),
el ancho de los ojos se calculaba distinto para formas que para bots, `.eyef`
no subía a 32000 dentro de una forma y la posición de la forma solo era
correcta si el ojo con foco era el frontal.
:::

## Contacto {#contacto}
<!-- 32-VISION §5 (touch, sectores); 30-FISICA §4.3 (Repel3, lookoccurr en colisión), §4.4 (obstáculos); sysvars.yaml hit* -->

El tacto no depende de los ojos. En la fase de **fuerzas y choques**, cuando
un bot se encima con otro (vivo, vegetal o cadáver) o con una forma, el motor
enciende [[.hit]] y una de cuatro direcciones según dónde está lo que lo tocó,
respecto de su rumbo:

| Lado | Ángulo desde el frente | Choque | Disparo |
|---|---|---|---|
| frente | menos de 45° a cada lado | [[.hitup]] | [[.shup]] |
| derecha | de 45° a 135° | [[.hitdx]] | [[.shdx]] |
| atrás | de 135° a 225° | [[.hitdn]] | [[.shdn]] |
| izquierda | de 225° a 315° | [[.hitsx]] | [[.shsx]] |

Un choque con otro bot hace algo más: llena las `ref*` con los datos del bot
tocado, en los dos sentidos. Como la vista se calcula después, si el ojo con
foco ve algo, las `ref*` describen eso; si no ve nada, describen al que lo
chocó, aunque haya venido por detrás. Así, un bot que no ve nada igual
reconoce a quien lo toca. Si choca con una forma sin ver nada, [[.reftype]] queda en 1.
El borde del mundo no cuenta como choque: para eso está [[.edge]].

## El sabor de los disparos {#sabor}
<!-- 32-VISION §5 (taste desde updateshots: shflav = tipo, shang = dang·200); 33-SHOTS §3.4 -->

Cuando a un bot le pega un disparo, en la fase de **los disparos**, siente
dos cosas: qué era y de dónde vino.

- [[.shflav]] es el «sabor»: el tipo del disparo, el mismo número que el
  tirador puso en su [[.shoot]] (−1 roba energía, −3 es veneno, y así).
- [[.shang]] es el ángulo de llegada, de 0 a 1256, medido desde el frente
  hacia la derecha. Copiado en [[.aimdx]], deja al bot mirando al tirador.
- Las cuatro de dirección de la tabla de arriba ([[.shup]] y compañía) guardan
  el tipo del disparo en el lado por el que entró.

Si le pegan varios en el mismo ciclo, queda el último. Los detalles, incluida
la trampa de que un cazador también saborea sus propias ganancias, están en
[[sysvars/disparos]] y en [[simulacion/disparos]].

## Cuánto dura cada sentido {#duracion}
<!-- 21-MEMORIA §3 (régimen A: escritos tras el ADN, borrados en «se borran los sentidos»); sysvars.yaml -->

Todos estos sentidos se escriben después de que corrió tu ADN y se leen en el
ciclo siguiente. Las `ref*`, [[.memval]], las `in*`, el tacto y el sabor se
borran en la fase de **se borran los sentidos**, justo después de tu ADN: si
no los usás en ese ciclo, se pierden. La configuración ([[.focuseye]],
[[.memloc]], los `dir` y los `width`) queda como la dejaste.
