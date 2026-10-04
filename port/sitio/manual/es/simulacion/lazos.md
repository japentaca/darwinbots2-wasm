---
titulo: Lazos y multicelulares
resumen: "Cómo se ata un bot a otro, cómo se comporta el lazo como un resorte, qué viaja por él y cómo, con lazos endurecidos, varios bots forman un organismo multicelular."
etiquetas: [lazos, tie, multicelular, resorte, compartir, comunicación]
estado: revisada
---
Un _lazo_ (en inglés _tie_) une a dos bots. Físicamente es un resorte que los
mantiene a cierta distancia; además es un canal: por él cada bot siente al
otro, le escribe en la memoria y le pasa o le saca recursos. Con lazos
endurecidos, varios bots dejan de ser individuos sueltos y forman un
_multicelular_ (_multibot_): un organismo que reparte la energía, sostiene su
forma y se mueve como una sola cosa.

Esta página cuenta el mecanismo de conjunto. Cada celda tiene su página en la
referencia, agrupadas en [[sysvars/lazos]].

## Dos formas de tener un lazo {#tipos}
<!-- 34-TIES §1 (caminos de creación: .tie last −20, nacimiento last 100) -->

| | Lazo de nacimiento | Lazo hecho con [[.tie]] |
|---|---|---|
| Cuándo | Todo parto ata al padre con el hijo | Cuando el bot lo pide |
| Cuánto dura | Se corta solo a los 100 ciclos | Hasta que se corte o se rompa |
| Se endurece | Nunca | A los 19 ciclos |
| Quién lo crea | El padre | El bot que escribió `.tie` |

## Cómo se crea un lazo {#crear}
<!-- 34-TIES §0.1, §0.3, §0.5, §1; core robots.hpp FireTies (P5, al final de las acciones; fallback padre si age < 2, si no lasttch; DisableTies solo frena .tie); maketie (length ≤ 1.5·c, deflect Random(2,92) < slime, slime −20, TIECOST/(numties+1)) -->

Escribís un número distinto de 0 en [[.tie]] y, al final de la fase de
acciones, el motor intenta atarte al bot que estás viendo (el mismo que
describen [[.refeye]] y compañía). Si no ves a nadie, en tus dos primeros
ciclos de vida prueba con tu padre, y si no, con el último bot que te tocó.
El atajo del padre es fiable al principio de una simulación; más adelante,
cuando los bots ya nacieron y murieron muchas veces, puede no encontrarlo, así
que conviene que el hijo lo esté mirando.
<!-- core FireTies: rob(.parent) indexa con el número absoluto del padre como si fuera su lugar (se replica el original; solo coincide en sims jóvenes) -->
La orden se borra siempre, salga o no.

Para que el lazo se forme:

- El otro tiene que ser un bot, no una forma del escenario, y estar cerca:
  unos 400 de borde a borde como mucho.
- Su baba ([[.slime]]) puede desviar el intento: el motor sortea un número
  entre 2 y 92 y, si la baba del otro es mayor, no hay lazo. Con más de 92 de
  baba nadie lo puede atar. Cada intento, salga o no, le gasta 20 de baba.
- Ninguno de los dos puede tener ya 9 lazos, que es el máximo.

Cada intento con alguien a tiro cuesta energía: el costo de atar
([[param:cost:22]]) dividido por la cantidad de lazos que ya tenés más uno.
Si ya había un lazo entre esos dos bots, el nuevo lo reemplaza: vuelve a
contar desde cero y pasa a ser un lazo de `.tie`.

La opción [[param:opt:70]] de la app desactiva `.tie` para todos; los lazos
de nacimiento se siguen formando igual. En los torneos, la opción de
descalificación ([[param:opt:93]]) puede prohibir atarse o pasarle recursos a
un rival por un lazo.

## Los puertos: cómo se llama cada lazo {#puertos}
<!-- 34-TIES §0.2 (Port = mem(tie) para el creador; slot para el receptor); comprobado con probar-adn: el hijo que se ata con 7 tiene .tiepres 7 y el padre .tiepres 1 -->

Un bot puede tener varios lazos, así que cada uno tiene un número, su
_puerto_. Lo importante es que **cada extremo lo llama con un número
distinto**:

```
   hijo: escribió 7 .tie                        padre: recibió el lazo
   lo llama 7   ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●  lo llama 1
   (el número que puso)                          (su número de orden: es su primer lazo)
```

Quien crea el lazo lo llama con el número que escribió en `.tie`. Quien lo
recibe lo llama con su número de orden entre sus lazos: 1 si es el primero, 2
si es el segundo. Cuando se forma un lazo, [[.tiepres]] de cada uno queda con
el nombre que ese bot le da.

