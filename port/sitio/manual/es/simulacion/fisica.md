---
titulo: Física
resumen: "Cómo se mueve un bot: su masa y su radio, las fuerzas que lo empujan o lo frenan, los choques, los bordes del mundo, el tope de velocidad y el giro."
etiquetas: [física, movimiento, fuerzas, choques, bordes, giro]
estado: revisada
---
Cada bot es un círculo que se desliza sobre un plano. Tiene una posición, una velocidad, una masa, un radio y un rumbo, y el mundo los actualiza en dos fases de cada ciclo ([[simulacion/ciclo]]): en _fuerzas y choques_ junta todo lo que lo empuja o lo frena y resuelve los choques; en _movimiento_ aplica esas fuerzas de una vez, gira al bot y lo mueve. No hay tiempo continuo: todo pasa a saltos de un ciclo.

## El estado físico de un bot {#estado}
<!-- 30-FISICA §1, §1.1, §1.2 -->

| Qué | Cómo lo lee tu ADN |
|---|---|
| Posición | [[.xpos]] y [[.depth]] (la profundidad crece hacia abajo) |
| Velocidad | [[.velup]] y [[.veldx]] respecto del rumbo; [[.velscalar]], la rapidez |
| Rumbo | [[.aim]] (1256 es una vuelta) |
| Masa | [[.mass]] |
| Radio | no tiene sysvar |
| Clavado o libre | [[.fixed]] |

