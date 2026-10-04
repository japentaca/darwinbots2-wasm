---
titulo: "Parámetros: Costos"
resumen: "Cuánta energía le cobra la simulación a un bot por ejecutar su ADN, moverse, disparar, fabricar defensas, tener cuerpo y envejecer."
etiquetas: [costos, energía, parámetros, F1, mantenimiento, edad]
estado: revisada
---
<!-- opciones.js «Costos (CostsForm; índices de SimOptions.bas)»; core vm.hpp Costs::of (v[i] × v[COSTMULTIPLIER]); 31-ENERGIA §1 -->

Este grupo fija el precio de cada cosa que hace un bot. Todos los precios se
pagan en energía ([[.nrg]]) y son iguales para todos los bots del mundo, vegetales
incluidos. Con los valores de fábrica de la app están todos en 0: vivir y actuar
es gratis, y un bot solo se queda sin energía si la gasta en algo (regalarla,
pasarla al cuerpo, fabricar defensas) o si se la sacan.
Tocalos cuando quieras que la evolución premie a los bots ahorrativos, o cuando
armes un mundo con las reglas de los torneos.

Esta página dice qué cobra cada parámetro. El mecanismo de conjunto (en qué fase
del ciclo se cobra cada cosa, qué pasa si la energía queda negativa) está en
[[simulacion/energia]], y el detalle del ADN en [[adn/ejecucion#costos]].

## Cómo se cobra {#como-se-cobra}
<!-- core: cada consumidor multiplica por Costs(54); Upkeep salta cadáveres (robots.hpp P1); vm.hpp resta sin piso -->

Cada costo se cobra como **precio × [[param:cost:54]]**. El multiplicador vale 1
de fábrica y es la perilla general: en 0 todo es gratis aunque los precios no lo
sean, en 2 todo cuesta el doble. Está en el grupo [[app/parametros-costos-dinamicos]]
porque el motor lo puede mover solo para llevar la población a un objetivo.

Hay tres clases de costos:

| Clase | Cuándo se paga | Parámetros |
|---|---|---|
| Por instrucción | Cada vez que el ADN ejecuta una, en la fase del ADN. | [[param:cost:0]] a [[param:cost:9]] |
| Por acción | Cuando el bot hace algo: empujar, girar, atar, disparar, fabricar. | [[param:cost:8]], [[param:cost:20]] a [[param:cost:23]], [[param:cost:26]] a [[param:cost:29]] |
| Mantenimiento | Todos los ciclos, aunque el bot no haga nada; también al reproducirse. | [[param:cost:24]], [[param:cost:25]], [[param:cost:30]] a [[param:cost:33]], [[param:cost:51]], [[param:cost:60]] |

Los cobros no miran el saldo: la energía puede quedar negativa entre una fase y
otra, y recién en las acciones se decide si el bot murió (ver
[[simulacion/energia#por-fase]]). Los cadáveres no pagan mantenimiento.

Un precio negativo, o un multiplicador negativo, convierte el costo en un pago:
con el multiplicador en −1 y el store a 1, cada `store` le _suma_ 1 de energía
al bot. La app acepta un precio negativo con un aviso de valor poco habitual; el
multiplicador negativo lo acepta sin aviso.

<!-- comprobado: cond start 1 50 store stop, cost 7=1: multiplicador 2 → −2/ciclo, 0 → 0, −1 → +1/ciclo -->

## Los atajos: F1 y sin costos {#atajos}
<!-- opciones.js CONTROLES_BASICOS 'costos', costosF1 (For t = 1 To 70 → 0, después F1_COSTOS), costosNinguno; BASES.f1; i18n/es/experimentar.json ajustesF1 -->

No hace falta cargar los 26 valores a mano. En **Experimentar**, el modo
**Básico** tiene el control **Costos** con tres opciones: **F1** pone los precios
de la liga, **Sin costos** devuelve todo a los valores de fábrica y
**Personalizados** es lo que se ve cuando los valores no coinciden con ninguno de
los otros dos (por ejemplo, porque cambiaste alguno en el modo **Avanzado**). En
el modo avanzado, el botón **Ajustes F1** y la base **Liga F1** del escenario
ponen los mismos precios, junto con el resto de las reglas de la liga (ver
[[app/experimentar]] y [[app/experimentar-avanzado]]).

Los precios F1 son estos; todo lo demás del grupo queda en 0 (y también el ajuste
dinámico):

| Parámetro | F1 |
|---|---|
| [[param:cost:5]] | 0,004 |
| [[param:cost:7]] | 0,04 |
| [[param:cost:8]] | 0,2 |
| [[param:cost:20]] | 0,05 |
| [[param:cost:22]] | 2 |
| [[param:cost:23]] | 2 |
| [[param:cost:26]] y [[param:cost:27]] | 0,01 |
| [[param:cost:28]] y [[param:cost:29]] | 0,1 |
| [[param:cost:30]] | 0,00001 |
| [[param:cost:31]] | 0,01, casi desde que nace |
| [[param:cost:54]] | 1 |

Con esos precios, lo caro es disparar y atarse; ejecutar el ADN y tener cuerpo
casi no cuesta. El F1 copia al original, que ponía en 0 los costos del 1 en
adelante: el de [[param:cost:0]] no lo toca, así que si lo cambiaste a mano,
queda como estaba.

:::parametro cost:0
<!-- vm.hpp tok::NUMBER (fuera de CLEAR); 20-VM §1 -->
Se cobra por cada número que el ADN apila al ejecutarse, como `10` o `.up`
cuando la sysvar va sin asterisco (es una dirección, o sea un número). Dentro de
un gen apagado los números no se ejecutan y no cuestan. Es el costo que más
crece con el largo del ADN que corre de verdad: un gen típico tiene más números
que cualquier otra cosa. Ver [[operadores/literales]].
:::

:::parametro cost:1
<!-- vm.hpp tok::DEREF -->
Se cobra por cada lectura de memoria con asterisco, como `*.eye5` o `*50`. Un bot
que consulta muchos sentidos por ciclo paga uno por cada lectura, aunque lea dos
veces la misma. Ver [[operadores/lectura]].
:::

:::parametro cost:2
<!-- vm.hpp ExecuteBasicCommand: cobra siempre, casos 1-14 -->
Lo paga cada operador básico ejecutado: las cuentas y el manejo de la pila, como
[[op:add]], [[op:mult]], [[op:rnd]], [[op:dup]] o [[op:swap]]. La lista completa
está en [[operadores/basicos]].
:::

:::parametro cost:3
<!-- vm.hpp ExecuteAdvancedCommand: if (n < 13) cobra; debugint/debugbool exentos -->
Lo paga cada operador avanzado: trigonometría y geometría, como [[op:angle]],
[[op:dist]], [[op:sqr]] o [[op:pow]]. [[op:debugint]] y [[op:debugbool]] son de esa
familia pero no cuestan nunca. Ver [[operadores/avanzados]].
:::

:::parametro cost:4
<!-- vm.hpp ExecuteBitwiseCommand: cobra BTCMDCOST siempre -->
Lo paga cada operador de bits, como [[op:&]] o [[op:<<]]. Ver
[[operadores/bits]].
:::

:::parametro cost:5
<!-- vm.hpp CONDCOST; F1 0.004 -->
Se cobra por cada comparación, como [[op:>]], [[op:=]] o [[op:%=]]. Ojo: las
condiciones de un gen se evalúan siempre, porque hay que saber si el gen corre,
así que este costo lo pagan también los genes que terminan apagados. Con las
reglas F1 vale 0,004. Ver [[operadores/comparaciones]].
:::

:::parametro cost:6
<!-- vm.hpp ExecuteLogic: cobra LOGICCOST siempre -->
Lo paga cada operador lógico, los que combinan o manipulan resultados booleanos:
[[op:and]], [[op:or]], [[op:not]], [[op:dropbool]] y los demás de
[[operadores/logicos]].
:::

:::parametro cost:7
<!-- vm.hpp: store entero; inc/dec /10; addstore… /5; rndstore, sgnstore, sqrstore /7; absstore, negstore /8; store que no corre o a dirección 0 no cobra (20-VM §7) -->
Es el precio de [[op:store]], la instrucción con la que el bot actúa: casi todo lo
que hace pasa por un `store`. Las variantes pagan una fracción: [[op:inc]] y
[[op:dec]] la décima parte; [[op:addstore]] y sus parientes, la quinta;
[[op:rndstore]], [[op:sgnstore]] y [[op:sqrstore]], la séptima; [[op:absstore]] y
[[op:negstore]], la octava. Un store que no llega a escribir (por una condición en
línea falsa, o a la dirección 0) no cuesta. Con las reglas F1 vale 0,04. Ver
[[adn/ejecucion#costos]].
:::

:::parametro cost:8
<!-- robots.hpp ChangeChlr: (nuevos) × CHLRCOST × mult; cancela si newnrg < 100 o vegetal con TotalChlr > MaxPopulation; comprobado: 90 de energía y costo 0 → no compra; 10 a 0,2 → −2 -->
Se cobra por cada cloroplasto que el bot compra con [[.mkchlr]]. La compra se
cancela entera si lo dejaría con menos de 100 de energía, y esa regla vale aunque
el precio sea 0: un bot con 90 de energía no puede comprar ni uno. Sacarlos con
[[.rmchlr]] es gratis. Con las reglas F1 vale 0,2: 1000 cloroplastos salen 200
de energía. Ver [[simulacion/cloroplastos#tener]].
:::

:::parametro cost:9
<!-- vm.hpp ExecuteFlowCommands: cobra cond/start/else/stop siempre -->
Lo pagan los marcadores de gen: `cond`, `start`, `else` y `stop`. Se ejecutan
aunque el gen esté apagado, así que un bot con muchos genes paga este costo por
cada uno en cada ciclo. Ver [[operadores/flujo]].
:::

:::parametro cost:20
<!-- physics.hpp VoluntaryForces (|empuje recortado| × MOVECOST × mult, nunca más que nrg); gravedad en modo estanque × Bouyancy -->
Es el precio de empujar con [[.up]], [[.dn]], [[.sx]] y [[.dx]], por unidad de
empuje. Se cobra sobre el empuje ya recortado por el tope de velocidad, así que
pedir más de lo que el mundo deja no cuesta más, y nunca se cobra más energía
de la que el bot tiene. En el modo estanque también se paga por mantenerse a
flote. Con las reglas F1 vale 0,05. Ver [[simulacion/fisica#empuje]].
:::

:::parametro cost:21
<!-- physics.hpp SetAimFunc: |Round((diff+diff2)/200, 3)| × TURNCOST × mult -->
Es el precio de girar, por cada 200 unidades de giro (unos 57 grados): un cuarto
de vuelta cuesta 1,57 veces el precio y una vuelta entera, 6,28. Se paga igual
girando con [[.aimsx]], [[.aimdx]] o [[.setaim]]. Las reglas F1 no cobran el
giro. Ver [[simulacion/fisica#giro]].
:::

:::parametro cost:22
<!-- ties.hpp maketie: TIECOST × mult / (numties + 1) al final, con numties ya actualizado si el lazo salió; robots.hpp FireTies (solo con alguien a tiro) y Reproduce/sexual (maketie del lazo de nacimiento, lo paga el padre); revisor, probar-adn con 22=2: cada parto le cuesta 1 al padre; el hijo que se ata al padre paga 1 -->
Se cobra cada vez que el bot intenta atar a otro con [[.tie]] y hay alguien a
tiro, salga o no el lazo. También se cobra en cada parto, por el lazo de
nacimiento: lo paga el padre (en la reproducción sexual, la madre). El precio se divide por la cantidad de lazos que el
bot tiene después del intento más uno, así que el primer lazo cuesta la mitad del
precio, el segundo un tercio, y así; un intento que falla, sin lazos, cuesta el
precio entero. Con las reglas F1 vale 2: un hijo le cuesta 1 de energía a un padre
que no tenía otros lazos. Ver [[simulacion/lazos#crear]].
:::

:::parametro cost:23
<!-- shots.hpp robshoot (tabla por tipo), defacate (/(numties+1)), vshoot; 33-SHOTS -->
Es el precio base de un disparo con [[.shoot]]. Cuánto paga el tirador depende del
tipo: los disparos para comer, el veneno y los desechos lo dividen por la cantidad
de lazos más uno, los de memoria lo pagan entero y un disparo de comer con
[[.shootval]] grande lo multiplica (la tabla está en [[simulacion/disparos#crear]]).
También lo pagan, sin que el bot lo pida, el disparo con el que expulsa los
desechos cuando se le juntan demasiados, y el disparo de un virus
([[simulacion/virus#disparar]]). Con las reglas F1 vale 2.
:::

:::parametro cost:24
<!-- robots.hpp Upkeep: (DnaLen − 1) × DNACYCCOST × mult -->
Un costo de mantenimiento: en cada ciclo, el bot paga este precio por cada
instrucción de su genoma (sin contar el `end` final), se ejecute o no. Es lo que
castiga el ADN basura que se acumula con las mutaciones. Un ADN de 100
instrucciones más el `end`, con el precio en 0,01, cuesta 1 por ciclo. Ver
[[adn/ejecucion#adn-largo]].
:::

:::parametro cost:25
<!-- robots.hpp Reproduce y la sexual: p.nrg −= DnaLen × DNACOPYCOST × mult, piso 0; virus: por palabra del gen -->
Se cobra al reproducirse, por cada instrucción del genoma (esta vez con el
`end`): es el precio de copiar el ADN para el hijo. Si no le alcanza, el padre
queda en 0 de energía, pero el hijo nace igual. También lo paga quien fabrica un
virus, por cada palabra del gen que copia. Ver
[[simulacion/reproduccion#reparto]].
:::

:::parametro cost:26
<!-- robots.hpp storevenom: |Delta| × VENOMCOST × mult; el costo pasa a Waste -->
Es el costo de transacción por cada unidad de veneno que el bot fabrica con
[[.mkvenom]], encima de la conversión fija (1 de energía por unidad). Lo que se
paga por este costo no desaparece: se vuelve desechos ([[.waste]]). Con las reglas
F1 vale 0,01. Ver [[simulacion/defensas#fabricar]].
:::

:::parametro cost:27
<!-- robots.hpp storepoison -->
Igual que el del veneno, para la toxina que se fabrica con [[.mkpoison]] (la
conversión fija es 1 de energía cada 4 unidades). El costo también se vuelve
desechos. Con las reglas F1 vale 0,01. Ver [[simulacion/defensas#fabricar]].
:::

:::parametro cost:28
<!-- robots.hpp makeslime: en multibot dividido por numties + 1, el Waste sube por el costo completo -->
El costo por unidad de baba que se fabrica con [[.mkslime]], encima de la
conversión fija (1 de energía cada 10). Se vuelve desechos. Un bot atado a otros
en un multicelular paga menos: el costo se divide por la cantidad de lazos más
uno, aunque los desechos se suman enteros. Con las reglas F1 vale 0,1.
:::

:::parametro cost:29
<!-- robots.hpp makeshell -->
El costo por unidad de caparazón que se fabrica con [[.mkshell]], con las mismas
reglas que la baba: conversión fija de 1 de energía cada 10, el costo se vuelve
desechos y en un multicelular se divide por los lazos más uno. Con las reglas F1
vale 0,1. Ver [[simulacion/defensas#caparazon]].
:::

:::parametro cost:30
<!-- robots.hpp Upkeep: body × BODYUPKEEP × mult; comprobado en energia.md: 1000 de cuerpo a 0,001 → −1/ciclo -->
Mantenimiento del cuerpo: en cada ciclo, el bot paga este precio por cada punto de
[[.body]]. Hace que guardar energía en el cuerpo tenga un costo. Con 0,001, un bot
con 1000 de cuerpo pierde 1 por ciclo; con el valor F1 (0,00001), una centésima.
Ver [[simulacion/energia#mantenimiento]].
:::

:::parametro cost:31
<!-- robots.hpp Upkeep: ageDelta = age − round(AGECOSTSTART) > 0; constante, log o lineal -->
La cuota de vejez: lo que el bot paga por ciclo una vez que su edad pasó de
[[param:cost:32|la edad de inicio]]. Así como está es un monto fijo; con [[param:cost:51]] o
[[param:cost:60]] pasa a crecer con los años. Sirve para que los bots viejos dejen
lugar a sus hijos sin tener que programarles la muerte. Con las reglas F1 vale
0,01 y la edad de inicio queda en 0. Ver [[simulacion/muerte#causas]].
:::

:::parametro cost:32
<!-- comprobado: 31=1, 32=5 → primer cobro con robage 7; revisor: 31=1, 32=0 → sin cobro en el ciclo 1, −1 desde el ciclo 2 (Upkeep: age − inicio > 0 y age > 0) -->
La edad, en ciclos, a partir de la cual se cobra [[param:cost:31]]: el cobro
empieza cuando la edad la supera. Con 0 (el valor de fábrica) se cobra desde el
segundo ciclo de vida, porque en el primero la edad todavía es 0. Las formas
logarítmica y lineal cuentan los ciclos desde esta edad, no desde el nacimiento.
:::

:::parametro cost:33
<!-- robots.hpp: AGECOST + ageDelta × AGECOSTLINEARFRACTION; comprobado: 31=1, 60=1, 33=0,5 → 1,5; 2; 2,5… -->
La pendiente de la cuota de vejez lineal: cuánto se suma a [[param:cost:31]] por
cada ciclo vivido después de [[param:cost:32|la edad de inicio]]. Con el costo en 1 y la pendiente
en 0,5, el bot paga 1,5 en su primer ciclo de vejez, 2 en el segundo, 2,5 en el
tercero, y así. Solo cuenta si [[param:cost:60]] está activado.
:::

:::parametro cost:51
<!-- robots.hpp: AGECOST × ln(ageDelta), == 1 exacto; tiene prioridad sobre el lineal; comprobado: 31=10 → 6,93; 10,99; 13,86… -->
Activado, la cuota de vejez es [[param:cost:31]] por el logaritmo natural de los
ciclos vividos desde [[param:cost:32|la edad de inicio]]: crece rápido al principio y después
cada vez más despacio. Con el costo en 10, el bot paga 6,9 cuando lleva 2 ciclos
de vejez, unos 46 a los 100 y unos 69 a los 1000. Si activás también
[[param:cost:60]], gana este.
:::

:::parametro cost:60
<!-- robots.hpp: else if AGECOSTMAKELINEAR == 1 -->
Activado, la cuota de vejez crece en línea recta: [[param:cost:31]] más
[[param:cost:33]] por cada ciclo vivido desde [[param:cost:32|la edad de inicio]]. A la larga es más
dura que la logarítmica, porque no se aplana nunca. No tiene efecto si
[[param:cost:51]] también está activado.
:::