Con ese número elegís sobre qué lazo actúa cada orden: [[.tienum]] para
escribir y transferir, [[.readtie]] para leer, [[.deltie]] para cortar. Si
dejás `.tienum` en 0, la mayoría de las órdenes usan el lazo de `.tiepres`.

## El lazo de nacimiento {#nacimiento}
<!-- 34-TIES §1 (nacimiento: last = 100, Port = 0 del lado del padre), §4.3 (puerto 0); core robots.hpp maketie(n, nuovo, …, 100, 0); DoGeneticMemory (Ties(1).last > 0); comprobado con probar-adn: el lazo dura 99 ciclos, el hijo escribe en la memoria del padre por el puerto 1 y el padre no puede escribirle; re-atarse con .tie corta la memoria genética -->

Todo parto ata al padre con el hijo. Es un lazo blando, que nunca se
endurece, y se corta solo a los 100 ciclos. Tiene una rareza: lo crea el
padre con el puerto 0, y un 0 no sirve para elegir lazos. Por eso:

- El **hijo** lo ve como su lazo 1 y puede usarlo para todo: escribirle al
  padre, pasarle o sacarle energía, cortarlo con `1 .deltie store`.
- El **padre** no puede escribir ni transferir por él, ni cortarlo. Sí lo
  siente: sus celdas [[sysvars/tref|tref]] describen al hijo desde el ciclo
  siguiente al parto.