Todas llegan con un ciclo de atraso, como todos los sentidos ([[adn/ejecucion#retraso]]).

**La masa** sale del cuerpo, del caparazón y de los cloroplastos: 1 por cada 1000 de [[.body]], 1 por cada 200 de [[.shell]] y casi 1 por cada cloroplasto. Nunca baja de 1 ni pasa de 32000. Un bot común pesa 1; uno con 500 cloroplastos pesa casi 500 (los detalles, en [[.mass]]).

**El radio** crece con el cuerpo, cada vez más despacio:

| Cuerpo | 100 | 1000 | 5000 | 10000 | 32000 |
|---|---|---|---|---|---|
| Radio | 46 | 114 | 210 | 271 | 415 |

Los cloroplastos acercan el radio a 415, el de un bot de 32000 de cuerpo: cuantos más tiene, más se acerca. Con la opción [[param:opt:21]] todos los bots miden 60, sea cual sea su cuerpo. El radio decide cuándo dos bots se tocan y cuánto los frena el fluido.

## Fuerzas, inercia y tope {#fuerzas}
<!-- 30-FISICA §0.1, §2, §6; core UpdatePosition (ZeroMomentum: velscalar sale de la velocidad antes de anularla; vel y veldx, después) -->

Las fuerzas no cambian la posición directamente. Durante _fuerzas y choques_ se suman en un acumulado; en _movimiento_, la velocidad recibe ese acumulado dividido por la masa, se recorta al tope y recién entonces la posición avanza lo que diga la velocidad:

```
fuerzas y choques                        movimiento
  rozamiento y fluido: frenan ya           velocidad += acumulado ÷ masa
  browniano, gravedad, empuje,             velocidad, como mucho el tope
  lazos: van al acumulado                  posición += velocidad
  choques, paredes, formas: corrigen
  la posición y frenan
```

Lo que no se frena sigue andando: sin rozamiento ni fluido, un bot que dejó de empujar conserva su velocidad para siempre. El tope es [[param:opt:11]] (40 por defecto; las reglas F1 lo suben a 180), que el bot lee en [[.maxvel]]. Con [[param:opt:10]] encendida, el mundo anula la velocidad al final de cada ciclo: el bot se mueve solo mientras empuja, aunque [[.velscalar]] sigue informando lo que avanzó en el último ciclo ([[.velup]] y [[.veldx]], en cambio, leen 0).

## El empuje voluntario {#empuje}
<!-- 30-FISICA §2.1; comprobado: 10 .up → 7, 13, 20, 26; 100 .up cobra 40 con MOVECOST 1 -->

El bot se empuja escribiendo en [[.up]], [[.dn]], [[.sx]] y [[.dx]] (el grupo completo está en [[sysvars/movimiento]]). El mundo hace esta cuenta:

1. Arma el empujón con `.up − .dn` hacia adelante y `.sx − .dx` de costado, medido desde el rumbo.
2. Lo multiplica por la masa y, si el resultado pasa el tope de velocidad, lo recorta a ese tope.
3. Le aplica la eficiencia [[param:opt:12]] (0,66 por defecto) y lo suma al acumulado.

Como después se divide por la masa, para un bot liviano la masa se cancela: `10 .up store` le suma unos 6,6 de velocidad por ciclo. Pero el recorte del paso 2 llega antes cuanto más pesa el bot, así que un bot pesado acelera muy poco aunque empuje fuerte.

**El costo** es el empujón ya recortado del paso 2 por [[param:cost:20]] (y por el [[param:cost:54]]). Con el costo de mover en 1, `10 .up store` cuesta 10 y `100 .up store` cuesta 40, lo mismo que 40, porque el tope ya lo recortó. Se cobra aunque el empujón no logre mover al bot (por el rozamiento, ver abajo), pero nunca más de la energía que le queda. Los cadáveres y los bots fijos no se empujan ni pagan.

Este bot compra 500 cloroplastos al nacer y después empuja a fondo:

```adn
' Compra 500 cloroplastos al nacer y, desde el ciclo 5, empuja a fondo
cond
  *.robage 0 =
start
  500 .mkchlr store
stop

cond
  *.robage 4 >
start
  40 .up store
stop
end
```

<!-- comprobado: masa ~490, 40 de energía por ciclo, .velscalar 4 en el ciclo 80; muere en el 82 -->
Pesa unos 490. Con el costo de mover en 1 paga 40 por ciclo y gana apenas 0,05 de velocidad: después de unos 75 ciclos empujando va a 4 y se queda sin energía. Un bot sin cloroplastos llega a 40 en dos ciclos por el mismo precio.

## Rozamiento con el suelo {#rozamiento}
<!-- 30-FISICA §2 (FrictionForces; corrección de fricción estática en P1); comprobado con Zgravity 2, 0,6 y 0,4 -->

El rozamiento existe solo si [[param:opt:19]] es distinta de 0: esa gravedad aprieta a los bots contra el suelo. Tiene dos partes:

- **Dinámico** ([[param:opt:17]]): en cada ciclo le resta a la rapidez masa × gravedad Z × coeficiente, sin pasarse de 0. Esa resta no se divide por la masa: a un bot pesado lo frena mucho más.
- **Estático** ([[param:opt:16]]): si el bot está quieto y la suma de lo que lo empuja en ese ciclo es menor que masa × gravedad Z × coeficiente, no se mueve. Si ya se mueve, solo frena los empujes de costado.

Las reglas F1 usan gravedad Z 2, estático 0,6 y dinámico 0,4. Un bot de masa 1 pierde entonces 0,8 de rapidez por ciclo, y para arrancar necesita un empuje efectivo mayor que 1,2: `1 .up store` (0,66) no lo mueve y aun así se cobra, `2 .up store` (1,32) sí. El mismo umbral crece con la masa: con el tope de 180 de F1, un bot de más de unos 100 de masa no puede arrancar con su propio empuje.

## El fluido: densidad y viscosidad {#fluido}
<!-- 30-FISICA §1.1 (AddedMass), §2 (SphereDragForces, tope 0,99·v); comprobado: arrastre 0 con viscosidad 0 -->

Con [[param:opt:14]] y [[param:opt:15]] distintas de 0, el mundo es un fluido. El arrastre resta de la velocidad una parte que crece con la rapidez y con el radio (como el rozamiento dinámico, no depende de la masa), y nunca más del 99 %. Si alguna de las dos vale 0, no hay arrastre. La densidad además suma la _masa añadida_, el fluido que el bot arrastra consigo: más inercia, sin más peso para la gravedad.

Este bot empuja tres ciclos y después se deja llevar:

```adn
' Empuja tres ciclos y después se deja llevar
cond
  *.robage 3 <
start
  40 .up store
stop
end
```

<!-- comprobado en un campo de 20000 × 20000; fluido suave: densidad 1e-7 y viscosidad 0,00005; agua: 1e-7 y 0,0005 -->
Su [[.velscalar]] (cuerpo 1000, tope 40) en cuatro mundos distintos:

| Ciclo | Sin roce ni fluido | Rozamiento F1 | Fluido suave | «Agua» |
|---|---|---|---|---|
| 1 | 26 | 26 | 20 | 20 |
| 3 | 40 | 40 | 40 | 20 |
| 4 | 40 | 39 | 31 | 0 |
| 10 | 40 | 34 | 9 | 0 |
| 20 | 40 | 26 | 2 | 0 |
| 40 | 40 | 10 | 0 | 0 |

El rozamiento frena de a poco y parejo; el fluido, en proporción a la velocidad. Con los valores que la app sugiere para el agua, el bot no pasa de 20 mientras empuja y se clava apenas deja de hacerlo.

## Gravedad, flotabilidad y mareas {#gravedad}
<!-- 30-FISICA §2 (GravityForces); 31-ENERGIA §1; Robots.bas mareas: Ygravity = (1−s)·4, PhysBrown 10; comprobado: +1 de velocidad por ciclo con Ygravity 1 -->

[[param:opt:20]] tira de todos hacia abajo: cada ciclo suma ese valor a la velocidad hacia abajo, pese lo que pese el bot y sin pasar por la eficiencia. Con 1, un bot quieto cae a 1, 2, 3… hasta el tope. En un mundo con paredes termina en el fondo; si arriba y abajo están conectados, cae para siempre y reaparece arriba.

En el modo estanque ([[param:opt:30]]), con gravedad y sin conectar arriba con abajo, cada bot elige una altura con su flotabilidad ([[.setboy]], que se lee en [[.rdboy]]). Si está más arriba de esa altura, la gravedad lo hunde; si está más abajo, lo empuja hacia arriba. Flotar cuesta energía en cada ciclo, en proporción a la flotabilidad, a la gravedad y a la masa (que cuenta hasta 192), con el precio de [[param:cost:20]].

<!-- Bestiario: B-Alpha_Pond_F2_K0zm0_-25.04.04.txt -->
_B-Alpha_, del Bestiario, es un bot de estanque: al nacer pide bajar su flotabilidad (con 0 se va al fondo) y, cuando llega a cierta profundidad, se clava y deja de pedir flotabilidad:

```adn
cond
*.depth 6500 >
*.fixed 0 =
start
1 .fixpos store
0 .setboy store
stop
```

Con las mareas ([[param:opt:64]]) el mundo maneja la gravedad por su cuenta: la sube y la baja entre 0 y 4 a lo largo del período, corre las alturas de flotación, y mientras la gravedad está baja enciende el browniano.

## Movimiento browniano {#browniano}
<!-- 30-FISICA §2 (BrownianForces: 3 extracciones; I = PhysBrown·0,5·rnd); comprobado con PhysBrown 10 -->

Con [[param:opt:13]] distinto de 0, cada bot recibe en cada ciclo un empujón al azar, en una dirección al azar y de hasta la mitad de ese valor, más un pequeño giro al azar. Como todo empujón, se divide por la masa: a los bots pesados apenas los sacude. Es la única fuerza que usa números al azar.

## Choques entre bots {#choques}
<!-- 30-FISICA §0.5, §4.2, §4.3 (Repel3) -->

Dos bots chocan cuando sus círculos se superponen. El mundo lo revisa en _fuerzas y choques_, con las posiciones del final del ciclo anterior, una sola vez por par. Chocan todos: vivos, vegetales y cadáveres. Cada choque hace tres cosas:

**Los separa.** Si los dos están quietos (o los dos fijos), cada uno retrocede la mitad de lo que se superponen y quedan apenas tocándose. Si no, se corrigen solo una parte por ciclo, que depende de [[param:opt:18]]: con 0 se deshace cerca de un cuarto de la superposición, con 1 casi toda. El más liviano es el que más se corre.

**Les cambia la velocidad.** Solo cuenta la parte de la velocidad sobre la línea que une los centros; la de costado no cambia. Con elasticidad 0 (el valor por defecto, y el de F1) el choque es blando: los dos terminan con la misma velocidad en esa dirección, como si uno empujara al otro. Con 1 rebotan como bolas de billar. Un bot fijo cuenta como masa 32000 y no cambia su velocidad.

**Les avisa.** Los dos leen [[.hit]] en el ciclo siguiente, con el lado del golpe en [[.hitup]], [[.hitdn]], [[.hitdx]] o [[.hitsx]], y sus sysvars `ref*` se llenan con los datos del otro aunque no lo estén viendo (ver [[sysvars/contacto]] y [[sysvars/ref]]).

## Choques con formas {#formas}
<!-- 30-FISICA §4.4 (DoObstacleCollisions: amortiguación vel·0,5, anti-atasco ±200 a la tercera forma, REFTYPE = 1) -->

Las formas del mundo ([[simulacion/mundo]]) son rectángulos sólidos. Un bot que se mete en una vuelve a quedar afuera, apoyado en el lado más cercano. Si venía desde afuera, además pierde parte de su velocidad en ese eje (la mitad si pesa 1, menos cuanto más pesa) y lee [[.hit]] con el lado del golpe; si estaba metido de lleno, en cambio, recibe un empujón hacia afuera. Si en ese momento sus ojos no ven nada, [[.reftype]] vale 1. Si se superpone con tres formas a la vez, el mundo lo saca de un salto de 200 en cada eje para que no quede atrapado. Una forma no enciende [[.edge]].

## Los bordes del mundo {#bordes}
<!-- 30-FISICA §5 (bordercolls, ReSpawn del organismo entero); comprobado: reposo en el fondo con .velscalar 20 y .edge 1 -->

Cada par de bordes puede estar conectado o ser una pared: [[param:opt:2]] y [[param:opt:3]] (si están los dos, el mundo es [[param:opt:1]]).

- **Conectados.** El bot que sale por un lado entra por el opuesto. Si es un multicelular, el mundo traslada el organismo entero de una vez ([[simulacion/lazos]]).
- **Pared.** El bot que toca el borde queda acomodado contra él, lee [[.edge]] en 1 y pierde un 5 % de la velocidad en ese eje (dividido por su masa). No rebota y no se le borra la velocidad: si sigue yendo hacia afuera, queda pegado a la pared, y como la acomodación pasa antes del movimiento, puede asomar un poco más allá del borde.

Con gravedad 1 y paredes, un bot quieto cae al fondo y se queda ahí leyendo [[.velscalar]] 20 y [[.edge]] 1 en cada ciclo: la gravedad y el freno de la pared se empatan. Para saber si un bot está trabado, mirá [[.edge]] o compará su posición entre ciclos, no su velocidad.

## El rumbo y el giro {#giro}
<!-- 30-FISICA §7 (SetAimFunc: prioridad de setaim, costo |Round((diff+diff2)/200,3)|·TURNCOST, ma); comprobado: 314 .aimsx cuesta 1,57; de 0 a 1200 con 1200 .setaim 6,56 y con -56 .setaim 0,28 -->

El bot gira en _movimiento_, antes de moverse: [[.aimsx]] y [[.aimdx]] giran _tanto_, [[.setaim]] gira _hasta_ un rumbo, y si escribís en `.setaim` un rumbo distinto del actual, manda ese. Un bot fijo también puede girar.

Girar cuesta [[param:cost:21]] (multiplicado por el [[param:cost:54]]) por cada 200 unidades de giro: un cuarto de vuelta (314) sale 1,57 y una vuelta entera, 6,28. Con `.setaim` el giro es el más corto hasta el rumbo pedido, pero el costo depende del _número_ que escribís: si queda a más de media vuelta del rumbo actual, cuenta como número, se cobran además tantas vueltas enteras como entren en la diferencia, redondeando (1256 por vuelta).

```adn
' Mira a 0 al nacer; en el ciclo 3 gira a 1200 escribiendo -56
cond
  *.robage 0 =
start
  0 .setaim store
stop

cond
  *.robage 2 =
start
  -56 .setaim store
stop
end
```

Con el costo de girar en 1, este bot paga 0,28 por pasar de 0 a 1200. Si escribe `1200` en lugar de `-56`, termina en el mismo rumbo pero paga 6,56. Para no pagar de más, calculá el rumbo nuevo a partir del actual (por ejemplo, `*.aim 100 add`) o girá con `.aimsx` y `.aimdx`.

**El giro tiene inercia.** El browniano y los lazos ([[simulacion/lazos]]) pueden dejarle al bot un giro propio que se suma al rumbo en cada ciclo, aunque el ADN no pida nada. El rozamiento lo frena, el fluido lo anula casi siempre, y un giro voluntario en sentido contrario lo descuenta. Un giro en el mismo sentido no lo aumenta.

## Bots fijos {#fijos}
<!-- 30-FISICA §2 (gate Not Fixed), §4.3 (fijo = masa 32000; la separación posicional mueve también al fijo), §6 (vel = 0) -->

Un bot con [[.fixpos]] mayor que 0 queda clavado: no recibe ninguna fuerza (ni su empuje, ni la gravedad, ni el browniano), su velocidad es 0 y en los choques cuenta como un muro de masa 32000. Lo único que lo puede correr un poco es la separación de un choque o una forma que se le meta encima. [[param:opt:72]] desactiva la fijación para todos.

## Los parámetros, de un vistazo {#parametros}
<!-- spec/constants.yaml (valores por defecto); web2/engine/opciones.js (F1_OPTS, F1_COSTOS) -->

| Parámetro | Qué cambia | Por defecto | F1 |
|---|---|---|---|
| [[param:opt:11]] | Tope de velocidad y del empujón | 40 | 180 |
| [[param:opt:12]] | Parte del empuje que se vuelve movimiento | 0,66 | no la cambia |
| [[param:opt:19]], [[param:opt:16]], [[param:opt:17]] | Rozamiento con el suelo | 0 | 2; 0,6; 0,4 |
| [[param:opt:14]], [[param:opt:15]] | Arrastre del fluido | 0 | 0 |
| [[param:opt:20]] | Gravedad hacia abajo | 0 | 0 |
| [[param:opt:13]] | Empujones al azar | 0 | 0 |
| [[param:opt:18]] | Rebote de los choques | 0 | 0 |
| [[param:opt:10]] | Frenar en seco cada ciclo | no | no la cambia |
| [[param:opt:2]], [[param:opt:3]] | Bordes conectados | no | sí |
| [[param:cost:20]], [[param:cost:21]] | Precio de empujar y de girar | 0 | 0,05; 0 |

Todos están en [[app/parametros-fisica]], salvo los bordes ([[app/parametros-campo]]) y los costos ([[app/parametros-costos]]).
