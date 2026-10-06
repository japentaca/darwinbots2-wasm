---
titulo: Reproducción
resumen: "Cómo tiene hijos un bot, solo o con pareja: qué se lleva el hijo, dónde nace, qué hereda, cómo se mezcla el ADN en la sexual y por qué un parto puede fallar."
etiquetas: [reproducción, asexual, sexual, esperma, herencia, lazo de nacimiento]
estado: revisada
---
Un bot no fabrica hijos de la nada: se _parte_. Escribe un porcentaje y, si
puede, al final del ciclo aparece a su lado un bot nuevo que se lleva ese
porcentaje de lo que tenía. El hijo es una copia de su ADN (con alguna
mutación, si están encendidas) o, en la reproducción sexual, una mezcla con el
ADN de otro bot.

Esta página cuenta el mecanismo entero. Las fichas de cada orden están en
[[sysvars/reproduccion]].

## Las tres órdenes {#ordenes}
<!-- 36-REPRO §0.4, §0.5, §1; 10-CICLO §5 P5 y §6 -->

| Orden | Qué pide |
|---|---|
| [[.repro]] | Un hijo asexual: una copia del propio ADN. |
| [[.mrepro]] | Lo mismo, pero el hijo nace con muchas más probabilidades de mutar ([[simulacion/mutaciones#mrepro]]). |
| [[.sexrepro]] | Un hijo sexual. Solo funciona si el bot fue fecundado por el esperma de otro. |

En las tres, el número es el **porcentaje** que se lleva el hijo, y vale lo
mismo:

- Se toma **módulo 100**: `50` es la mitad, `150` también, y `100` es 0 y no
  hace nada. Un 0 o un negativo no piden nada.
- La orden se lee en la fase de acciones del mismo ciclo en que la escribís, y
  el hijo nace en la fase de nacimientos y muertes de ese ciclo (ver
  [[simulacion/ciclo#nacimientos-y-muertes]]).
- **La orden queda escrita hasta que el parto sale bien.** Si falla, el motor
  no la borra y la vuelve a intentar en cada ciclo, aunque el gen que la
  escribió ya no corra. Para cancelarla, escribí 0.
- Un bot tiene **un hijo por ciclo** como mucho.

Si un bot tiene escritas [[.repro]] y [[.mrepro]] a la vez, una moneda decide
cuál de los dos porcentajes se usa; la mutación aumentada de [[.mrepro]] se
aplica igual, gane la moneda quien gane. Si está fecundado y tiene [[.sexrepro]]
escrita, ese ciclo intenta solo la sexual y la asexual espera, aunque la
sexual termine fallando.

:::nota
En el DarwinBots original un mismo bot podía quedar anotado dos veces en el
mismo ciclo, para un hijo asexual y otro sexual. En el port se anota una sola
vez, con la sexual primero.
:::

## Cómo se reparten las cosas {#reparto}
<!-- 36-REPRO §2 (reparto por per, impuestos 0,1 % y 1 ‰, DNACOPYCOST con suelo 0); port/README B6-4; comprobado con probar-adn: 50 % de 3000/1000 deja 1498,5/500 a cada uno y DNACOPYCOST 1 cobra 10 al padre con un ADN de 10 -->

Este bot se divide una sola vez, a los tres ciclos de vida:

```adn
' Se divide una sola vez, al tercer ciclo de vida
cond
 *.robage 3 =
start
 50 .repro store
stop
```

Con 3000 de energía y 1000 de cuerpo, al terminar el ciclo hay dos bots:

| | Antes | Padre después | Hijo |
|---|---|---|---|
| Energía ([[.nrg]]) | 3000 | 1498,5 | 1498,5 |
| Cuerpo ([[.body]]) | 1000 | 500 | 500 |

Lo que pasa, cosa por cosa:

- **Energía**: el hijo recibe el porcentaje, menos una milésima. El padre
  pierde el porcentaje más otra milésima. En el ejemplo se evaporan 3 de las
  3000.
- **Cuerpo, cloroplastos y desechos** ([[.body]], [[.chlr]], [[.waste]] y
  [[.pwaste]]): se reparten con el mismo porcentaje, sin pérdida.
- **Caparazón, baba, veneno y toxina** ([[.shell]], [[.slime]], [[.venom]],
  [[.poison]]): se quedan con el padre. El hijo nace sin ninguno.
- **La copia del ADN** cuesta: después del parto el padre paga
  [[param:cost:25]] por cada instrucción de su ADN (escalado por el
  multiplicador de costos). Con el costo en 1, el bot de arriba, de 10
  instrucciones, paga 10. Si no le alcanza, queda en 0 de energía, pero el hijo
  nace igual.

El parto no cuenta como una pérdida brusca de energía: un bot grande que se
parte en dos no muere de shock (ver [[simulacion/energia#shock]]).

:::nota
En el DarwinBots original el cuerpo del hijo se redondeaba a un número entero.
En el port es la parte exacta: con 501 de cuerpo y el 50 %, el hijo se lleva
250,5.
:::

## Dónde nace {#donde-nace}
<!-- 36-REPRO §2 (sondist = suma de los radios, aim + π, velocidad heredada); 10-CICLO §6; comprobado con probar-adn: aim 160, hijo a 175 unidades en esa dirección, aim del hijo 788 -->

El hijo aparece **delante del padre**, en la dirección a la que apunta
([[.aim]]), a la distancia justa para que los dos se toquen: la suma de los
radios que van a tener después de partirse. Nace **mirando hacia el padre**,
es decir, con el rumbo opuesto, y con la misma velocidad que él.

```
              rumbo del padre ──►
     ( padre )( hijo )
                  ◄── rumbo del hijo
```

En la prueba de arriba el padre apuntaba a 160 y el hijo apareció a 175
unidades en esa dirección, apuntando a 788 (160 + 628, media vuelta).

Por eso, para un bot que se reproduce mucho, conviene **girar entre parto y
parto**: si siempre apunta al mismo lado, el próximo hijo quiere nacer donde
está el anterior.

## El lazo de nacimiento {#lazo}
<!-- 34-TIES §0.4 (last = 100), §4.3 (puerto 0 del lado del padre); 36-REPRO §2; port/README B4-3 (conservado); comprobado con probar-adn: .numties en 1 para los dos hasta que el hijo tiene 98 de edad, 0 desde 99 -->

Padre e hijo nacen unidos por un lazo ([[simulacion/lazos]]). Es un lazo
elástico que los mantiene juntos y que **se corta solo a los 100 ciclos**; los
dos lo ven en [[.numties]]. Lo crea el padre con un número de puerto que no se
puede usar, así que solo el hijo lo maneja: puede cortarlo antes con
[[.deltie]], escribirle al padre en la memoria o pasarle y sacarle energía por
él. El padre, en cambio, solo lo siente (ver
[[simulacion/lazos#nacimiento]]). Como nunca se endurece, no los vuelve un
organismo multicelular.

Además es el canal de la memoria genética diferida (abajo): si se corta, o si
el hijo lo reemplaza atándose al padre con [[.tie]], deja de recibirla.

## Qué hereda el hijo {#herencia}
<!-- 36-REPRO §2 (qué hereda y qué no); 21-MEMORIA §5; adn/memoria#al-nacer -->

| Hereda | No hereda |
|---|---|
| El ADN, con las mutaciones de nacimiento si las hay | La memoria: la tiene toda en 0 |
| El nombre de la especie y el color | Los lazos (salvo el de nacimiento) |
| Su tabla de tasas de mutación | La edad: nace con 0 |
| El [[.timer]], que sigue contando | Caparazón, baba, veneno y toxina |
| Las celdas 971–975 y, de a una, las 976–990 | |

El hijo es de la **generación** siguiente a la del padre, y el motor anota
quién es su padre para el árbol del linaje ([[simulacion/especies]]).

La memoria genética funciona así:

- **971–975**: se copian en el acto. El hijo las tiene desde su primer ciclo.
- **976–990**: le llegan de a una por ciclo durante sus primeros quince
  ciclos, mientras siga atado por el lazo de nacimiento y la celda siga en 0.

Los detalles y un ejemplo que cuenta generaciones están en
[[adn/memoria#memoria-genetica]].

Recordá además que el hijo nace cuando el ADN de ese ciclo ya corrió: piensa
por primera vez en el ciclo siguiente, con [[.robage]] en 0 (ver
[[simulacion/ciclo#demoras]]).

## Cuándo falla {#cuando-falla}
<!-- 36-REPRO §0.4, §2 (guardas en orden), §3.2; 10-CICLO §6; port/README B6-2 -->

Un parto pedido no sale si:

| Situación | Qué pasa |
|---|---|
| El bot tiene menos de 5 de cuerpo | No hay hijo. |
| La energía está en 0 o menos | No hay hijo. |
| El porcentaje, tomado módulo 100, da 0 | No hay hijo (`100`, `200`…). |
| El lugar donde nacería el hijo está ocupado | Otro bot muy cerca de ese punto, una forma entre el padre y ese punto, o ese punto fuera del campo cuando los bordes no se conectan. |
| La simulación prohíbe la reproducción asexual | Con [[param:opt:71]], los bots que no son vegetales no pueden usar [[.repro]] ni [[.mrepro]]. La sexual sigue permitida. |
| Es un vegetal y ya hay muchos | Si los cloroplastos de todo el mundo superan el [[param:base:maxPopulation]], ningún vegetal se reproduce. Por encima del 90 % de ese tope, solo uno de cada once intentos pasa. |

En todos estos casos la orden **sigue escrita** y se reintenta en el ciclo
siguiente. El caso más común es el lugar ocupado: un hijo que quiere
reproducirse apenas nace, todavía pegado al padre, o un bot rodeado de su
propia cría. Un bot que pide hijos y no los tiene suele estar mirando a una
pared o a un hermano.

## La reproducción sexual {#sexual}
<!-- 36-REPRO §0.2, §3.1, §3.4; 33-SHOTS §5; sysvars fertilized/sexrepro -->

Hay dos papeles, y cualquier bot puede hacer los dos:

1. **El que aporta el esperma** dispara con `-8 .shoot store` (ver
   [[.shoot]] y [[simulacion/disparos]]). El disparo lleva una copia de su ADN.
   No tiene hijos ni gasta nada más que el disparo.
2. **El que lo recibe queda fecundado** durante unos diez ciclos. Lo ve en
   [[.fertilized]], que cuenta hacia abajo de 9 a 0. Si en ese plazo tiene
   [[.sexrepro]] escrita, tiene un hijo.

Todo lo pone la **madre**, el bot que escribe `.sexrepro`: energía, cuerpo,
cloroplastos, el lugar donde nace el hijo, el lazo de nacimiento, la memoria
genética y el reloj. El reparto, las reglas de dónde nace y las razones para
fallar son las mismas de la asexual. El linaje registra solo a la madre.

Cada esperma sirve para **un solo hijo**: después del parto la fecundación se
termina. Si llega otro esperma mientras la madre está fecundada, reemplaza al
anterior y la cuenta vuelve a empezar.

Animal_Minimalis_Sex, de Botsareus, es el ejemplo clásico del Bestiario:
cuando junta más de 20000 de energía busca a uno de su especie (compara
[[.refeye]] con [[.myeye]]), le dispara esperma y deja escrito
`10 .sexrepro store`, que espera hasta que a él también lo fecunden.

### Cómo se arma el ADN del hijo {#mezcla}
<!-- 36-REPRO §3.3 (simplematch, crossover, monedas por tramo y por token), §5.3; port/README B6-3 conservado -->

El motor pone los dos ADN uno al lado del otro y busca los **tramos en
común**: secuencias de instrucciones iguales en los dos, en el mismo orden.
Lo que queda entre esos tramos son las **diferencias**. Después arma el hijo
recorriéndolos en orden:

- Un tramo en común pasa al hijo tal cual.
- Donde los dos padres tienen algo distinto, una moneda elige el tramo de uno
  o el del otro.
- Donde solo uno de los dos tiene algo (al otro le falta ese pedazo), una
  moneda decide si ese pedazo entra o se pierde.

```
  madre:    [ común A ] x x x [ común B ] z z [ común C ]
  esperma:  [ común A ] y y   [ común B ]     [ común C ]
                         │                 │
                    moneda: x o y     moneda: z o nada
  hijo:     [ común A ] y y   [ común B ] z z [ común C ]
```

Dos consecuencias:

- **La mezcla no es fija.** El mismo esperma con la misma madre da hijos
  distintos en cada parto.
- **El hijo puede salir más corto que los dos padres**, porque los pedazos
  que tiene uno solo se pierden la mitad de las veces.

Sobre esa mezcla se aplican después las mutaciones de nacimiento, como en la
asexual.

### Parientes, no extraños {#distancia}
<!-- 36-REPRO §0.3, §3.3 paso 3 (distancia > 0,6 → fertilized = −18); core robots.hpp ManageReproduction y takesperm (fertilized < −10 rechaza esperma); comprobado con probar-adn: madre de 64 instrucciones y macho de 15, .fertilized se queda en 8, .sexrepro en 50 y el esperma siguiente entra 13 ciclos después; el bot de sysvars/sexrepro con --otro macho tiene hijo en 3 de 4 semillas (120 ciclos); una madre que mira al macho cuenta 9..4 sin parto (lugar ocupado) -->

La comparación de arriba también mide qué tan distintos son los dos ADN: la
**distancia genética** es la proporción de instrucciones que no quedaron en
ningún tramo común. Si pasa del **60 %**, no hay hijo:

- el esperma ya no sirve, aunque [[.fertilized]] se quede mostrando el último
  número que tenía;
- durante unos ocho ciclos el bot no acepta esperma nuevo;
- la orden de [[.sexrepro]] sigue escrita, y se usa con el próximo esperma
  que llegue.

Lo probamos con dos bots muy distintos. El macho busca y dispara:

```adn
' Gira hasta ver a alguien y le dispara esperma
cond
 *.eye5 0 =
start
 25 .aimdx store
stop
cond
 *.eye5 0 >
start
 -8 .shoot store
stop
```

La madre se queda quieta y, si la fecundan, pide un hijo. Lleva además un gen
de relleno que nunca corre y que la hace muy distinta del macho:

```adn
' Quieta; si la fecundan, tiene un hijo
cond
 *.fertilized 0 >
start
 50 .sexrepro store
stop
cond
 *.nrg 30000 >
start
 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20
 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40
 41 42 43 44 45 46 47 48 49 50
stop
```

El esperma le llega, [[.fertilized]] marca 9 y después 8, y ahí se congela: no
hay hijo. Trece ciclos más tarde le llega otro esperma, que tampoco sirve. En
cambio, el bot de ejemplo de [[.sexrepro]], que tiene los dos genes del macho
más el suyo, tiene hijos con ese mismo macho en tres de cada cuatro pruebas.

Si [[.fertilized]] se congela, el esperma fue rechazado. Si en cambio sigue
bajando hasta 0 sin que nazca nadie, el problema es otro, casi siempre el
lugar: una madre que se queda mirando al macho tiene el sitio del hijo ocupado
por él.

Por eso los bots sexuales se buscan entre los de su especie: el esperma de un
pariente casi siempre pasa la prueba, el de un extraño casi nunca.

## Resumen {#resumen}
<!-- Resumen: 36-REPRO §0-§3; 21-MEMORIA §5; 34-TIES §0.4 -->

| Pregunta | Respuesta |
|---|---|
| ¿Cuánto se lleva el hijo? | El porcentaje pedido, módulo 100, de energía (menos una milésima), cuerpo, cloroplastos y desechos. |
| ¿Qué paga el padre? | Una milésima extra de energía y la copia del ADN ([[param:cost:25]]). |
| ¿Dónde nace? | Delante del padre, hacé clic enndolo, mirando hacia él. |
| ¿Cuánto duran juntos? | El lazo de nacimiento se corta solo a los 100 ciclos. |
| ¿Qué memoria hereda? | [[.timer]], 971–975 al nacer y 976–990 de a una. |
| ¿Y si falla? | La orden queda escrita y se reintenta cada ciclo. |
| ¿Quién pone los recursos en la sexual? | La madre. El macho solo dispara. |
| ¿Cuándo se rechaza el esperma? | Si más del 60 % de los dos ADN no coincide. |
