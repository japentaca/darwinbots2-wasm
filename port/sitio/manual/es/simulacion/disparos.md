---
titulo: Disparos
resumen: "Cómo nace un disparo, cuánto viaja, a quién le pega y qué hace cada tipo al llegar: robar energía o cuerpo, regalar, envenenar, ensuciar, fecundar o escribir en la memoria del otro."
etiquetas: [disparos, ataque, energía, sentidos, alcance]
estado: revisada
---
Un disparo es una partícula que un bot lanza hacia adelante y que viaja sola
por el mundo hasta que le pega a otro bot o se le acaba el alcance. Es la
forma de comer de casi todos los bots que no son vegetales, y también la de
atacar, regalar energía, paralizar o escribir en la memoria ajena. Esta página
cuenta el mecanismo de punta a punta; las sysvars que lo manejan están en
[[sysvars/disparos]].

## Del .shoot al disparo {#crear}
<!-- 33-SHOTS §2.1-2.2; 10-CICLO §0 (shots creados en P5 no se mueven hasta el updateshots siguiente), §5 P5 Shooting; core shots.hpp robshoot/newshot (Random(-20,20)/200 rad; pos + dir·radius; actvel + dir·40) -->

El ADN pide un disparo escribiendo un número distinto de 0 en [[.shoot]]. El
motor lo lanza más tarde, en la fase de _acciones_ de ese mismo ciclo, y deja
`.shoot` y [[.shootval]] en 0. El disparo nace en el borde del bot, del lado hacia el que
mira ([[.aim]]), y sale:

- con una pequeña desviación al azar, de hasta 20 unidades de ángulo (unos
  6 grados) para cada lado;
- a 40 unidades por ciclo, más la velocidad que traía el propio bot;
- hacia atrás si [[.backshot]] estaba puesta, o desviado si escribiste
  [[.aimshoot]].

Un disparo recién creado no se mueve en el ciclo en que nace: arranca en la
fase de _los disparos_ del ciclo siguiente. Si tu energía está en 0 o menos,
no sale nada.

Cada tipo cuesta distinto. Todos usan el [[param:cost:23|costo de disparar]]
del escenario, multiplicado como todos los costos por el
[[param:cost:54]]:

| Disparo | Lo que paga el tirador |
|---|---|
| −1 y −6 (robar) | el costo de disparar, dividido por la cantidad de lazos más uno |
| −1 y −6 con [[.shootval]] mayor que 4 o menor que −4 | ese valor multiplicado por el costo de disparar |
| −2 (regalo) | lo que regala, más el costo de disparar dividido por lazos más uno |
| −3 y −4 (veneno y desechos) | el costo de disparar dividido por lazos más uno; el veneno o los desechos salen de su reserva |
| positivo (memoria) y −8 (esperma) | el costo de disparar entero |

## Cuánto viaja {#alcance}
<!-- 33-SHOTS §2.2 (vbody > 10: nrg = Log(vbody)·60·rngmult, Range = (nrg+41)\40, nrg = Range·40; si no, Range = rngmult), §3.4 y §3.7 (decaimiento Atn; muere con age > Range); core shots.hpp newshot/updateshots; constants.yaml radio(1000 body) ≈ 114 -->

El alcance se mide en ciclos de vuelo y depende del cuerpo del tirador (en un
organismo atado, del cuerpo de todo el organismo; ver [[simulacion/lazos]]).
Crece despacio, como un logaritmo:

| Cuerpo del tirador | Ciclos de vuelo | Distancia aproximada desde su borde |
|---|---|---|
| 10 o menos | 1 | 40 |
| 100 | 7 | 280 |
| 1000 | 11 | 440 |
| 5000 | 13 | 520 |
| 32000 | 16 | 640 |

Un [[.shootval]] negativo en un disparo −1 o −6 estira el alcance: −8 lo
duplica y −16 lo triplica, y se cobra como se ve en la tabla de arriba.

