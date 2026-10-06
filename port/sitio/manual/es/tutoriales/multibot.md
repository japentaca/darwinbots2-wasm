---
titulo: Un multibot
resumen: "Paso a paso: un organismo de varias células que nacen atadas, comparten la energía, sostienen la forma y caminan como una sola cosa."
etiquetas: [multibot, lazos, multicelular, compartir, organismo]
estado: revisada
---
En [[tutoriales/alimentador]] usaste un lazo para chuparle la energía a otro
bot, y en [[tutoriales/reconoce-especie]] aprendiste a distinguir a los tuyos.
Ahora vamos más lejos: en vez de _usar_ los lazos, vamos a _vivir_ en ellos.

## Qué es un multibot {#que-es}

<!-- 34-TIES §3 (Multibot = True en la primera tie endurecida; False sin lazos); .multi -->
Un _multibot_ (o multicelular) es un organismo: varios bots unidos por lazos que
comparten energía y se sostienen en forma. Un bot pasa a ser multicelular
([[.multi]] vale 1) cuando un lazo hecho con [[.tie]] cumple sus 19 ciclos y se
endurece, y le pasa a los dos extremos a la vez. Todo el mecanismo de los lazos
—resorte, endurecimiento, puertos, reparto— está en [[simulacion/lazos]]; acá lo
usamos para armar uno de cero.

La receta de siempre es simple: cada hijo se ata al padre apenas nace, y el
organismo crece parto a parto. Para que funcione como organismo y no como un
puñado de bots enganchados, falta resolver tres cosas: quién manda, cómo se
reparte la despensa y cómo se camina sin desarmarse.

## Paso 1 · Nacer atado {#nacer-atado}

<!-- 34-TIES §1 (nacimiento: last = 100, Port = 0 del lado del padre); lazos.md §nacimiento -->
Todo parto ata al padre con el hijo con un _lazo de nacimiento_. Es un lazo
provisorio: nunca se endurece y se corta solo a los 100 ciclos. Tiene además una
rareza: el padre lo llama 0, y un 0 no sirve para nada, así que por ese lazo el
padre no puede escribirle ni pasarle recursos al hijo; el hijo, en cambio, lo
llama 1 y sí puede.

Por eso la receta: apenas nace, el hijo se ata de nuevo con [[.tie]], y el lazo
nuevo pisa al de nacimiento. A los 19 ciclos ese lazo se endurece y los dos
quedan multicelulares.

<!-- 34-TIES §1 (fallback del padre en los primeros ciclos); comprobado con probar-adn: a los 0 de edad el hijo ya tiene .numties 1 y el .tie encuentra al padre -->
¿Y cómo sabe un bot que nació de un parto, para atarse? Por el lazo de
nacimiento: ya está puesto en su primer ciclo de vida, así que [[.numties]] vale
1. Un fundador, un bot sembrado suelto, empieza con 0. Esa diferencia basta para
marcar quién es quién, y la guardamos en una celda libre de memoria
([[adn/memoria]]):

```adn
def cuerpo 60

' naci de un parto: soy cuerpo
cond
 *.robage 0 =
 *.numties 1 =
start
 1 .cuerpo store
stop

' apenas nacido, me ato al padre con el puerto 7
cond
 *.robage 0 =
 *.cuerpo 1 =
start
 7 .tie store
stop
```

El [[.tie]] no necesita ver al padre: si no ves a nadie, en tus primeros ciclos
el motor prueba con tu padre. El 7 es el _puerto_: el nombre con el que el hijo
va a llamar a ese lazo; el padre lo llamará 1, porque para el otro extremo el
lazo se nombra por orden de llegada. Y el fundador no lo pide: no tiene a quién
atarse, y un intento fallido cobra el costo del lazo
([[param:cost:22]]) igual.

Qué deberías ver: sembrado solo, todavía nada: el fundador no pide el lazo. La
parte observable llega con el primer parto (el gen de reproducirse entra en el
paso siguiente): el hijo nace con `.numties 1`, a su primer ciclo ya llama 7 a
su lazo, y `.multi` recién pasa a 1 en los dos a los 19 ciclos del atado.

