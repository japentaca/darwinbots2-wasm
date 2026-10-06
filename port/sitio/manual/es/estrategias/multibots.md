---
titulo: Multibots
resumen: "Por qué conviene ser varios: qué pagan y qué ganan los organismos del Bestiario, con tres recetas de campeonato diseccionadas."
etiquetas: [multibot, lazos, organismo, bestiario, marcha]
estado: revisada
---
En [[tutoriales/multibot]] armaste un organismo de cero: los hijos se atan al
padre, la despensa se reparte, la cabeza empuja y el cuerpo se deja llevar.
Acá damos un paso más y leemos los que ya salieron campeones: el Bestiario
guarda unos 80 bots con «MB» en el nombre, y en ellos los lazos dejan de ser
un truco y pasan a ser un modo de vida. El mecanismo completo está en
[[simulacion/lazos]]; el tutorial enseña a construirlo; esta página enseña a
leer un organismo ajeno como se lee el juego de un rival.

## La apuesta {#apuesta}

<!-- 34-TIES §1 (costo de atar, lazo de nacimiento cobrado al padre), §2.1 (1 % del reparto, tope por body), §3 (multibot: costos divididos, vbody); 30-FISICA §2/§6 (un bot anclado no recibe fuerzas y su velocidad es 0) -->
Ser varios cuesta. Cada intento de atar cobra el costo de atar
([[param:cost:22]]), y hasta el lazo de nacimiento se lo cobra al padre en
cada parto. Repartir tampoco es gratis: hay que pedirlo cada ciclo, quien
pide paga el 1 % de lo que se mueve y en un ciclo no viaja más energía que
tu propio cuerpo ([[simulacion/lazos#recursos]]). Y un organismo camina más
lento que un bot suelto: arrastra células que empujan cada una hacia su
propio frente.
<!-- tutoriales/multibot (medido ahi: ~33 unidades por ciclo contra ~40 de un bot suelto con el mismo empuje) -->

Qué compra todo eso:

- **Una sola despensa.** Una célula que come alimenta a todas: con
  [[.sharenrg]] la energía se iguala sola a lo largo de la cadena, y lo
  mismo el caparazón, la baba o los desechos (cómo entra y sale la energía
  de un bot, en [[simulacion/energia]]).
- **Masa.** Siendo multicelular, los disparos que sacan energía o cuerpo
  pegan con la fuerza de todo el organismo, y fabricar caparazón y baba sale
  dividido por la cantidad de lazos más uno
  ([[simulacion/lazos#multicelulares]]). En competencia esto es el negocio:
  un depredador suelto piensa dos veces antes de morder algo más grande que
  él.
- **Redundancia.** Si el organismo se rompe, las células siguen vivas y cada
  pedazo puede volver a arrancar. Un enjambre pierde individuos; un
  multicelular pierde miembros.
- **Marchas nuevas.** Anclarse con [[.fixpos]] (un bot anclado no recibe
  fuerzas: es un ancla) y estirar el lazo con [[.fixlen]] da modos de
  avanzar que un bot suelto no tiene, y que agarran donde el empuje de
  [[.up]] no alcanza.

:::cuidado
En un torneo, mirá primero las reglas: la descalificación automática
([[param:opt:93]]) puede prohibir atarse o pasarle recursos a un rival por
un lazo.
:::

## Caterpillar: el acordeón {#caterpillar}

<!-- Caterpillar_Peter_F2_MB_04-11-08.txt (Peter); probado: --qty 1 y --qty 3, 6000 de energia, campo 6000x4000: parejas con .multi 1 a los ~25 ciclos, .fixpos alternado y complementario, .tielen oscilando entre 22 y 290, energia pareja anclada en 702/702, y avance de 2644 unidades en 225 ciclos (~12 por ciclo) hasta la pared; re-corrido (--qty 2): multi 1 al 25, 702/702 anclada, tielen 22-275, avance ~11 por ciclo -->
El _Caterpillar_ de Peter vive en parejas: una cabeza y un cuerpo unidos por
un solo lazo rígido ([[.stifftie]] al máximo). No empuja con `.up`: camina
como una oruga de juguete, plegándose y estirándose.

La cabeza es el reloj. Cada célula calcula la fase con la edad de la cabeza
—el cuerpo la siente por el lazo con [[.trefage]], la cabeza la conoce con
su [[.robage]]— y alterna cada siete ciclos: en una mitad, el cuerpo se clava
y el lazo se estira al máximo, con la cabeza suelta; en la otra, la cabeza
se clava, el lazo se acorta a 1 y el cuerpo se arrastra hasta ella.

```adn
def time 100
def head 101
def move 102
def maxlengh 972

' cuerpo: fase alta del reloj, me clavo y ordeno estirar el lazo
cond
 *.move 1 !=
 *.head 0 =
 *.trefage *.time mod *.time 2 div >
start
 *.maxlengh .fixlen store
 1 .fixpos store
stop

' cuerpo: fase baja, me suelto y acordeon: el lazo a 1
cond
 *.move 1 !=
 *.head 0 =
 *.trefage *.time mod *.time 2 div <
start
 1 .fixlen store
 0 .fixpos store
stop
```

<!-- Caterpillar_Peter_F2_MB_04-11-08.txt, gen «MB-sharing»; probado: la energia de la pareja queda anclada e igual (702/702) mientras viven ambos -->
El reparto tiene un candado. Cada Caterpillar vivo incrementa un contador
público cada ciclo ([[.tout1]]), así que la edad que siento en el otro tiene
que casar con el contador que me llega ([[.tin1]]): si el atado es un
cadáver —que ya no incrementa— o un extraño, no comparte nada.

```adn
def stiftie 973

' solo reparto si el atado es un Caterpillar vivo
cond
 *.numties 1 =
 *.trefage *.tin1 =
start
 .tienum inc
 *.stiftie .stifftie store
 50 .sharenrg store
 50 .shareshell store
 50 .shareslime store
 100 .sharewaste store
 *.tiepres .readtie store
stop
```

Cuando caza, apunta con [[.setaim]] y elige el disparo según la defensa de
la víctima: cuerpo (`-6`) contra las que confían en la toxina, energía
(`-1`) contra las que confían en el caparazón ([[simulacion/disparos]]). Y
trae un gen de despegue: con más de 5000 de energía y 2000 de cuerpo, corta
el lazo con [[.deltie]];
cada mitad queda sola, y una célula sola pare una cabeza nueva. En nuestras
corridas sin comida nunca llegó a tanto, pero en un mundo que da de comer
es su manera de multiplicarse.

<!-- Caterpillar_Peter_F2_MB_04-11-08.txt: guarda maxlengh (972) y stiftie (973) en la memoria genetica instantanea (971-975, copiada al nacer); 21-MEMORIA; el bot define «time» en la 100, «head» en la 101 y «move» en la 102 -->
Un detalle para robarle: guarda su configuración —el largo máximo, la
rigidez— en las celdas de memoria genética instantánea, así cada cría nace
con los mismos valores sin escribirlos de nuevo ([[adn/memoria]]).

:::nota
Hasta los campeones traen typos que el editor marca. En genes que acá
no mostramos, este tiene un `=>` que no es ningún operador y un `head` sin `*`
que compara un 1 contra la dirección 101: esa condición es siempre falsa y el gen que avisaba «enemigo
cerca: clavate» queda muerto. Corré siempre lo que escribís.
:::

## Tribolis: el gusano con oficios {#tribolis}

<!-- Tribolisv1.0_F2MB_Bacillus_51008.txt (Bacillus); probado: --qty 1, 15000 de energia, 400 ciclos: el fundador se declara cola (celda 999 = 3) y pare una cabeza (999 = 1) que empuja con .velup anclado en 40; --qty 2, 15000: gusano estable de tres celulas (999 = 3 cola con un lazo, 999 = 2 tramo con dos), energia pareja en las celulas; y al romperse el gusano, cada pedazo refundo su propio gusano; re-corrido (--qty 1): gusano de tres celulas estable, energia pareja ~4590, velup 40 en la cabeza -->
El _Tribolis_ de Bacillus es un gusano con jerarquía. Cada célula se declara
en una celda: 1 cabeza, 2 tramo, 3 cola. Todas nacen cabeza; la que queda
sin lazos se degrada a cola y pare; y la cabeza que junta energía de sobra
se degrada a tramo y pare una cabeza nueva, así el gusano crece del frente.
Acá está diseccionado en su versión **1.0**
(`Tribolisv1.0_F2MB_Bacillus_51008.txt`); el del tutorial
[[tutoriales/multibot]] es la **0.1** (`Tribolis_0.1_MB_Bacillus_-21008.txt`),
un esbozo anterior del mismo diseño.

```adn
def type 999
def head 1
def middle 2
def tail 3

' naci: me ato al padre, publico la firma y me declaro cabeza
cond
 *.robage 0 =
start
 2 .tie store
 654 .out1 store
 .head .type store
 654 .tout1 store
stop

' celula sola con energia: me degrado a cola y fundo el gusano
cond
 *.numties 0 =
 *.nrg 2000 >
 *.eye5 40 <
start
 .tail .type store
 60 .repro store
stop
```

Cada oficio tiene sus genes. La cabeza empuja a fondo —en la corrida,
[[.velup]] quedó anclado en 40, el tope de velocidad ([[param:opt:11]])— y
lleva el lazo a 628 con [[.fixang]], el cuerpo colgando atrás. Los tramos
empujan más despacio para no perder la cadena y tiran los desechos. Y la
cola es la que maneja a la presa: no la mata, la gobierna.

```adn
def type 999
def tail 3

' cola: le escribo un 1 en su .fixpos y la presa queda anclada
cond
 *.type .tail =
 *.in1 *.out1 !=
 *.eye5 30 >
 *.reffixed 0 =
start
 .shootval inc
 .fixpos .shoot store
stop

' cola: si la presa esta paralizada, la hago girar
cond
 *.type .tail =
 *.in1 *.out1 !=
 *.memval 0 >
 *.eye5 30 >
start
 *.refxpos *.refypos angle 628 add .shootval store
 .setaim .shoot store
stop
```

<!-- Tribolisv1.0_F2MB_Bacillus_51008.txt: disparos de memoria (.fixpos, .setaim) y cola con veneno; 33-SHOTS §2 (valor >= 0: escritura de memoria con shootval) -->
El truco es el disparo de memoria: [[.shoot]] con un valor positivo escribe
tu [[.shootval]] en esa celda del blanco ([[simulacion/disparos]]). La cola
escribe en el `.fixpos` de la presa (queda anclada) y hasta en su
[[.setaim]] (la gira media vuelta). Entre eso y su veneno, la presa llega
mansa a la boca de la cabeza.

La defensa también es del organismo entero: cada célula publica por el lazo
cuánto caparazón y toxina está manteniendo, y adopta el nivel del vecino si
es mayor —si te disparan a una célula, todo el gusano se blinda.

<!-- Tribolisv1.0_F2MB_Bacillus_51008.txt, genes «Relay shot info»; probado: con 15000 inicial el gusano de tres celulas aguanta 400 ciclos con la energia pareja entre celulas visibles (~4590 cada una) -->
Y si el gusano se rompe, no se pierde: cada pedazo sigue caminando y el que
queda solo vuelve a fundar. En nuestras corridas, un gusano cortado dio dos
organismos nuevos, cada uno con su cola y su cabeza.

## Inchworm: la cabeza maneja a control remoto {#inchworm}

<!-- Inchworm_MB_PY_-18.10.04.txt (Purple Youko, liga de multibots 2.33); probado: --qty 2, 8000 de energia, 150 ciclos: parejas cabeza (celda 50 = 1) y cola (50 = 2) con .multi 1 a los ~30 ciclos, .fixpos siempre complementarios (1/0 y 0/1), .tielen oscilando entre 5 y 237, energia pareja; avance de ~230 unidades en 120 ciclos (~2 por ciclo) -->
El _Inchworm_ de Purple Youko es el minimalista: una cabeza y una cola,
nada más. Su gracia es cómo habla la cabeza con la cola. El paso dura diez
ciclos, marcados por un contador: en uno, la cabeza se clava y le ordena a
la cola que se suelte; en otro, se suelta ella y le escribe directamente
«quedate quieta» en la celda del `.fixpos` de la cola, por el lazo. Después
acorta el lazo a 120 (la cola se arrastra hasta la cabeza anclada) y lo
estira a 360 (la cabeza sale empujada, con la cola de ancla).

```adn
def type 50
def counter 51
def fix 54

' cabeza, contador 1: me clavo yo y le ordeno soltarse a la cola
cond
 *.type 1 =
 *.counter 1 =
start
 1 .fixpos store
 1 .tienum store
 2 .tieval store
 .fix .tieloc store
stop

' cabeza, contador 6: me suelto yo y le escribo quedate quieta
cond
 *.type 1 =
 *.counter 6 =
start
 0 .fixpos store
 1 .tienum store
 1 .tieval store
 .fixpos .tieloc store
stop
```

<!-- Inchworm_MB_PY_-18.10.04.txt; 34-TIES §2 (tieportcom: escritura remota en la fase de fuerzas y choques, el otro la lee al turno siguiente); probado: el .fixpos de la cola alterna exactamente con el contador de la cabeza; el adn del archivo pasa el lint sin avisos -->
Fijate en la diferencia entre las dos órdenes. La primera escribe en una
celda de datos de la cola (su `fix`), y la cola reacciona con genes propios.
La segunda va directa: escribirle en su [[.fixpos]] es escribirle una
_orden_, y el motor la ejecuta en su turno. La escritura viaja en la fase de
fuerzas y choques, así que la orden de hoy se obedece mañana
([[simulacion/lazos#comunicarse]]). Medido: el `.fixpos` de la cola cambia
exactamente cuando el contador de la cabeza lo manda.

Es lentito —en la corrida, apenas un par de unidades por ciclo— pero no se
desarma nunca: cada paso clava primero a una de las dos, así que el
organismo nunca queda suelto.

## Un consejo de diseño {#consejo}

<!-- Caterpillar: reloj compartido (.trefage del cuerpo y .robage de la cabeza, ambos la edad de la cabeza), probado en la marcha; Inchworm: escritura remota de .fixpos, probado: el .fixpos de la cola cambia exactamente con el contador -->
De estas corridas me quedaría con dos formas de sincronizar una marcha. Si
la coreografía es periódica, no mandes órdenes: compartí un reloj. El
_Caterpillar_ no le ordena nada al cuerpo: las dos células leen la edad de
la cabeza —una por el lazo, otra de memoria propia— y cada una deduce su
paso; no hay mensaje que se pueda perder. Y si la orden es puntual, no la
publiques y esperes: escribila en la memoria del otro con [[.tienum]],
[[.tieloc]] y [[.tieval]], como el _Inchworm_ con su `.fixpos` remoto.
Publicar en [[.tout8]] y que el otro lea [[.tin8]] necesita que el otro
tenga el gen que escucha; la escritura directa, no.

## Los oportunistas {#oportunistas}

<!-- W6_a_verry_strong_multibot.txt (Peterb): publica la posicion del enemigo en .tout1/.tout2 y la lee cada 10 ciclos por .tin1/.tin2; probado: --qty 3 en campo 6000x4000 no se ata ni se reproduce (sus genes de repro piden poblacion enemiga); --qty 12 en 1500x1000, 400 ciclos: lazos transitorios (1 a 3) y solo parejas pasajeras con .multi 1 -->
No todos los «MB» viven en organismos. El _W6_ de Peterb —un genoma enorme
lleno de tácticas— se ata cuando le conviene y se corta cuando no: publica
por los lazos dónde vio al enemigo y arma cadenas según cuánta población
haya. En nuestras corridas nunca pasó de parejas pasajeras: lazo, un rato de
`.multi` 1 y a otra cosa. El organismo, para él, es una táctica más, no una
identidad. Sembralo denso y ralo y vas a ver la diferencia.

## Qué probar después {#despues}

<!-- 34-TIES §3 (.sharechlr solo entre parientes cercanos); 36-REPRO §2 (todo parto ata al padre); 33-SHOTS §2 (disparos de memoria) -->
- **Organismo granja.** Repartí los oficios con cloroplastos: unas células
  fotosintetizan y otras cazan, y la despensa viaja por el reparto
  ([[simulacion/cloroplastos]]; ojo: [[.sharechlr]] solo funciona entre
  parientes cercanos).
- **La fragilidad de la cabeza.** Matá la cabeza de un _Tribolis_ y mirá
  qué pasa: el cadáver sigue atado un buen rato ([[simulacion/muerte]]),
  nadie empuja, el gusano queda frenado. Escribile el gen que le falta: que
  el tramo más viejo asuma.
- **Multibot contra enjambre.** Corré tu organismo contra el mismo ADN sin
  lazos y compará: sin despensa común ni bonus de masa, cada bot suelto es
  solo un bot ([[estrategias/enjambres]]).
- **A robar genes.** El candado de reparto del _Caterpillar_ (no alimentar
  cadáveres ni extraños) y la cola que gobierna presas del _Tribolis_
  (disparos de memoria) combinan bien con el alimentador por lazo que
  construiste en [[tutoriales/alimentador]].
- **A competir.** Armá una liga con estos tres y el tuyo, con las reglas de
  descalificación bien configuradas ([[estrategias/torneos]]).