El disparo no pega igual en todo el recorrido. Mientras vuela pierde fuerza,
muy poco al principio y de golpe al final:

| Parte del recorrido ya hecha | Fuerza que le queda |
|---|---|
| la mitad | 98 % |
| 80 % | 94 % |
| 90 % | 86 % |
| el último ciclo | nada |

Así que a la distancia justa del alcance el tiro llega sin fuerza: conviene
disparar a lo que está cerca. El regalo de energía (−2) puede quedar exento
con [[param:opt:54]] y el de desechos (−4) con [[param:opt:55]].

:::nota
Con 1000 de cuerpo, en una prueba con el tirador quieto, los blancos a unas
500 unidades de centro a centro perdían energía en cada disparo, y los que
estaban a más de 800 se veían en el [[.eye5]] pero no recibían nada. Para
medir la distancia sumá los radios: un bot de 1000 de cuerpo mide unos 114.
:::

En los bordes, un disparo pasa al otro lado si el mundo es toroidal y rebota
si hay pared. Contra una forma rebota también, salvo que el escenario tenga
[[param:opt:82]]. Los disparos no chocan entre sí.

## Cómo pega {#impacto}
<!-- 33-SHOTS §3 (orden por shot: colisión antes de mover, flash, muerte por edad), §4 (swept-sphere, dentro en t=0); README B3-1, B3-2, B3-5; core shots.hpp ShotFromBot, NewShotCollision, updateshots (inmunidad filial age <= 1) -->

En la fase de _los disparos_ de cada ciclo, el motor mira el tramo que cada
disparo va a recorrer en ese ciclo y busca el primer bot que se cruza en ese
tramo. Si lo hay, el disparo le pega ahí mismo, hace su efecto y desaparece.
Si no, avanza y envejece un ciclo; cuando supera su alcance, se esfuma.

Algunas reglas de a quién le pega:

- **Nunca al que lo disparó**, mientras ese bot siga vivo.
- **A cualquier otro, incluida tu especie.** No hay fuego amigo
  desactivado: un −1 a un hermano le roba energía igual.
- **No al hijo recién nacido del tirador**, en sus dos primeros ciclos de
  vida: así, un padre que está disparando no le pega a la cría que acaba de
  tener.
- **Sí a los cadáveres.** El disparo se gasta igual, aunque casi ningún tipo
  le haga nada a un cadáver (ver más abajo).

:::nota
En el DarwinBots 2.48.32 original la protección del recién nacido comparaba
mal los números de los bots y casi nunca funcionaba; los disparos de un bot
muerto, además, no podían pegarle al bot que ocupara su lugar en la lista; y
si dos bots se cruzaban en el mismo tramo, ganaba el que estaba antes en la
lista y no el que estaba más cerca. El port corrige las tres cosas: la
protección funciona, cualquier disparo huérfano pega, y gana el golpe más
temprano. Ver [[tecnico/diferencias]].
:::

## Qué hace cada tipo {#tipos}
<!-- 33-SHOTS §5 (tabla take*/release*, power = value·nrg/(Range·40)), §2.1; core shots.hpp releasenrg/takenrg/releasebod/takewaste/takesperm/takeven/takepoison; probado: tira.txt contra blanco.txt (-198 nrg y -2.2 body; +209 nrg y +0.88 body), tira6.txt (-102 nrg, -40.8 body; +484.5) -->

Cada disparo sale con un _valor_ (la fuerza con la que fue lanzado) y llega
con ese valor recortado por lo que perdió en el viaje. A eso lo llamamos la
_fuerza del golpe_.

### −1: robar energía {#energia}

El valor es 20 más la quinta parte del cuerpo del tirador: con 1000 de
cuerpo, 220. Un [[.shootval]] de 8 lo duplica, de 16 lo triplica (entre −4 y
4 no cambia nada). Al pegar en un bot vivo:

