---
titulo: Un vegetal
resumen: "Paso a paso, un vegetal que fabrica sus cloroplastos, vive del sol y llena el campo de hijos: por qué girar al partirse, qué pasa de noche y cómo lo repuebla el mundo."
etiquetas: [vegetal, cloroplastos, fotosíntesis, sol, reproducción, repoblación]
estado: revisada
---
En [[tutoriales/se-mueve]] armaste un bot que se mueve y en [[tutoriales/busca-comida]],
uno que sale a cazar a los demás. Este tutorial juega para el otro equipo: un
vegetal que no persigue a nadie. Toda su energía le llega del sol, y con ella llena el
campo de copias de sí mismo. Como siempre, cada paso le agrega un gen al ADN y te cuenta
qué deberías ver.

## Qué tiene un vegetal {#que-es}

Un vegetal es un bot de una especie que marcaste como tal: la casilla **Es vegetal
(hace fotosíntesis)** al editar la especie en Experimentar, o **Vegetal (hace
fotosíntesis)** al sembrar desde Observar.
<!-- i18n es: experimentar.especie.vegetal, observar.sembrar.vegetal -->

Con esa marca, el mundo lo trata distinto:

- Nace con [[param:base:startChlr]] cloroplastos (16000 en la app).
- No sufre shock cuando pierde energía de golpe ([[simulacion/energia#shock]]).
- Sus hijos también son vegetales.
- Su población tiene un tope, y la simulación la repone cuando escasea.

Fotosintetizar, en cambio, no es exclusivo de los vegetales: cualquier bot con
cloroplastos lo hace. Cómo funciona la fotosíntesis, cuándo hay sol y cuánto rinde está
en [[simulacion/cloroplastos]]; acá lo usamos.

## Paso 1: fabricar cloroplastos {#paso-1}

En la app, un vegetal recién sembrado ya trae sus 16000 y crece sin escribir una sola
línea. Pero los cloroplastos se pierden solos, se reparten con cada hijo y cada uno
pesa, así que las algas serias del Bestiario los fabrican por su cuenta. Hagamos lo
mismo:

```adn
' Fabrica cloroplastos mientras sobre luz libre
cond
 *.chlr *.light <
start
 160 .mkchlr store
stop
```

[[.chlr]] dice cuántos tiene y [[.light]], cuánta luz libre queda en el campo: cuando
los bots abundan, cada uno tapa su pedazo y la luz baja. Mientras la luz libre supere
a los cloroplastos que tiene, el gen compra 160 por ciclo con [[.mkchlr]]; cuando los
cloroplastos alcanzan a la luz, se apaga solo. Sacárselos con
[[.rmchlr]] es gratis, pero no devuelve nada.

<!-- 31-ENERGIA §1 y §4 (ChangeChlr: cobra solo las compras, se anula si dejaría nrg < 100), §3 (decaimiento, masa y radio); comprobado con probar-adn --veg en 4000x3000: chlr sube 160 por ciclo y se frena solo cerca de 30700 con la luz en ~30625; con --cost 8=0.2,54=1 (F1: cloroplasto 0,2 y multiplicador 1): 3085 de energia final contra 9229 con costos en 0, unos 6140 menos: lo que costaron; arrancando con 500, rondó entre 100 y 160 los primeros ~200 ciclos y recien despues despego -->

Comprar cuesta [[param:cost:8]] por cloroplasto. Con los costos apagados no se nota;
con el precio de la liga F1 (0,2), un alga que arrancó con 3000 terminó su fábrica con
unos 6140 de energía menos que una gemela con costos en 0: justo lo que le costaron
los cloroplastos. Y como una compra se cancela entera si dejaría al bot con menos de
100 de energía, un alga que arranca pobre no puede darse el lujo: en la prueba, una
que nació con 500 se pasó los primeros 200 ciclos pegada al piso de 100, comprando de
a poco lo que el sol le pagaba.

**Qué deberías ver:** en el inspector, [[.chlr]] sube de a 160 por ciclo hasta que
alcanza la luz libre, y ahí se frena. Después de cada parto vuelve a arrancar: el hijo
se lleva la mitad.

## Paso 2: vivir del sol {#paso-2}

Con cloroplastos y de día, el bot cobra en cada ciclo, en la fase del sol, la última
del ciclo (ver [[simulacion/ciclo#fases]]). El reparto lo fija [[param:opt:63]]: con
0,75, el valor de la app, un cuarto de la ganancia va a [[.nrg]] y tres cuartos a
[[.body]], a 10 por 1.

<!-- 50-MUNDO §2.2 (feedvegs: ganancia y reparto nrg/body), 10-CICLO §2 paso 21 (fotosintesis en la fase del sol); comprobado con --veg --maxe 100 en 4000x3000: de 3000 a 4661 de energia en los primeros 100 ciclos mientras fabrica; con 30709 cloroplastos gana ~225 por ciclo entre energia (56) y cuerpo (17, que valen 170); el tope de 32000 llego entre los ciclos 600 y 650; con --maxe 10 (la app): 3000 a 4749 en 400 ciclos -->

Con la energía solar en 100, un alga sola pasa de 3000 a unos 4660 de energía en los
primeros 100 ciclos, y con la fábrica completa gana unos 225 por ciclo entre energía y
cuerpo. Tarde o temprano llega al tope de 32000 ([[simulacion/energia#tope]]): en la
prueba lo tocó antes del ciclo 650, y de ahí en más el sol siguió brillando para nada.
Energía acumulada que no se usa es energía tirada; para que sirva, hay que tener
hijos.

Con la energía solar de la app (10, [[param:base:maxEnergy]]), todo rinde un décimo:
los números con ese valor están en la tabla de [[simulacion/cloroplastos#rinde]].

## Paso 3: tener hijos {#paso-3}

Cuando sobra energía, partirse. Segundo gen:

```adn
' Con energia de sobra, se parte
cond
 *.nrg 6000 >
start
 50 .repro store
stop
```

[[.repro]] pide un hijo que se lleva el 50 % de la energía, del cuerpo, de los
cloroplastos y de los desechos ([[simulacion/reproduccion#reparto]]). El número es el
porcentaje, módulo 100, y la orden queda escrita hasta que el parto sale bien. El hijo
nace delante del padre, mirándolo, en la fase de nacimientos y muertes del mismo ciclo
([[simulacion/reproduccion#donde-nace]]).

Y acá aparece el problema del bot quieto: **un solo parto**. El hijo nace donde apunta
el padre y ahí se queda; el próximo quiere nacer en ese mismo lugar, que ya está
ocupado, y el parto falla. En la prueba, padre e hijo quedaron trabados cara a cara,
la orden siguió escrita reintentando ciclo tras ciclo, y a los 500 ciclos seguían
siendo dos, llenos de energía sin poder partirse.

<!-- 36-REPRO §2 (reparto por per, sondist = suma de los radios, aim + pi), §0.4 (un fallo no consume la orden: reintenta cada ciclo), §0.5 (per Mod 100); comprobado: quieto, un solo parto en 500 ciclos, *.repro quedo en 50 para siempre y los dos llegaron a ~19500 de energia -->

La solución es girar entre parto y parto, como hace _Alga minimalis_ del Bestiario:

```adn
' Con energia de sobra, se parte y gira para el proximo
cond
 *.nrg 6000 >
start
 50 .repro store
 15 .aimdx store
stop
```

Al girar con [[.aimdx]], el punto del próximo parto apunta a otro lado. Con ese giro
solo, la población pasó de 1 a 2, 4, 8 y 12 bots en 500 ciclos.

### El bot completo {#bot-final}

```adn
' Un vegetal: fabrica cloroplastos, crece y se multiplica

' Fabrica cloroplastos mientras sobre luz libre
cond
 *.chlr *.light <
start
 160 .mkchlr store
stop

' Con energia de sobra, se parte y gira para el proximo parto
cond
 *.nrg 6000 >
start
 50 .repro store
 15 .aimdx store
stop
```

En una corrida larga llenó el campo: 1 → 4 → 12 → 16 → 21 → 23 bots en 1500 ciclos, y
ahí se frenó solo. No fue mala suerte: con el campo lleno, cada bot tapa la luz de los
demás ([[simulacion/cloroplastos#fotosintesis]]), la luz libre bajó a menos de la
mitad y la ganancia ya no alcanza para más partos. Si además los cloroplastos de todo
el campo pasan del 90 % del tope, solo uno de cada once partos sigue adelante
([[param:base:maxPopulation]] y [[simulacion/cloroplastos#tope]]).
<!-- 36-REPRO §2, §0.4; cloroplastos#tope (loteria de 1/11 por encima del 90 % del tope); comprobado en 4000x3000: 1 -> 4 -> 12 -> 16 -> 21 -> 23 bots en 1500 ciclos, *.light cayo de ~31900 a 13898 -->

Sembrá unas quince copias marcadas como vegetal en la app y mirá el campo llenarse
de hexágonos.

## De noche {#dia-y-noche}

Por defecto siempre es de día. En Experimentar, el control **Día y noche** hace que el
sol se ponga: cada tramo dura ese valor más 1 ciclos, y solo el primer día dura uno
menos (con 3: tres de día, cuatro de noche, cuatro de día…).
<!-- opciones.js, control 'dia-noche' (escribe opt:33 y opt:34; 0 = siempre de dia); 50-MUNDO §2.2 (reloj, primer dia uno menos); comprobado con opt:33 = 1, opt:34 = 3: dia los ciclos 1-3, noche 4-7, dia 8-11 -->

De noche no hay fotosíntesis: en la prueba, la energía y el cuerpo quedaron anclados
ciclo tras ciclo mientras [[.daytime]] estuvo en 0. El gen de compras no se entera
—[[.light]] no se recalcula de noche— y el bot sigue comprando en la oscuridad: gratis
con los costos apagados, energía tirada con costos reales. _Chloroplastus_, del
Bestiario, compra de día y se deshace de a 1 de noche
([[simulacion/cloroplastos#tener]]).

El escenario **Día y noche** de la app trae 20 _Alga minimalis_ y 5 _Animal Minimalis_
con días y noches de 1000 ciclos: mirá oscilar a la población cada vez que el sol se
pone ([[app/escenarios]]).

## La repoblación {#repoblacion}

El mundo no deja que los vegetales desaparezcan: si los cloroplastos de todo el campo
bajan de [[param:base:minVegs]], cada [[param:base:repopCooldown]] ciclos siembra
[[param:base:repopAmount]] vegetales nuevos. Ojo con la unidad: el umbral cuenta
cloroplastos, en unidades de 16000, no bots.

<!-- 50-MUNDO §2.1 (VegsRepopulate: acumulador con deuda, umbral TotalChlr en unidades de 16000; aggiungirob: body 1000, nrg de la especie, StartChlr; checkvegstatus: especie vegetal con algun bot vivo con cloroplastos); comprobado: umbral en 3 (--vegs 3), un solo vegetal -> 10 nuevos en el ciclo 10 y otros 10 en el 20 (cooldown y cantidad por defecto: 10 y 10) -->

En la prueba, un vegetal solo con el umbral en 3 recibió 10 desconocidos en el ciclo
10 y otros 10 en el 20. Cada uno nace con 1000 de cuerpo, la energía inicial de su
especie y los cloroplastos de [[param:base:startChlr]], en un lugar al azar. ¿De qué
especie? De una vegetal que siga viva: si la tuya es la única, el mundo te siembra
clones tuyos a vos ([[simulacion/cloroplastos#repoblacion]]).

## Contra las algas del Bestiario {#bestiario}

Nuestro bot es prácticamente el _Alga minimalis 3.0_ del Bestiario, que le agrega un
gen de baba:

```adn
' El gen de baba del Alga minimalis 3.0
cond
start
 *.nrg 500 div .mkslime store
stop
```

Cada ciclo pide tanta baba como su energía dividida 500 — calculada con
[[op:div]] y escrita en [[.mkslime]], que rinde diez de baba por cada punto
de energía. La baba frena disparos y mordidas
([[simulacion/defensas]]). Corriendo al alga real marcada como vegetal, en
300 ciclos pasó de 1 a 4 bots con unos 22000 cloroplastos cada uno y una capa
de entre 280 y 460 de baba: la misma vida que la nuestra, con coraza.
<!-- port/web/bots/Alga_minimalis_3.0.txt; comprobado con probar-adn --veg: 1 -> 2 -> 4 bots en 300 ciclos, chlr ~22000, baba 277-463 -->

El _Alga Substantis_, en cambio, se toma el calendario en serio: de día guarda energía
en el cuerpo con [[.strbody]] y da vueltas; de noche saca del cuerpo con [[.fdbody]] y
pare muchos hijos chicos, para que alguno llegue a la mañana.
<!-- port/web/bots/Alga_Substantis_V_Frankle_-18.12.06.txt; comprobado con --veg --opt 33=1,34=3: los partos salen de noche (*.daytime = 0, .repro 10) y convierte cuerpo -->

## Qué probar después {#despues}

<!-- 50-MUNDO §0.3 (SunOnRnd: la banda solar deriva y cambia de rumbo al azar; solo los cloroplastos dentro de la banda comen); opciones.js opt:40; Bestiario: Alga_Toxicus (100 .strpoison) -->

- **Seguí al sol.** Con [[param:opt:40]] el sol es una franja que recorre el campo: un
  vegetal quieto sufre estaciones, uno que se mueve puede seguir la luz
  ([[simulacion/cloroplastos#franja]]).
- **Ponete defensas.** La baba del _Alga minimalis_ es lo mínimo; el Bestiario trae
  vegetales con toxina, como el _Alga Toxicus_.
- **Dejá que alguien te coma.** Seguí con [[tutoriales/alimentador]], que construye un
  bot que se alimenta de tu vegetal atándolo con un lazo: recién ahí tu alga deja de
  ser un ejercicio y empieza la ecología de verdad.