Mientras dura, por este lazo llega la _memoria genética_: las celdas 976 a
990 que el padre tenía al momento del parto le llegan al hijo de a una por
ciclo, durante sus primeros 15 ciclos (ver [[adn/memoria#memoria-genetica]]).

:::cuidado
Si el hijo se ata al padre con `.tie` apenas nace (la receta habitual de un
multicelular), el lazo nuevo **reemplaza** al de nacimiento y las entregas de
memoria genética que faltaban no llegan.
:::

## La física del lazo {#fisica}
<!-- 30-FISICA §3.1 (muelle con zona muerta 20; k/b blando 0.01/0.02, hueso 0.05/0.1; rotura > 1000 + radios), §3.2 (TieTorque: holgura 5°); 34-TIES §0.4 (regang fija ángulo y largo actuales, solo el lado no-back fija ángulo) -->

Un lazo es un resorte con amortiguador. Recuerda un _largo de reposo_ (la
distancia entre los dos bots en el momento en que se formó) y, si los bots se
alejan o se acercan de más, tira o empuja para volver a ese largo, frenando a
la vez las oscilaciones. Tolera unas 20 unidades de diferencia sin hacer
fuerza, así que los bots atados suelen quedar balanceándose cerca del largo
pedido.

Un lazo nace **blando** y, si se hizo con `.tie`, a los 19 ciclos se
**endurece**:

| | Blando | Endurecido |
|---|---|---|
| Fuerza del resorte | baja | unas cinco veces más |
| Largo de reposo | la distancia al formarse | la distancia al endurecerse |
| Ángulo | libre: los bots giran uno alrededor del otro | fijo, visto desde el bot que creó el lazo |
| Se puede ajustar | no | sí: largo, ángulo y rigidez |

El ángulo fijo convierte al lazo en algo parecido a un brazo: el compañero
tiene que quedar en una dirección dada respecto de hacia dónde apunta el bot
([[.aim]]). Si se sale de ahí, el motor hace girar al bot y empuja al
compañero de costado hasta recuperarlo, con una holgura de 5 grados que no
corrige.

En un lazo endurecido podés cambiar las tres cosas, desde cualquiera de los
dos extremos:

- [[.fixlen]] cambia el largo de reposo, medido de borde a borde.
- [[.fixang]] cambia el ángulo, o lo suelta con un valor negativo. Para los
  cuatro primeros lazos también sirven [[.tieang1]] a `.tieang4` y
  [[.tielen1]] a `.tielen4`, que se leen y se escriben.
- [[.stifftie]] cambia la rigidez, de 1 a 100. Un lazo recién endurecido
  equivale a 20; uno blando, a 4.

Para medir: [[.tieang]] y [[.tielen]] dicen la dirección y la distancia del
compañero del lazo de `.tiepres`.

Un lazo se rompe solo si los bots quedan a más de 1000 de borde a borde, y se
borra si el otro bot desaparece del mundo. Un compañero que muere y queda
como cadáver **sigue atado** hasta que el cadáver se descompone.

Este organismo de dos células se separa a 300 y pone al compañero de costado
en cuanto el lazo se endurece:

```adn
' Dos celulas: el hijo se ata al padre y, endurecido el lazo, le da forma
cond
 *.robage 5 =
 *.numties 0 =
start
 50 .repro store
stop
cond
 *.robage 1 =
start
 7 .tie store
stop
cond
 *.multi 1 =
start
 300 .fixlen store
 314 .fixang store
stop
```

<!-- comprobado con probar-adn (campo 3000x3000): multi a los ~20 ciclos del lazo; tielen oscila entre 250 y 400 y se asienta cerca de 280-330; tieang ronda −300 en los dos -->
Corriéndolo, la distancia oscila al principio entre 250 y 400 y se asienta
cerca de 300; el compañero queda a unos 314 de ángulo, un cuarto de vuelta.
Los dos lo piden, así que los dos lo sostienen.

## Endurecerse: los multicelulares {#multicelulares}
<!-- 34-TIES §3 (Multibot = True en regang; False con numties 0; costes divididos; vbody); core robots.hpp makeshell/makeslime (÷ numties+1 si Multibot), shots.hpp robshoot (−1/−6 ×(nt+1) si Multibot; SHOTCOST ÷ (nt+1) siempre), newshot (vbody → alcance); Multibots.bas ReSpawn (30-FISICA §5) -->

Cuando un lazo de `.tie` se endurece, **los dos bots** pasan a ser
multicelulares: [[.multi]] vale 1. Siguen así mientras les quede algún lazo,
aunque no sea el endurecido; con 0 lazos, `.multi` vuelve a 0. Como el lazo
de nacimiento no se endurece, padre e hijo no son un organismo solo por haber
nacido juntos: alguno tiene que atarse con `.tie`.

Ser multicelular habilita y abarata cosas:

- **Compartir** recursos con [[.sharenrg]] y sus parientes (ver más abajo).
- **Dar forma** a los lazos endurecidos, como en el ejemplo anterior.
- **Pagar menos.** Fabricar caparazón ([[.mkshell]]) y baba ([[.mkslime]])
  cuesta lo normal dividido por la cantidad de lazos más uno. El costo de un
  disparo común se divide igual con solo tener lazos, aunque no seas
  multicelular.
- **Pegar más fuerte.** Los disparos que sacan energía o cuerpo ([[.shoot]]
  con `-1` o `-6`) calculan su fuerza como si tu cuerpo se multiplicara por la
  cantidad de lazos más uno, y el alcance de los disparos crece con el cuerpo
  de todo el organismo (ver [[simulacion/disparos]]).

En un mundo que da la vuelta por los bordes, cuando una célula cruza el borde
el motor traslada al organismo entero, hasta 50 células conectadas, para que
no quede partido en dos (ver [[simulacion/fisica#bordes]]).

## Comunicarse por el lazo {#comunicarse}
<!-- 34-TIES §2 (tabla: tieportcom P1 con tienum ≠ 0 y tieloc 1..1000; readtie P1); 21-MEMORIA; páginas de referencia tref, entradas-salidas, tieloc -->

Hay tres formas, de la más mansa a la más invasiva:

| Para | Escribís | El otro |
|---|---|---|
| Sentirlo, sin hacer nada | [[.readtie]] elige el lazo | Nada: vos leés sus [[sysvars/tref|tref]] (energía, edad, posición, firma…) |
| Publicar un dato | [[.tout1]] … `.tout10` | Lo lee en [[.tin1]] … `.tin10` si escucha ese lazo |
| Escribirle en la memoria | [[.tienum]], [[.tieloc]] (1 a 1000) y [[.tieval]] | Encuentra el valor escrito en esa celda |

La tercera es poderosa: podés escribir en cualquier celda del otro, incluso
en sus órdenes (un [[.up]] o un [[.shoot]] ajeno). Ocurre en la fase de
fuerzas y choques, después de que corrió el ADN de todos, así que el otro lo
lee en su próximo turno. Para usarla, `.tienum` tiene que ser distinto de 0;
no alcanza con `.tiepres`.

```adn
' El hijo le avisa al padre por el lazo de nacimiento
cond
 *.robage 5 =
 *.numties 0 =
start
 50 .repro store
stop
cond
 *.robage 1 =
 *.numties 0 >
start
 1 .tienum store
 60 .tieloc store
 1234 .tieval store
stop
```

<!-- comprobado con probar-adn: la celda 60 del padre pasa a 1234 al ciclo siguiente; el hijo usa el puerto 1 del lazo de nacimiento -->
El hijo, cuando su [[.robage]] vale 1, escribe 1234 en la celda 60 del padre
por el puerto 1. El padre no podría hacer lo mismo por ese lazo: para él se llama
0.

## Pasar y compartir recursos {#recursos}
<!-- 34-TIES §2 (transferencias tieloc negativo P3; sharing solo multibot y ties no-back), §2.1 (sharenrg: límite por body, 1 %, se borra cada ciclo); README B4-2 (el exceso sobre 32000 pasa al otro); comprobado con probar-adn: con 90 .sharenrg el hijo pasa de 1498 a 1993, 2488 y 2686, de a 500 (su body) por ciclo -->

Hay dos mecanismos, y conviene no mezclarlos.

**Transferencias puntuales.** Con [[.tieloc]] negativo y una cantidad en
[[.tieval]] le das al otro (positivo) o le sacás (negativo) energía (`-1`),
veneno (`-3`), desecho (`-4`) o cuerpo (`-6`). Funciona con cualquier lazo,
blando o endurecido, y con cualquier bot, sea o no de tu especie: es la base de
los parásitos que se atan a su presa y la vacían. Los topes por ciclo y lo
que se pierde en el camino están en la página de `.tieloc`.

**Compartir.** Solo entre multicelulares. Con [[.sharenrg]] escribís un
porcentaje: por cada lazo, el motor suma tu energía y la del compañero y te
deja ese porcentaje del total; el resto queda para él. Hacen lo mismo
[[.sharewaste]] (desecho), [[.shareshell]] (caparazón), [[.shareslime]]
(baba) y [[.sharechlr]] (cloroplastos, solo entre parientes cercanos).
Tres cosas a tener en cuenta:

- **Solo comparte el que creó el lazo.** Desde el otro extremo la orden no
  hace nada. En la receta de siempre, el hijo se ata al padre, así que es el
  hijo quien tiene que pedir el reparto.
- **Hay que pedirlo cada ciclo.** El motor borra las órdenes de compartir en
  todos los bots en cada ciclo.
- **El reparto es gradual.** En un ciclo no se mueve más energía que tu cuerpo
  ([[.body]]), y quien pide paga el 1 % de lo que se movió.

```adn
' Organismo de dos celulas que reparten la energia en partes iguales
cond
 *.robage 5 =
 *.numties 0 =
start
 50 .repro store
stop
cond
 *.robage 1 =
start
 7 .tie store
stop
cond
 *.multi 1 =
start
 50 .sharenrg store
stop
```

<!-- comprobado con probar-adn: los dos pasan a .multi 1 a los 21 ciclos del hijo; con 100 .sharenrg el padre queda en 0 y se vuelve cadáver atado -->
Con 50 los dos quedan parejos. Ojo con los extremos: `100 .sharenrg store`
significa «todo para mí». Probado con este mismo bot, el hijo deja al padre
sin energía en pocos ciclos y el padre se vuelve un cadáver, que sigue atado.

:::nota
En el DarwinBots original, si al repartir uno de los dos superaba el tope de
32000, el exceso se perdía. En esta versión pasa al otro bot, hasta su propio
tope.
:::

## Cortar un lazo {#cortar}
<!-- 34-TIES §1 (DeleteTie: ambos extremos; borrados automáticos); core Update_Ties (deltie compara con el puerto propio) -->

Un lazo desaparece de los dos lados cuando:

- cualquiera de los dos escribe su puerto en [[.deltie]];
- los bots se separan más de 1000 de borde a borde;
- uno de los dos desaparece del mundo (un cadáver no cuenta: sigue ahí);
- se cumplen los 100 ciclos, si es un lazo de nacimiento;
- alguno de los dos se ata de nuevo al otro con `.tie`, que lo reemplaza.

Cuando se corta el lazo que señalaba `.tiepres`, esa celda pasa al lazo
anterior de la lista. [[.numties]] siempre dice cuántos quedan.

## En el Bestiario {#bestiario}
<!-- port/web/bots: Snap_Tie_bot.txt (.tie 1 rnd mult inc, 10000 .fixlen, -6 .tieloc con chequeo de dnalen por tmemloc, 100 .sharenrg); 190 bots del Bestiario escriben .sharenrg (grep) -->

Unos 190 bots del Bestiario usan [[.sharenrg]]. Uno chico y curioso es
_Snap Tie bot_: se ata al azar y pide un largo de 10000 con [[.fixlen]], así
el lazo revienta y el tirón lo mueve.

Para armar uno paso a paso, seguí el tutorial [[tutoriales/multibot]]; para
las estrategias, [[estrategias/multibots]].