:::cuidado
Atarse de entrada pisa el lazo de nacimiento, y por ese lazo llegan las entregas
de _memoria genética_ (las celdas 976 a 990 del padre): las que faltaban no
llegan nunca. Este bot no las usa, pero si tu especie sí las usa, dejá pasar los
15 ciclos de entregas antes de atarte (ver [[adn/memoria]]).
:::

## Paso 2 · Crecer: parir sin soltarse {#crecer}

Un organismo que nunca se reproduce no pasa de la primera generación. Cualquier
célula con energía y cuerpo de sobra puede parir: el hijo hereda el ADN, se
levanta delante y ya sabemos que se ata solo.

```adn
' con energia y cuerpo de sobra, me reproduzco
cond
 *.nrg 3000 >
 *.body 500 >
start
 30 .repro store
stop
```

<!-- 36-REPRO §2 (todo parto crea lazo de nacimiento; reparto 30 %; el hijo nace delante del padre, a la suma de los radios, y mirando al revés: su rumbo es el del padre + media vuelta; impuesto de una milésima del traspaso por lado); .repro persiste hasta el éxito, colisión en el punto de parto; comprobado con probar-adn: 3498.50/1498.50 de 5000, el hijo aparece delante del padre -->
Dos detalles del parto que acá juegan a favor. Primero, la orden [[.repro]] no
se gasta al fallar: si el lugar de nacimiento está ocupado, se reintenta ciclo
tras ciclo. Segundo, ese lugar queda delante del bot, hacia donde apunta, a la
suma de los dos radios, y el hijo nace mirando para atrás, espalda con espalda
con el padre. Mientras las células queden cerca, el hijo recién nacido ocupa el
lugar del siguiente parto y la producción se frena ahí: un organismo quieto no
cría más de una célula hija. En el paso 4, cuando los lazos estiren las células,
el lugar queda libre y la fábrica arranca de nuevo.

Qué deberías ver: con una sola célula sembrada y energía de sobra, al rato hay
dos; el hijo nace con el 30 % de la energía y del cuerpo del padre (menos una
milésima del traspaso que paga cada lado). Y como el hijo también tiene el gen
del paso 1, se ata y el organismo ya tiene dos células.

## Paso 3 · Una sola despensa {#compartir}

<!-- 34-TIES §2.1 (sharenrg: solo el creador, se borra cada ciclo, tope por body, 1 % al iniciador); comprobado con probar-adn: 3498.50/1498.50 pasan a 2493.47/2493.48 -->
En un organismo la energía es de todos. Con [[.sharenrg]] escribís qué
porcentaje del total querés quedarte con cada compañero de lazo; con 50 quedan
parejos. Tres condiciones, siempre las mismas:

- Solo lo puede pedir el que creó el lazo; como acá el hijo es quien se ata, cada
  célula pide su reparto hacia su propio padre.
- El motor borra la orden en cada ciclo, así que hay que pedirla siempre.
- En un ciclo no se mueve más energía que el propio cuerpo ([[.body]]), y quien
  pide paga el 1 % de lo movido.

```adn
' mientras sea multicelular, reparto energia parejo
cond
 *.multi 1 =
start
 50 .sharenrg store
stop
```

<!-- comprobado con probar-adn (bot de este paso, 5000 de energia inicial): 3498.50/1498.50 pasan a 2493.47/2493.48 y quedan ancladas; con tres celulas, ~1650 cada una -->
Qué deberías ver: con el padre a 3498 y el hijo a 1498 (sembrado con 5000 de
energía), en cuanto `.multi` vale 1 las dos cifras convergen y quedan ancladas
en ~2493 cada una: parejas, menos el 1 % del viaje. En cadenas más largas el
reparto va de a pares, pero como todas las células lo piden, la despensa se
iguala sola.

## Paso 4 · Sostener la forma {#forma}

<!-- 30-FISICA §3.1 (muelle con zona muerta), §3.2 (TieTorque: impulso en ambos bots, holgura 5°); 34-TIES §0.4 (regang fija ángulo y largo) -->
Un lazo es un resorte: recuerda un largo de reposo y tira o empuja para volver a
él. Endurecido, además, acepta órdenes de geometría: [[.fixlen]] fija el largo
de reposo y [[.fixang]] el ángulo al que tiene que quedar el compañero respecto
de hacia dónde apuntás. Con el ángulo fijo el lazo funciona como un brazo: si el
compañero se sale de su lugar, el motor empuja a los dos de costado y los
endereza.

