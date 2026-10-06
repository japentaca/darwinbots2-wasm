---
titulo: Enjambres
resumen: "Muchos bots chicos y baratos en vez de uno grande: tres manadas del Bestiario que se alinean por la vista, se siguen por contraseña o se pasan la alarma de boca en boca, sin jefe alguno."
etiquetas: [enjambre, manada, out1, in1, alineacion, bestiario]
estado: revisada
---
Después de los tutoriales te queda un bot que es una unidad: ve, persigue,
dispara y se divide. La idea de un enjambre es la contraria: en vez de un bot
grande y caro, muchos chicos y baratos que hacen todos lo mismo. Cada copia
es prescindible; la manada, no. Esta página disecciona tres enjambres del
Bestiario con tres formas distintas de juntarse — por la vista, por
contraseña y por avisos — y muestra qué gana y qué paga cada una.

## Qué gana y qué paga {#costos}

Lo primero que gana un enjambre es cobertura. Un bot solo, con los ojos de
fábrica, cubre 90 grados ([[simulacion/vision#ojos]]); veinte copias repartidas
cubren veinte campos distintos, y la primera que encuentra comida arrastra al
resto. Además un bot chico es un blanco chico: los ojos miden de borde a borde,
así que a la misma distancia un cuerpo menudo da números más bajos y se detecta
más tarde ([[simulacion/vision#valor]]).
<!-- 32-VISION §0.2 (abanico de 90°), §0.3 (1/percentdist², dist de borde a borde) -->

Lo segundo es la resiliencia. Un depredador puede asesinar a un bot; no puede
asesinar a treinta sin que mientras tanto alguno se divida. Reproducirse es
barato en sí: [[.repro]] reparte un porcentaje de energía y de cuerpo, así que
`10 .repro` fabrica un hijo chico y `50 .repro`, uno que nace con la mitad de
todo ([[simulacion/reproduccion#reparto]]). La manada que pierde veinte
miembros vuelve de la mano de los diez que quedan.
<!-- 36-REPRO §0.5 (per Mod 100), §2 (el hijo lleva el mismo % de nrg y body) -->

Y lo que paga. Cada bot vivo cobra mantenimiento por ciclo: una cuota por
punto de cuerpo y otra por cada instrucción del ADN
([[simulacion/energia#mantenimiento]]). Diez copias pagan diez veces la cuota
del genoma entero; y cada parto, aparte del impuesto, paga su copia del ADN
([[param:cost:25]]). Con los costos en 0, como arranca la app, vivir es
gratis; con las reglas F1, cada miembro extra pesa.
<!-- 31-ENERGIA §1 (Upkeep: body·BODYUPKEEP + (DnaLen−1)·DNACYCCOST); 36-REPRO (impuestos 0,1 % y 1 %) -->

El otro precio es físico: los miembros se chocan entre sí. Un choque separa a
los dos y les cambia la velocidad ([[simulacion/fisica#choques]]), así que una
manada apretada gasta empuje empujándose. Vas a verlo en las corridas de
esta página: los enjambres reales del Bestiario conviven con el choque, no lo
evitan.

## Coordinarse sin jefe {#coordinarse}

No hay jefe posible: ningún bot puede dar órdenes globales, cada uno lee solo
sus sentidos. Los enjambres del Bestiario se juntan por tres caminos, de
menos a más señal:

| Camino | Mecanismo | Bots de acá |
|---|---|---|
| Conducta suelta | Todos hacen la misma regla local y el orden aparece solo | _SWARM 2.0_ |
| Seguirse por la vista | Copiar el rumbo del hermano que se ve, o reconocerlo por firma o contraseña | _Mr_Swarm_ |
| Avisos por out/in | Publicar datos en [[.out1]] y [[.in1]] para que los lean | _SocialSwarmX_ |

La primera fila es la idea de las bandadas de pájaros: nadie dirige, cada uno
imita al vecino. La segunda y la tercera usan lo que viste en
[[tutoriales/reconoce-especie]]: la firma del ADN (`ref*` contra `my*`) y la
contraseña pública.
<!-- SWARM_2.0 (solo compara firmas), Mr_Swarm.txt (publica 43 en .out1 al nacer, lo lee en .in1), SocialSwarmX.txt (publica posición en .out1/.out2, la repite el que ve a un hermano con el dato); 21-MEMORIA §2/§3 (out/in: publican todos, .out* nunca se borra) -->

## Alinearse por la vista: SWARM 2.0 {#swarm}

<!-- SWARM_2.0_F2_Elite_-10.03.07.txt; probado: qty 1 contra un bot quieto, campo 600x500, semilla 11: eye6 239 al ciclo 4, presa de 3000/1000 a 711/85 al 14, muerta al 16, tirador en 13375 con kills=1; re-corrido: 711/85 al 15, muerta antes del 20, tirador en 12975, hijo antes del 25 -->
_SWARM 2.0 F2 Elite_ (en el Bestiario,
`SWARM_2.0_F2_Elite_-10.03.07.txt`) es un enjambre de apenas diez genes que ni
siquiera reconoce a sus hermanos por señal: solo compara firmas. Su ojo frontal
[[.eye5]] lo abre a 1220 de ancho, casi toda la vuelta, y como el alcance
cae con el ancho, ve apenas unas 150 unidades a la redonda: es un radar de
cerca, no un telescopio.
<!-- 32-VISION §0.4 (1440·(1 − ln(w/35)/4): vuelta entera ≈ 150) -->

```adn
' Ojo frontal panoramico
cond
 *.robage 0 =
start
 1220 .eye5width store
stop

' Cada 5 ciclos: si veo a un hermano, mirar adonde mira el
cond
 *.robage 5 mod 0 =
 *.eye5 0 >
 *.refeye *.myeye =
start
 *.refaim .setaim *.robage sgn mult store
stop
```

Esa segunda regla es todo el enjambre: cada cinco ciclos, el hermano más
cercano que caiga en el ojo panorámico dicta el rumbo, copiando su
[[.refaim]] con [[.setaim]]. Como todos avanzan siempre a toda velocidad
(`*.maxvel *.vel sub .up store`), la manada que se cruza de cerca termina
navegando junta hacia donde miraba el primero. Nadie lidera: cada uno imita al
vecino, y el orden sale solo.

Contra un extraño la firma no coincide (`*.refeye *.myeye !=`) y pasa a ser
comida: lo persigue a toda máquina y, mientras se acerca, le dispara −6
(`*.eye6 34 >` es «lo veo por un costado»), el disparo que roba cuerpo y
devuelve un −2 con lo robado. En la corrida, una sola copia desangró a una
presa quieta en 16 ciclos y terminó con 13375 de energía desde 3000: el
cuerpo ajeno convertido en propia energía, que es de dónde sale la manada
entera. Después, con `*.body 700 >`, cada uno parte un 30 % y la manada
crece sola.
<!-- 33-SHOTS §2.1 (−6 releasebod), §5 (shot −2 de vuelta, kills); core shots.hpp releasebod (techo body·10/0.8, 20 % nrg + 8 % body); probado: 3000+1000 → presa 711/85, muerta al 16, hijo nacido al 22 con 3758 -->

Sus dos flacos, medidos: no atiende los bordes del mundo (en un campo con
paredes termina apilada contra ellas, empujando), y el gen del parto también
sortea un giro (`314 rnd .aimdx`), que mientras el parto reintenta queda
girando al azar. En un campo chico, una pareja queda enredada: se ven con
32000, chocan y los rumbos dan vueltas. El enjambre gana en el campo
abierto.
<!-- probado: qty 2, campo 200x200, semilla 3: eye5 32000 sostenido, aims cambian de ciclo a ciclo; qty 4, campo 2000x1500, semilla 2: apiladas en x=1951, x=48, y=1324 -->

## La manada con contraseña: Mr_Swarm {#mr-swarm}

<!-- Mr_Swarm.txt; probado: qty 2, campo 300x300, semilla 7: aim 460/460 al ciclo 30 y 759/759 del 40 en adelante, in1=43, 0 disparos; qty 1 contra quieto, campo 500x400, semilla 2: presa muerta entre el 10 y el 20, cazador 3000 → 6164; re-corrido (semilla 7): idéntico, 460/460 al 30 y 759/759 del 40, in1=43, cero disparos -->
_Mr_Swarm_ (`Mr_Swarm.txt`) apuesta a la contraseña. Cada copia publica un 43
en `.out1` en su primer ciclo y nunca más; el que tenga un hermano en el ojo
con foco lo lee en [[.in1]] ([[tutoriales/reconoce-especie]]). En una
corrida con seis copias, todas tenían el 43 publicado y recibido a los 20
ciclos, sin un disparo entre ellas.

```adn
' Un hermano adelante: anotarlo una vez
cond
 *.in1 43 =
 *.eye5 1 >
 *.shoot 0 =
 *27 0 <=
start
 27 inc
stop

' Y copiar su rumbo
cond
 *27 1 >=
 *.shoot 0 =
 *.reffixed 0 =
start
 *.refaim .setaim store
 27 dec
stop
```

Seguir al hermano es copiarle el rumbo con [[.refaim]] —mismo mecanismo que
SWARM, con un contador para no reescribirlo en cada ciclo— y avanzar hacia él.
Medido con dos copias: los rumbos convergieron y quedaron clavados ahí (460 y
460, después 759 y 759, durante veinte ciclos). La contraseña llega
también por choque, no solo por la vista: las `in*` se llenan igual cuando los
cuerpos se tocan ([[simulacion/vision#contacto]]).
<!-- 32-VISION §5 (contacto llena refvars/in*); probado: semilla 7, eye5 0 en el seguidor con in1 43 recibido por contacto -->

Al extraño que no publica el 43 lo trata distinto: le dispara −1, el disparo
que drena energía, mientras lo apunta y avanza.

```adn
' Algo adelante que no es de la manada: drenarle energia
cond
 *.eye5 1 >
 *.in1 43 !=
start
 -1 .shoot store
 1 .out2 store
 1 .up store
stop
```

En la corrida contra una presa quieta, la encontró en diez ciclos, marcó su
bandera en [[.out2]] (que sus hermanos pueden leer por [[.in2]]) y la dejó
muerta antes del ciclo 20, cerrando con 6164 de energía. Aparte de eso, se
corta el lazo de nacimiento en el primer ciclo, gira al azar y se toma treinta
ciclos cuando toca un borde (`*.edge` con un temporizador), así que no se
apila contra las paredes como SWARM, y recién se reproduce con 120 de cuerpo,
más de 8000 de energía y 100 ciclos de vida: primero la manada, después los
hijos.
<!-- 33-SHOTS §5 (−1 releasenrg: 90 % nrg, 1 % body); probado: presa 3000 → 1613 al 10, muerta al 20; cazador 4464 → 6164 -->

## La alarma de boca en boca: SocialSwarmX {#alarma}

<!-- SocialSwarmX.txt; probado: qty 3 contra quieto, campo 800x600, semilla 4: al ciclo 10 un miembro con out1=114 out2=486 (posición exacta de la presa 114,486) y otro con in1=114; al 80 la manada entera apiñada en la esquina de la presa -->
_SocialSwarmX_ (`SocialSwarmX.txt`) no se sigue: se pasa datos. El que ve
comida publica _dónde_ está, usando el par de celdas como coordenadas:

```adn
' Veo a un extraño: publicar su posicion
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 *.refxpos .out1 store
 *.refypos .out2 store
 *.refveldx .dx *.eye5 sgn mult store
stop

' Veo a un hermano que ya tiene el dato: repetirlo
cond
 *.eye5 0 >
 *.refeye *.myeye =
 *.in1 0 !=
 *.in2 0 !=
start
 *.in1 .out1 store
 *.in2 .out2 store
stop
```

Como cualquier bot que te vea lee tus `out*` en sus `in*`, el aviso salta de
hermano en hermano: el que ve publica, el que lo ve a él repite. En la corrida,
un miembro publicó la posición exacta de la presa (114, 486) y ese mismo ciclo
otro ya la tenía anotada en su `in1`. La alarma solo vale entre
hermanos, así que el relé exige la firma.

¿Quién la atiende? El que tiene hambre:

```adn
' Con poco cuerpo y una posicion en la mano: ir para alla
cond
 *.body 500 <
 *.out1 0 !=
 *.out2 0 !=
start
 *.out1 *.out2 angle .setaim store
stop
```

Con [[op:angle]] la posición guardada se vuelve rumbo. Los llenos no se
mueven; los flacos convergen. Al final de la corrida la manada entera estaba
apiñada en la esquina donde había muerto la presa, comiéndosela a disparos
−6: como las `out*` no se borran solas, la alarma quedó encendida sobre el
cadáver, que era justo el lugar adonde convenía ir.
<!-- 21-MEMORIA §2 (800-819 out/in), §3 (out*: nunca se borran); probado: semilla 4, al 60 el cuerpo de la presa bajo de 1000 a 49, todos los miembros con el mismo aviso out1=65 out2=596 -->

Una lección extra de este bot: leé lo que el ADN _hace_, no lo que su nombre
promete. Su primer gen quiere cortar el lazo de nacimiento con una cuenta de
direcciones, pero la cuenta pisa de rebote la celda de [[.repro]]: a los
9 ciclos cada copia escribe un 1 ahí y pare un hijo con el 1 % de su energía.
En la corrida aparecían estos hijos enanos (41 de energía, 9 de cuerpo)
muriéndose de a poco. El enjambre funciona igual; la estrategia real es menos
limpia que la leyenda.
<!-- probado: qty 1, campo 800x600, semilla 9: repro=1 desde el ciclo 10, hijo de nrg 40,96 y body 8,90 (≈1 % de la madre en 4100/890); 330×10 = 3300 ≡ 300 (módulo 1000) -->

:::cuidado
El nombre no decide de qué se trata. _Chaotic Swarm_ y _4-d Swarmer_ no son
enjambres sueltos sino multibots: en una corrida forman lazos, reparten y
llegan a `.multi` 1. _Turbulent Swarm_, en cambio, no tiene un solo gen de
lazo: es un enjambre suelto de los de esta página, que se alinea por la firma
y se pasa el aviso del enemigo por `out`/`in`. De los organismos se ocupa
[[estrategias/multibots]].
:::
<!-- probado: Chaotic_Swarm_ver_1.2_MB_SA.txt y 4-d_Swarmer.txt, --qty 3 con un blanco quieto, campo 600x500, 100 ciclos: numties 1-3 y .multi 1; TurbulentSwarm_f3_f2_f1_Shadowgod2_11-2-2014.txt igual: numties 0 los 100 ciclos, mata al blanco sin atarse -->

## Un enjambre mínimo {#minimo}

Para ver el mecanismo de la alineación sin nada encima, tres genes alcanzan.
La regla local es una sola: si el más cercano que veo es un hermano, miro
adonde él mira.
<!-- probado: manada de 4 copias, campo 500x400, semilla 1: al ciclo 10 las cuatro con aim 1248; lo sostienen hasta el 60 y terminan apiladas contra la pared derecha (sin gen de bordes) -->

```adn
' Ojo frontal panoramico, una sola vez
cond
 *.robage 0 =
start
 1221 .eye5width store
stop

' Un hermano a la vista: copiar su rumbo
cond
 *.eye5 0 >
 *.refeye *.myeye =
start
 *.refaim .setaim store
stop

' Avanzar siempre
cond
 *.velscalar 20 <
start
 20 .up store
stop
```

Sembrá cuatro copias en un campo chico y mirá [[.aim]]: en la corrida, a los
diez ciclos las cuatro apuntaban exactamente al mismo rumbo y lo sostuvieron,
navegando en cardumen hasta chocar con la pared (no tienen gen de bordes, como
SWARM). Cambiá `*.refaim` por
`*.refxpos *.refypos angle` y en vez de seguirlo se le van encima: el mismo
canal, otra conducta. Agregale [[.repro]] con un porcentaje chico y una
condición de hambre, y ya tenés una manada que se reproduce en vez de
apilarse.

## Qué probar después {#despues}

<!-- 40-MUTACIONES (la firma deriva al mutar, B6-9); opciones.js F1_COSTOS (cost:23 = 2) -->

**Repartir roles.** Publicá un número de rol en `.out1` al nacer (uno distinto
por copia, con [[op:rnd]]): los que salen cazadores disparan, los que salen
recolectores juntan. La contraseña de _Mr_Swarm_ ya separa «mío» de «extraño»;
separar «cazador» de «recolector» es el mismo canal con otro número.

**Un enjambre que huye.** El aviso sirve para lo contrario: que el que recibe
un disparo publique la dirección del tirador y los demás lo eviten. Las
señales de ataque y de peligro viven en la misma familia; para las defensas
que lo complementan, [[estrategias/defensivos]].

**Atado o suelto.** La diferencia con un multibot es el lazo: atado, un
organismo comparte energía y ejecuta órdenes por puerto, pero paga cada
atadura y pierde a todo el organismo junto ([[tutoriales/multibot]]). Suelto,
cada copia muere sola y la manada sigue. Compará tu enjambre contra un
multibot del Bestiario en un [[estrategias/torneos|partido]].

**Dejarlo evolucionar.** Con las mutaciones encendidas
([[simulacion/mutaciones]]), la firma de cada copia deriva sola y la manada
puede partirse en especies nuevas: la contraseña del 43 se escribe una vez por
copia, así que una mutación en ese gen basta para que un linaje deje de
reconocer a sus hermanos. Un enjambre es un buen sustrato para tu primer
experimento de [[tutoriales/evolucion|evolución]]: sobran copias, y las que
muten mal se mueren solas.
