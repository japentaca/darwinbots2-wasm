---
titulo: Caníbales
resumen: "Comer a los propios: qué le rinde a un bot que dispara contra su especie, cómo decide a quién respeta, y tres caníbales reales del Bestiario diseccionados."
etiquetas: [canibalismo, especies, disparos, reconocimiento, memoria genetica]
estado: revisada
---
Un caníbal es un bot que tiene a su propia especie en el menú. Hay de dos clases:
los que disparan a todo lo que se mueve porque nunca aprendieron a distinguir, y
los que eligen con reglas. Los dos viven bien en un mundo con comida; en un mundo
sin comida, solo sobrevive el primero en volverse contra su hermano.

Esta página mira a los caníbales como estrategia: qué compran con cada bala y qué
pagan, y cómo resuelven el único problema difícil, que no es matar sino _apuntar_.

## La cuenta del caníbal {#cuenta}

<!-- core shots.hpp releasebod (Shots.bas:599-719: 20 % nrg / 8 % body, cadáver ×4, regalo −2 con la fuerza entera) y takenrg (95 % al tirador); 33-SHOTS §5; 21-MEMORIA (conespecífico: veneno y toxina absorbidos, [[simulacion/especies#especie]]); port/README B3-1 (inmunidad filial: el padre, dos ciclos); probado (re-corrido): Cannibot contra su clon, 4 copias, 60 ciclos, semilla 1: ni un disparo -->

Lo que gana es simple: una población es una franja de comida que además camina y
se reproduce sola. Robarle el cuerpo con un −6 es el intercambio más rendidor
del juego: el blanco lo paga sobre todo con el cuerpo —a diez de energía por
unidad— y el tirador se queda con casi todo lo robado, ya convertido en
energía suya (ver [[simulacion/disparos#cuerpo]]). A un cadáver le pega con el
cuádruple de fuerza y todo lo saca de su cuerpo: hasta los restos de la familia
rinden ([[simulacion/muerte]]). Cuando el tanque se queda sin vegetales, el
caníbal no se muere de hambre con los demás: recicla. Y de paso regula la
población: si sobran bocas y faltan blancos, la escasez misma corrige el número.

Lo que paga no está en la energía sino en la demografía. Cada hermano comido es
un pariente que no va a cazar, ni a defender la especie, ni a tener hijos: la
cuenta de energía del bot queda bárbara, pero su especie se achica
([[simulacion/especies]]); la economía completa del canibalismo, en
[[simulacion/energia]]. Y hay dos exenciones que conviene tener a mano:

- el veneno y la toxina de un pariente no le hacen nada a otro pariente: contra
  los tuyos esas balas se absorben, nunca pegan ([[simulacion/especies]]);
- el recién nacido solo está protegido de los disparos de _su padre_, y solo
  durante sus dos primeros ciclos ([[simulacion/disparos#impacto]]): del resto
  de la familia, ni un ciclo de gracia.

Un caníbal sin filtro, entonces, no puede usar veneno contra los suyos, pero sí
puede —y le conviene— usar −1 y −6. Por eso casi todos disparan de comer y no de
paralizar.

## El problema de apuntar {#apuntar}

El motor no marca a nadie «de los tuyos» para los disparos: esa decisión es
tuya. En [[tutoriales/reconoce-especie]] viste las dos señales clásicas —la
firma del ADN ([[.refeye]] contra [[.myeye]]) y la contraseña pública
([[.out1]]/[[.in1]])—. Los caníbales del Bestiario usan otras dos:

- **espiar la memoria genética del otro**: con [[.memloc]] apuntás a la celda
  971 del bot que ves y la leés en [[.memval]]; como la 971 se hereda
  ([[sysvars/mem-971-975]]), lo que estás leyendo es su _linaje_;
- **el tamaño**: [[.refbody]] contra [[.body]], sin mirar especie ni firma:
  come al más chico, huye del más grande.
<!-- 21-MEMORIA §5 (971–975 se copian al nacer; 976–990 de a una); sysvars refbody/myeye; tutoriales/reconoce-especie -->

Vamos a los bots.

## Cannibot: el linaje tatuado {#cannibot}

El _Cannibot_ de abyaly (`Cannibot_abyaly_2006.txt`, 2006) es el caníbal
pensado. Su teoría está en los comentarios del propio archivo: ataca a los de
su especie, pero solo a los parientes lejanos, porque «un caníbal que
también ataca a sus parientes cercanos no va a tener a nadie que lo defienda de
sus primos».

El truco es un marcador de familia en la celda 971 que se hereda y deriva:

```adn
' Al nacer: fijar el marcador y borrar este gen
cond
 *.robage 0 =
start
 50 971 store
 .delgene inc
stop

cond
 *.robage 0 =
start
 971 .memloc store
stop

' A los 2 ciclos: sumar -1, 0 o 1 al marcador heredado
cond
 *.robage 2 =
start
 *971 2 rnd add 1 sub 971 store
stop
```

El gen 1 corre una sola vez en la vida: escribe 50 en la 971 y **se borra a sí
mismo** con [[.delgene]]. Ese borrado es la jugada maestra: los hijos reciben
una copia instantánea de la 971 del padre ([[adn/memoria#memoria-genetica]]) y,
como el gen ya no está en el ADN, no la vuelven a pisar con el 50 — heredan el
valor que venía arrastrando la familia. A los 2 ciclos cada bot le suma −1, 0 o +1 al
azar ([[op:rnd]]): cada rama deriva un poquito distinto. Después, el marcador
no cambia nunca más.

¿Y cómo lo usa? Espiando: [[.memloc]] en 971 hace que [[.memval]] traiga el
marcador _del otro_. La comparación es de familia: [[op:%=]] acepta una
diferencia de hasta el 10 %.

```adn
' Pariente cercano (o nadie): vagar
cond
 *.eye5 0 =
 *.memval *971 %= or
start
 5 .up store
 314 rnd .aimdx store
stop

' Lejano a la vista: perseguirlo
cond
 *.eye5 0 >
 *.eye5 40 <=
 *.memval *971 !%=
start
 *.refvelup 10 add .up store
 *.refveldx .dx store
stop

' Lejano cerca: robarle el cuerpo
cond
 *.eye5 40 >
 *.memval *971 !%=
start
 -6 .shoot store
 *.refvelup .up store
stop
```
<!-- probado: Cannibot_abyaly_2006.txt, 4 clones, campo 600x600, 60 ciclos, semilla 1: ni un disparo, energia intacta en 3000, marcadores 49/50 derivando; re-corrido: idéntico -->

Funciona en los tres casos que importan:

1. **Entre clones** (mismo ADN, marcadores derivados 49 y 50): ni un disparo en
   60 ciclos. Se cruzan, se espian, siguen cada uno por su lado.
2. **Contra un extraño** (un bot quieto y pacífico): lo caza, lo desangra y lo
   mata antes del ciclo 30, cerrando en 14875 de energía desde los 3000
   iniciales. Su 971 arranca en 0 y nadie lo escribió: 0 está a más del 10 % de
   50, así que es comida.
   <!-- probado: contra un blanco quieto, campo 300x300, 90 ciclos, semilla 3: muerto antes del 30, kills=1, el Cannibot en 14875 -->
3. **Contra un primo lejano**: una copia idéntica con el marcador inicial en 90
   en vez de 50. Cuarenta unidades de diferencia: los dos genes de ataque la
   ven como «no es de los míos» y se cazan entre ellos con la misma sangre fría
   que a un extraño. El marcador fue de 51 contra 89: el de 89 cayó antes del
   ciclo 30, mientras los dos de marcador 51 nunca se tiraron un disparo.
   <!-- probado: copia con "90 971 store", campo 300x300, semilla 3: el "primo" muerto antes del 30 (kills=1 en uno de 51); los otros dos, intactos -->

Y la herencia se ve en los hijos: en una corrida larga, un fundador con marcador
49 tuvo un hijo con 48 (heredó 49 y derivó para abajo), y otro con 51 tuvo un
hijo en 51. Si el gen borrado hubiera sobrevivido, los hijos habrían vuelto
todos a 50.
<!-- probado: Cannibot_abyaly_2006.txt, --nrg 30000, 130 ciclos: 7 bots al 125; hijos con 971=48 (padre 49) y 971=51 (padre 51) -->

¿Cuánto tiene que derivar una rama para dejar de ser familia? El 10 % de
tolerancia sobre un marcador que arranca en 50 son unas 5 unidades: a fuerza de
sumar ±1 por generación, dos ramas que no se cruzaron durante unas decenas de
generaciones terminan fuera del margen de la otra — y ahí empieza la guerra
entre primos. El mismo autor lo dice: es un bot pensado para _poblaciones
viejas_.

## Evolved cannibot Elite: canibalismo sin filtro {#elite}

_Evolved cannibot Elite_ (`Evolved_cannibot_Elite_2006.txt`, 2006) es lo
opuesto: un bot evolucionado —sus genes traen comentarios de máquina, con
posiciones de `stop`— cuyo cerebro de caza completo es un gen y medio. El gen
de caza, literal:

```adn
cond
  *.eye5  0 !=
start
 -1  .shoot store
stop
```

Si ve algo, le dispara. Sin firma, sin contraseña, sin marcador: su especie no
existe para él. El resto del ADN es perseguir lo visto, girar al azar cuando no
hay nada, reproducirse con más de 10000 de energía y un gen suelto que escribe
basura en celdas sin nombre — ruido de la evolución.

En la práctica es un caníbal perfecto y una estrategia que se sostiene sola:
cuatro copias solas en un mundo chico empezaron a desangrarse entre ellas de
entrada, y a los 60 ciclos ya había una en 412 de energía mientras otra subía a
6000. En 300 ciclos sin ninguna otra comida la población se mantuvo entre 3 y
5: los que matan comen, los que no, quedan en el menú. Nacen hijos, sí —con
poco cuerpo, y sin más protección que los dos primeros ciclos del padre—, así
que la cría también es carne.
<!-- probado: Evolved_cannibot_Elite_2006.txt, 4 copias, campo 600x600, 300 ciclos, semilla 1: al 60 uno en 412 y otro en 6042; al 120 quedaban 3; al 180, 5 (con hijos nuevos); al 300, 4, con .kills de 2 y 3 en los supervivientes -->

Es la demostración de lo que pasa sin resolver el problema de apuntar: la
especie sobrevive, pero se pasa la vida mordiéndose la cola.

## Sneaker: el que come al más chico {#sneaker}

El _Sneaker Cannibalistic_ de Testlund (`Sneaker_Cannibalistic_F3_Testlund_9-12-2014.txt`,
2014) ni mira la especie: mira la balanza. Sus tres genes de combate, resumidos:

```adn
' Cazar a los que no disparan nunca
cond
 *.eye5 0 >
 *.reftype 1 !=
 *.refshoot 0 =
start
 -6 .shoot store
stop

' Comer al mas chico, sea quien sea
cond
 *.eye5 0 >
 *.reftype 1 !=
 *.refbody *.body <
 *.refbody *.body !%=
start
 16 .shootval store
 -6 .shoot store
stop

' Huir del mas grande que se defienda
cond
 *.eyef 0 >
 *.refshoot *.myshoot >=
 *.refbody *.body >
start
 628 .aimdx store
 *.maxvel 64 add .dn store
stop
```

Los tres criterios se complementan: el que no tiene [[.shoot]] en su ADN
([[.refshoot]]) es presa fácil; el que tiene menos cuerpo que vos —más del
10 % menos ([[op:!%=]])— es presa aunque sea tu clon; y el que tiene más
cuerpo _y_ dispara tanto como vos, es un problema: media vuelta y para el otro
lado. Con [[.shootval]] en 16, el tiro contra los chicos sale con el triple de
fuerza ([[simulacion/disparos#cuerpo]]).

El resultado con sus propios hermanos depende del tamaño:

- **clones del mismo tamaño**: ni un disparo en 120 ciclos. Sus cuerpos
  marchan parejos y la diferencia nunca pasa el 10 %, así que el gen de ataque
  no se enciende.
  <!-- probado: Sneaker_Cannibalistic_F3..., 4 copias, campo 600x600, 120 ciclos: cuerpos identicos (1029, 1059...), kills=0 -->
- **familia despareja**: se lo probé agregándole un gen que lo hace
  reproducirse temprano, para que aparezcan crías de verdad con los genes
  originales de caza. El primer padre que repartió cuerpo quedó en 506 de
  cuerpo, su vecino entero seguía en 1009 — y lo cazó. De los cinco bots de la
  corrida, al ciclo 30 quedaban dos: los dos más grandes, con dos y tres
  muertes propias en [[.kills]] cada uno.
  <!-- probado: variante con "50 .repro store" a los 5 ciclos (unico cambio), campo 1200x1200, semilla 1: 5 bots al 20, 2 al 30; el padre chico (506) muerto, kills=2 y 3 en los supervivientes -->

El costo de esta política es visible en esa misma corrida: **reproducirse te
convierte en la presa**, porque el parto reparte cuerpo, el cuerpo es el arma
del −6 y el más chico siempre pierde. Un Sneaker que quiere hijos se está
poniendo en el menú de sus vecinos.

Le sobra material: un gen que cada 128 ciclos se da un empujón, otro que
reacciona a los disparos que lo desangran ([[.shflav]] y [[.shang]], ver
[[simulacion/disparos#sentir]]) escribiendo [[.setaim]] y acelerando, y una
regla de parto peculiar: solo se reproduce cuando energía y cuerpo caen los dos
a la vez cerca de 2000, 4000, 8000… ([[op:%=]] con umbrales que se van
duplicando).

## Un caníbal mínimo {#minimo}

Este caníbal es mío, y es el esqueleto de caza de siempre ([[tutoriales/dispara]])
con el filtro de especie del tutorial ([[tutoriales/reconoce-especie]]) y el −6
de los bots de arriba:

```adn
' canibal minimo: come a los extranos y respeta a los suyos
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 5 .up store
 314 rnd .aimdx store
stop

' extrano a la vista: perseguirlo copiando su velocidad
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 *.refveldx .dx store
 *.refvelup 30 add .up store
stop

' extrano cerca: robarle el cuerpo
cond
 *.eye5 50 >
 *.refeye *.myeye !=
start
 -6 .shoot store
stop

' con el estomago lleno, tener hijos
cond
 *.nrg 6500 >
start
 30 .repro store
stop
```

Fijate en la condición del primer gen: gira y avanza si no ve nada **o si lo que
ve es un hermano**. Ese `or` no es adorno: en una versión anterior que solo
miraba `*.eye5 0 =`, dos hermanos que se cruzaban quedaban clavados frente a
frente para siempre —ningún gen se encendía—, con el ojo frontal marcando
más de 20000 y la energía intacta durante 40 ciclos.
<!-- probado (re-corrido): el mismo bot sin el «or», dos copias, campo 200x200, semillas 1 a 6: al cruzarse quedan clavadas frente a frente (eye5 en 32000, energía intacta en 3000) del ciclo ~10 al 40 -->

Qué deberías ver:

1. **Cuatro copias solas**: ni un disparo, todos girando por su lado, la
   energía en 3000 sin moverse.
   <!-- probado: canibal.txt, --qty 4, campo 1200x1200, 60 ciclos, semilla 1: kills=0, nrg 3000 en los cuatro -->
2. **Dos copias contra un bot quieto**: alguno lo caza a tiros de −6, y el que
   llega a 6500 de energía se divide; el hijo nace con el mismo ADN —o sea,
   con la misma firma—, así que el botín del extraño alimenta a la familia sin
   que se le escape un tiro entre ellos.
   <!-- probado: canibal.txt, --qty 2 contra un blanco quieto, campo 600x600, semilla 3: muerto antes del 40 (kills=1), el cazador en 14866, se reprodujo: hijo de 4458/315; re-corrido: cadáver antes del 30, cazador en 14875 al 30, hijo de 4458/315 -->

## Qué probar después {#despues}

**Canibalismo de hambruna.** Al caníbal mínimo le falta una valla de hambre:
disparar siempre a los extraños, pero a los hermanos solo cuando te morís.
Ponéle un gen aparte que dispare sin filtro con la energía por debajo de un
mínimo — y pensá dónde queda el mínimo para que no valga la pena fingirse
famélico.

**El precio de la familia.** Sembrá solo caníbales, sin vegetales, y mirá en
[[app/analizar]] cómo se mueven la población y la energía total. Después
prende los costos de la liga ([[param:cost:23]]) y volvé a correr la misma
simulación: con cada bala cobrada, el fondo del tanque se llega antes.

**La valla de la liga.** Si activás la restricción [[param:opt:71]] («Sin
reproducción asexual»), ningún bot de esta página cría: el _Cannibot_, el
_Elite_, el _Sneaker_ y el caníbal mínimo paren todos por [[.repro]]. En la
liga F1 la restricción viene apagada, así que ahí vale todo.
<!-- opciones.js opt:71 (DisableTypArepro: solo los vegetales repobladores se clonan); ADN de los cuatro bots: solo .repro (sin .sexrepro ni .mrepro); F1_OPTS 71 = 0 -->

**Sin disparos.** Hay caníbales que comen por lazo, chupándole la energía a la
víctima atada en vez de tirotearla: el camino está en [[tutoriales/alimentador]]
y la escuela completa en [[estrategias/multibots]].

**El parentesco envenenado.** Recordá que el veneno y la toxina no sirven
contra parientes: se absorben. A los tuyos solo los podés comer de verdad. Los
que viven de escribir en el cuerpo ajeno sin matarlo van por otro capítulo:
[[estrategias/parasitos]].

Y si te quedan ganas de evolución: _Evolved cannibot Elite_ es, según su
nombre, un caníbal que no lo programó nadie. Convertí el caníbal mínimo en la
población inicial de un experimento de [[tutoriales/evolucion]] y mirá si la
selección inventa solita alguna de las reglas de los bots de esta página.