Pedimos 300 de largo, de borde a borde, y 314 de ángulo: un cuarto de vuelta, así
cada hijo queda a un costado del padre y la cadena no se apila.

```adn
' con el lazo endurecido, doy forma
cond
 *.multi 1 =
start
 300 .fixlen store
 314 .fixang store
stop
```

<!-- comprobado con probar-adn: el tirón inicial pasa de 400 (llega a ~470) y a los ~25 ciclos hay tres células; la distancia se asienta cerca de 330 -->
Qué deberías ver: el parto deja a las células casi pegadas; cuando el lazo
endurece, el pedido de 300 las estira: el tirón inicial pasa de 400 y a las
decenas de ciclos la distancia se asienta cerca de 330. Y un efecto feliz: al
estirarse los bots, el lugar de parto queda libre y las células vuelven a parir:
a los ~25 ciclos ya hay tres.

## Paso 5 · Marchar: la cabeza decide {#marcha}

<!-- 30-FISICA §2.1 (el empuje .up es por bot), §3.1 (la fuerza del muelle viaja por el lazo), §3.2 (torque en ambos); 34-TIES §2 (geometría solo multibot) -->
Lo último es moverse, y acá conviene saber qué hace el motor y qué no. Cada bot
empuja en _su_ dirección con [[.up]]; el motor no reparte tu empuje entre los
atados. Lo que sí viaja por el lazo es la fuerza del resorte: si te alejás,
arrastra al compañero. Y con el ángulo fijado, el torque que corrige la forma
empuja a los dos.

Entonces la marcha más simple es la de los gusanos de verdad: solo la cabeza
decide. El fundador es la única célula que no marcó `cuerpo`, así que empuja
siempre; el resto se deja llevar por el resorte.

```adn
def cuerpo 60

' la cabeza empuja, el cuerpo sigue
cond
 *.cuerpo 0 =
start
 10 .up store
stop
```

Y el bot entero queda así:

```adn
def cuerpo 60

' naci de un parto: soy cuerpo
cond
 *.robage 0 =
 *.numties 1 =
start
 1 .cuerpo store
stop

' apenas nacido, me ato al padre con el puerto 7
cond
 *.robage 0 =
 *.cuerpo 1 =
start
 7 .tie store
stop

' con energia y cuerpo de sobra, me reproduzco
cond
 *.nrg 3000 >
 *.body 500 >
start
 30 .repro store
stop

' mientras sea multicelular, reparto energia parejo
cond
 *.multi 1 =
start
 50 .sharenrg store
stop

' con el lazo endurecido, doy forma
cond
 *.multi 1 =
start
 300 .fixlen store
 314 .fixang store
stop

' la cabeza empuja, el cuerpo sigue
cond
 *.cuerpo 0 =
start
 10 .up store
stop
```

<!-- comprobado con probar-adn, --qty 1 y --qty 3, 5000 de energia, sin costos ni mutaciones; crucero del organismo ~33 por ciclo contra ~40 de un bot suelto con el mismo .up; reverificado: 991 unidades en 30 ciclos (~33), .tielen oscila entre 233 y 406 en la marcha, .multi pasa a 1 en los dos extremos el mismo ciclo, y la variante con todas las celulas empujando se hace un nudo y avanza ~5 unidades por ciclo (menos de un tercio) -->
Para comprobarlo, sembrá varios fundadores y mirá cómo les va. Lo que medimos
con tres, a los 100 ciclos:

| Qué miramos | Resultado |
|---|---|
| Células por organismo | De cada fundador con lugar para parir, 3 (a uno que quedó pegado a la esquina del campo no le nació nadie: su lugar de parto caía afuera) |
| Lazos | La cabeza con 2, el resto con 1, y ninguno roto |
| Posiciones relativas | El largo oscila alrededor de los 300 pedidos (en la marcha va de ~200 a ~430) y el ángulo se sostiene cerca del cuarto de vuelta: la cadena camina sin plegarse |
| Avance | El organismo que caminó libre recorrió ~2500 unidades en sus primeros 90 ciclos; en crucero son unas 33 por ciclo (un bot suelto con el mismo empuje navega a ~40): arrastrar células cuesta, pero no mucho |
| Energía | Pareja: ~1650 por célula, de los 5000 iniciales |