- la víctima pierde el 90 % de la fuerza en energía y el 1 % en cuerpo;
- desde el punto del golpe sale un disparo de regalo (−2) con toda la fuerza,
  de vuelta hacia el tirador, y con el doble de alcance.

Ese regalo de vuelta es la comida. Si otro bot se cruza en el camino, se lo
come él. Al llegar se reparte como cualquier −2 (ver abajo). En la prueba,
con 1000 de cuerpo, el blanco perdió 198 de energía y 2,2 de cuerpo, y el
tirador ganó 209 de energía y 0,88 de cuerpo.

Si a la víctima no le alcanza la energía, pierde toda la que tiene y el
regalo sale con eso. Si queda con 0,5 de energía o de cuerpo, muere, y el
tirador suma una muerte en [[.kills]]. A un cadáver, que ya no tiene
energía, un −1 no le saca nada.

Si la víctima tiene mucha toxina, en vez de regalo sale toxina hacia el
tirador: ver [[simulacion/defensas#toxina]].

### −6: robar cuerpo {#cuerpo}

El valor es 10 más la mitad del cuerpo del tirador (510 con 1000 de cuerpo),
con el mismo [[.shootval]] que el −1. El caparazón de la víctima frena
primero (ver [[simulacion/defensas#caparazon]]). Lo que pasa:

- a un bot vivo le saca el 20 % de la fuerza en energía y el 8 % en cuerpo
  (si no le alcanza una, la otra paga la diferencia);
- a un cadáver le pega con el cuádruple de fuerza y todo sale de su cuerpo;
- en los dos casos vuelve hacia el tirador un regalo con la fuerza entera.

Es el disparo más rendidor y el que sirve para comer cadáveres. En la
prueba, contra un blanco de 1000 de cuerpo sin caparazón, el blanco perdió
102 de energía y 40,8 de cuerpo y el tirador ganó 484,5 de energía.

### −2: regalar energía {#regalo}

El tirador manda lo que diga [[.shootval]] (sin signo y nunca más de lo que
tiene; con 0, el 1 % de su energía). Quien lo recibe se queda con el 95 % en
energía, un poco más en cuerpo (el equivalente al 4 %) y un 1 % se le vuelve
desecho. Si pasa de 32000 de energía, el 10 % del exceso va al cuerpo. Los
cadáveres no lo aprovechan.

### −3: veneno {#veneno}

Manda veneno de la reserva del tirador ([[.venom]]): lo que diga
[[.shootval]], o la vigésima parte si vale 0. Paraliza a la víctima y le
hace escribir en su memoria lo que elegiste. Todo el mecanismo está en
[[simulacion/defensas#veneno]].

### −4: desechos {#desechos}

Manda desechos: lo que diga [[.shootval]] (sin signo, hasta lo que tengas) o
la vigésima parte de tu [[.waste]] si vale 0. El tirador se libra del 99 % de
lo que manda: el 1 % se le queda en [[.waste]] y, además, otro 1 % pasa a su
[[.pwaste]], que no se puede tirar. La víctima suma la fuerza del golpe a sus
desechos, hasta 32000.
<!-- core robshoot −4: Waste −= 0,99·value; Pwaste += value/100; takewaste con tope 32000 (port/README B3-6) --> Más desechos de la cuenta le
escriben basura en la memoria (ver [[simulacion/energia]]). El motor también expulsa desechos
así por su cuenta cuando un bot tiene demasiados.

### −8: esperma {#esperma}

Lleva una copia del ADN del tirador. Al pegar, deja a la víctima fecundada
por unos 10 ciclos ([[.fertilized]]) con ese ADN, lista para una
reproducción sexual; si ya estaba fecundada, el ADN nuevo reemplaza al
anterior. Ver [[simulacion/reproduccion]].

### Positivo: escribir en la memoria {#memoria}

Un número positivo en `.shoot` es una dirección: el disparo escribe tu
[[.shootval]] en esa dirección de la memoria de la víctima. Se toma módulo
1000 (1050 escribe en la 50), la 340 ([[.delgene]]) está protegida y un
múltiplo exacto de 1000 da un disparo de esperma. Lo escrito queda en la
memoria del otro, y su ADN lo lee en el ciclo siguiente.

La toxina lo frena: si la víctima tiene al menos la mitad de la energía del
disparo en [[.poison]] (220 para un tirador de 1000 de cuerpo), no se
escribe nada y sale toxina hacia el tirador.

### Virus y toxina {#otros}

Los virus (−7) no salen de `.shoot`: se arman con [[.mkvirus]] y se lanzan
con [[.vshoot]] (ver [[simulacion/virus]]). La toxina (−5) tampoco: solo
nace como respuesta de un bot tóxico (ver [[simulacion/defensas#toxina]]).
Los demás negativos no disparan nada.

### Con intercambio fijo {#fijo}
<!-- 33-SHOTS §5 (EnergyExType/EnergyProp/EnergyFix); core releasenrg/releasebod -->

Todo lo de arriba vale con el [[param:opt:60]] proporcional, el de fábrica.
Con el fijo, cada −1 o −6 pega siempre con la [[param:opt:61]] (200 por
defecto), sin importar el cuerpo del tirador, su [[.shootval]] ni la
distancia. Con el proporcional, la [[param:opt:62]] multiplica la fuerza de
esos dos tipos.

## Lo que siente quien recibe {#sentir}
<!-- 32-VISION §5 (taste: shflav, shang = dang·200, shup/shdn/shdx/shsx); 10-CICLO §2 (EraseSenses antes de updateshots); core shots.hpp updateshots (taste en todo golpe); probado: responde.txt contra tira.txt (gira en el ciclo 9 y en el 11 ya le devuelve el fuego) -->

Cada golpe deja en la víctima un _sabor_, haya hecho daño o no (un disparo
que frena el caparazón también se siente):

- [[.shflav]]: el tipo del disparo (−1, −2, −6…; para uno de memoria, la
  dirección; −5 si es toxina).
- [[.shang]]: desde qué ángulo llegó, medido como [[.aimdx]].
- [[.shup]], [[.shdn]], [[.shdx]] y [[.shsx]]: el tipo, en la que corresponde
  al lado del golpe.

El motor los escribe en la fase de _los disparos_, así que tu ADN los lee en
el ciclo siguiente, y los borra después de que corrió. Si te pegaron varios,
queda el último. Ojo: el que caza con −1 también siente su comida, porque el
regalo de vuelta le marca −2.

Este bot, si le roban energía, gira hacia el tirador y le devuelve el fuego:

```adn
' Si me roban energia, giro hacia el tirador y le devuelvo el fuego
cond
 *.shflav -1 =
start
 *.shang .aimdx store
stop

cond
 *.eye5 0 >
start
 -1 .shoot store
stop
```

En la prueba, contra un cazador que le pegó en el ciclo 8, el bot giró en el
9, ya lo tenía en el [[.eye5]] y desde el 11 los dos se robaban energía
mutuamente.

## Un cazador mínimo {#ejemplo}
<!-- Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (dispara con *.eye5 50 > y *.refeye *.myeye !=) -->

_Animal Minimalis_, del Bestiario, resume todo lo anterior en un gen: dispara
−1 solo cuando lo que ve está cerca (`*.eye5 50 >`) y no es de su especie
(`*.refeye *.myeye !=`, ver [[sysvars/ref]]), y mientras tanto acompaña al
blanco copiando su velocidad ([[.refveldx]], [[.refvelup]]).

```adn
' Del gen de ataque de Animal Minimalis
cond
 *.eye5 50 >
 *.refeye *.myeye !=
start
 -1 .shoot store
 *.refveldx .dx store
 *.refvelup .up store
stop
```

El paso a paso para escribir un cazador propio está en
[[tutoriales/dispara]].