## En el Bestiario {#bestiario}

<!-- Caterpillar_Peter_F2_MB_04-11-08.txt (Bestiario): comparte nrg/shell/slime/waste, camina alternando .fixpos y .fixlen 1/1000, se corta con .deltie al engordar -->
Hay multibots de verdad en el Bestiario, con años de torneos encima. El
_Caterpillar_ de Peter camina como una oruga: clava la cabeza, acorta el lazo a
1 con `.fixlen` para arrastrar el cuerpo, vuelve a estirarlo a 1000 y repite;
reparte por mitades la energía, el caparazón y la baba (y les pasa los
desechos enteros), y cuando junta
demasiada energía se corta con [[.deltie]] para que cada tramo funde un
organismo nuevo.

<!-- Tribolis_0.1_MB_Bacillus_-21008.txt (Bestiario): celda type (head/middle/tail); todas nacen cabeza; la que queda sin lazos se marca cola y reproduce; la cabeza con nrg de sobra se degrada a tramo y pare una cabeza nueva; la cabeza empuja y fija 628 .fixang; los tramos empujan más despacio; la cola aturde presas con venom -->
El _Tribolis_ de Bacillus es un gusano con jerarquía: cada célula se declara
cabeza, tramo o cola en una celda libre. Todas nacen declarándose cabeza; la
que queda sin lazos (el fundador, o una que los perdió) se declara cola y
reproduce para fundar el gusano; y la cabeza que junta energía de sobra se
degrada a tramo y pare una cabeza nueva, así el cuerpo se alarga. En la marcha,
la cabeza manda: empuja y fija su lazo a 628, con el cuerpo colgando atrás;
los tramos empujan más despacio para no quedarse, y la cola aturde a las
presas con veneno.

<!-- W6_a_verry_strong_multibot.txt (Bestiario): publica la posición del objetivo por tout/tin, se conecta según la población -->
Y el _W6_ de Peterb, un multibot táctico con un genoma enorme: publica por los
lazos dónde vio al enemigo y arma cadenas más o menos grandes según cuánta
población haya en el campo.

## Qué probar después {#despues}

<!-- 21-MEMORIA §3 (tin1 = tout1 del atado, vía ReadTRefVars); 34-TIES §2 (tieportcom: escritura remota de memoria); core ties.hpp DeleteTie (el cadáver sigue atado); sysvars .fixpos (latch: fija la célula) -->

- **Repartir trabajos.** En vez de que todas las células hagan todo, marcala
  como el _Tribolis_ y andá más lejos: unas cazan ([[tutoriales/dispara]]) y
  otras fotosintetizan ([[simulacion/cloroplastos]]), con la energía viajando
  por el reparto. Para elegir quién hace qué, la vía de siempre son los canales
  del lazo ([[.tout1]] lo publica, [[.tin1]] lo escucha) o una celda escrita
  por el vecino con [[.tienum]], [[.tieloc]] y [[.tieval]].
- **Cambiar la marcha.** Probá que todas las células empujen: vas a ver que el
  organismo recorre menos terreno, porque cada una empuja hacia su propio
  frente y se hace un nudo (en la prueba, menos de un tercio de lo que avanza
  la marcha de la cabeza). La marcha de oruga del _Caterpillar_ (fijar una
  célula con [[.fixpos]] y acortar el lazo) avanza mejor en espacios chicos.
- **Ponerlo a prueba.** Desafiá el organismo con un depredador y mirá qué pasa
  si cae la cabeza: el cadáver sigue atado un buen rato ([[simulacion/muerte]]),
  nadie empuja y el organismo queda frenado. Después de ese golpe, ¿qué gen
  tendría que cambiar para que una célula del cuerpo tome el mando?

Para las estrategias de multibots en competencia, seguí
[[estrategias/multibots]].
