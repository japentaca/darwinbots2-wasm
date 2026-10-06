---
titulo: Defensivos
resumen: "Cómo se vive armado: qué defensa conviene contra qué enemigo, cuánta energía cuesta sostenerla y los bots del Bestiario que la usan de verdad."
etiquetas: [defensas, caparazón, baba, toxina, veneno, bestiario]
estado: revisada
---
En [[simulacion/defensas]] quedó la promesa de esta página: allá están los
mecanismos (cómo se fabrica cada sustancia, qué absorbe y qué rebota), acá está
la estrategia. Si venís de [[tutoriales/dispara]], ya sabés lo que un cazador
le hace a un bot quieto con un −1 o un −6. Acá te ponés del lado del que
recibe: cuándo conviene cada defensa, cuánto cuesta tenerla puesta y cómo la
usan bots reales del Bestiario.

<!-- The_Shell_Maker_F1_darksleeper_-22.08.07.txt; probado: probar-adn, --qty 2 --ciclos 40: .shell en 0 los 40 ciclos, .vtimer 40 → 10 (fabrica y dispara virus; no hace caparazón); re-corrido: idéntico -->
:::nota
Los nombres del Bestiario no garantizan nada. _The Shell Maker_
(`The_Shell_Maker_F1_darksleeper_-22.08.07.txt`) no fabrica un punto de
caparazón: en 40 ciclos de corrida su [[.shell]] quedó en 0 mientras
contaba atrás el reloj de sus virus. El «shell» del nombre, según su propio
encabezado, son las cáscaras vacías que les deja a las demás especies. Antes
de copiar una estrategia, mirá el ADN, no el nombre.
:::

## Cuál conviene contra cuál {#cual}

<!-- 33-SHOTS §5 (releasebod: el caparazón absorbe ÷20, y el −6 le roba energía y cuerpo; releasenrg: si poison > power → rebote −5, poison −= 0,9·power); 31-ENERGIA §0.3 (1 de energía = 10 caparazón = 10 baba = 1 veneno = 4 toxina); opciones.js F1_COSTOS (cost:26 = 0,01, cost:27 = 0,01, cost:28 = 0,1, cost:29 = 0,1, × cost:54 = 1) -->

Cada defensa sirve contra un enemigo distinto, y ninguna contra todos:

| Defensa | Conviene contra | No frena | Precio por 100 (liga F1) | Se evapora |
|---|---|---|---|---|
| Caparazón | robo de cuerpo (−6) y veneno (−3) | −1, memoria, virus | 10 (20) | no |
| Baba | lazos y virus | todos los disparos | 10 (20) | 2 % por ciclo |
| Toxina | robos de energía (−1), memoria y chupadas por lazo | −6 | 25 (26) | 2 % por ciclo |
| Veneno | nada: es munición, castiga al que se acerca | — | 100 (101) | no |

Leída como estrategia:

- **El caparazón es el único seguro que se paga una sola vez.** No se gasta
  solo: 100 de caparazón aguantan casi cuatro −6 de un cazador de 1000 de
  cuerpo ([[simulacion/defensas#caparazon]]). La letra chica es el peso: te
  hace más lento ([[simulacion/fisica]]).
- **La baba no frena ningún disparo.** Es el seguro contra los que atan y
  contra los virus: si tu baba supera el sorteo, el lazo no se forma
  ([[simulacion/defensas#baba]]). Conviene si en tu mundo hay enjambres o
  alimentadores por lazo, y es un gasto fijo: se evapora siempre.
- **La toxina es el escudo del que tiene energía.** Rebota el −1 mientras tu
  reserva supere la fuerza del golpe, y el rebote envenena al tirador con tu
  [[.ploc]] y [[.pval]] ([[simulacion/defensas#toxina]]). Un cazador de 1000
  de cuerpo pega con 220: contra eso, 100 de toxina no alcanza.
- **El veneno no defiende: castiga.** Paralizás al que se te acerque y le
  escribís una orden en la memoria; la receta completa (paralizado que regala
  energía) ya la viste en _Alga Toxicus_
  ([[simulacion/defensas#veneno]], [[simulacion/defensas#ejemplo]]).

Caparazón y toxina se complementan: uno frena lo que el otro no. Un bot con
las dos no le deja al cazador común ni el −6 ni el −1.

## El precio de andar armado {#precio}

<!-- probado: Massed_Hunter_with_poison_and_shell_and_slime_F2_rayz_02-04-.txt, probar-adn --nrg 1000 --ciclos 80 --cost 26=0.01,27=0.01,28=0.1,29=0.1,23=2,54=1: 1000 → 888 al ciclo 10 (armado 66 + una recarga 46), luego 888 → 842 → 796, una recarga cada ~35-40 ciclos; caparazón queda en 100 sin costo; re-corrido: idéntico (888/842/796, shell en 100, recargas de 46) -->

Fabricar cuesta siempre la conversión (10 de energía por 100 de caparazón o
de baba, 25 por 100 de toxina, 100 por 100 de veneno), y encima el escenario
puede cobrarte una transacción por unidad. En la liga F1 de la app esa
transacción dobla el precio del caparazón y de la baba (0,1 por unidad,
[[param:cost:29]] y [[param:cost:28]]) y casi no toca la toxina y el veneno
(0,01, [[param:cost:27]] y [[param:cost:26]]), todo multiplicado por
[[param:cost:54]]. En los escenarios de fábrica, salvo el Partido F1, los
costos vienen en 0 y solo pagás la conversión.

Lo que de verdad cuesta es el mantenimiento. La baba y la toxina pierden el
2 % por ciclo ([[simulacion/defensas#decaimiento]]): mantener las dos por
arriba de 100 es reponer una recarga de cada una cada ~35 ciclos. Medido en
el bot que sigue, con los costos de la liga F1: **66 de energía para armar
100 de cada una, y después 46 cada ~35 ciclos (unos 1,3 por ciclo)**. El
caparazón, después del primer pago, no vuelve a costar nada. Sumado a las
cuotas de vivir ([[simulacion/energia#mantenimiento]]), andar armado es un
sueldo, no una compra.

## Siempre armado: _Massed Hunter_ {#de-pie}

_Massed Hunter_
(`Massed_Hunter_with_poison_and_shell_and_slime_F2_rayz_02-04-.txt`) paga el
seguro completo mientras puede: es un cazador (nueve ojos que cubren todo el
frente, −1, −6, lazos) que además mantiene las tres defensas al tope con
tres genes gemelos:

```adn
' Mientras tenga energia de sobra: caparazon, baba y toxina al tope
cond
 *.shell 100 <
 *.nrg 750 >
start
 100 .mkshell store
stop

cond
 *.slime 100 <
 *.nrg 750 >
start
 100 .mkslime store
stop

cond
 *.poison 100 <
 *.nrg 750 >
start
 100 .strpoison store
 7 .ploc store
stop
```

Fijate los dos detalles que hacen la política:

<!-- Massed_Hunter_with_poison_and_shell_and_slime_F2_rayz_02-04-.txt (umbral *.nrg 750 en los tres genes gemelos; .ploc 7, .pval 0); probado: --nrg 1300 con los costos de la F1, se parte en dos de ~616: debajo del umbral la baba se evapora sin volver (67 → 11), la toxina se apaga (85 → 14) y el caparazón queda en 100 -->
- **El umbral de 750.** Con la energía por debajo, deja de pagar. En una
  corrida que arrancó repartida en hijos (unos 600 cada uno), la baba se
  evaporó y no volvió, la toxina se fue apagando y el caparazón quedó: sin
  plata, se queda solo con lo que no se gasta solo. Defenderse es un lujo
  que este bot se niega a pagar con lo último.
- **El [[.ploc]] en 7 con [[.pval]] en 0** (la dirección 7 es [[.shoot]]) es
  la trampa de [[simulacion/defensas#toxina]]: quien lo muerde cuando la
  toxina rebota el golpe queda con su orden de disparo borrada cada ciclo.
  Pero con 100–200 de toxina solo desarma a ladrones chicos: contra un −1 de
  220 la toxina se atraviesa sin rebotar (medido: el cazador grande nunca
  quedó envenenado). Contra cazadores grandes la reserva tiene que ir mucho
  más alta, como en el erizo de más abajo.

## Armado a pedido: _Paranoia_ {#a-pedido}

_Paranoia_ (`Paranoia1_F1_Eight_-02.09.04.txt`) no paga nada hasta que el
peligro aparece, y entonces paga lo justo. Tiene dos disparadores.

**Ve un bot que sabe atar.** [[.reftie]] no mide lazos puestos: cuenta
cuántas veces aparece la orden de atar en el ADN del bot que está mirando.
Si ve alguien con esa orden (y no es de su especie), arma baba y toxina, y
avisa a los suyos por olor para que se armen también:

```adn
' Si vi un bot que sabe atar: baba, y aviso por olor
cond
 *45 0 >
 *.slime 100 <
 *.nrg *.slime >
start
 50 .mkslime store
stop

cond
 *45 0 >
start
 .out1 inc
stop

' Y el que ve el aviso, se arma tambien
cond
 *.in1 0 >
start
 45 inc
stop
```

<!-- probado: Paranoia1_F1_Eight_-02.09.04.txt contra un bot que solo ata lazos (sin disparos), --ciclos 100: baba 0 → 112 → 115, toxina 0 → 100 → 103 (se estabilizan apenas encima de 100); de paso Paranoia lo caza por lazo (3000 → 5138; el atacante, cadáver al ciclo 40); re-corrido: idéntico (baba 112→115, toxina 100→103, 5138.92 al 40, atacante cadáver) -->

En la corrida contra un bot que solo ataba lazos, baba y toxina subieron y
se quedaron apenas encima de 100 (hace 50 cuando baja de 100). Y de paso
_Paranoia_ se lo comió: también sabe cazar por lazo, y el atacante terminó
cadáver al ciclo 40.

**Le pega un disparo.** El bot sabe qué le llegó y de qué lado: el sabor está
en [[.shflav]], y [[.shup]], [[.shdn]], [[.shsx]] o [[.shdx]] según el
ángulo. Un −6 dispara la curación, en cuatro genes gemelos (uno por lado; el
de atrás además contesta):

```adn
' Golpe de cuerpo por atras: caparazon nuevo y cuerpo rehecho
cond
 *.shdn -6 =
 *.body *.nrg !%=
start
 50 .mkshell store
 50 .strbody store
 -1 .backshot store
 5 .up store
stop
```

<!-- probado: Paranoia1 contra un cazador de -6, --ciclos 120: caparazon 0 → 149 (ciclo 45) → 527; cuerpo 1000 → 1022,51; energia 3000 → 1098; el cazador gana igual, 3000 → 4454; Paranoia vivo al 120. Contra un cazador de -1: vaciado antes del ciclo 60 -->

Cada curación sale 55 de energía (5 por los 50 de caparazón, 50 por los 5 de
cuerpo que devuelve [[.strbody]]) más lo que el golpe robó: el −6 se lleva
parte de la energía y del cuerpo. En 120 ciclos contra un cazador de −6,
_Paranoia_ pasó de 0 a 527 de caparazón, terminó con _más_ cuerpo que al
arrancar (1023 contra 1000) y siguió vivo, pagando unos 1900 de energía; el
cazador ganó igual (1454), pero más lento. La versión para el −1 (su gemela
con [[.fdbody]]) le alcanzó menos: contra el cazador del tutorial lo vació
antes del ciclo 60. Reaccionar cura; prevenir, como el erizo de abajo, ni te
deja herir.

## Esquivar y contestar, sin sustancias {#esquivar}

<!-- Untitled_defensive_shooter_Testlund_2012.txt; probado: contra el cazador del tutorial (campo 1500x1000, semilla 2), --ciclos 150: recibe el -1 al ciclo 25, esquivando; cadáver antes del ciclo 75, el cazador pasa a 6092 y se reproduce -->

El último bot no fabrica ninguna de las cuatro: _Untitled defensive shooter_
(`Untitled_defensive_shooter_Testlund_2012.txt`) lee el disparo que recibe y
reacciona. Un −1 lo hace saltar al azar (con un gen aparte); y cualquier
golpe que no sea un regalo lo gira hacia el tirador, lo echa para atrás a
fondo y le contesta con los desechos:

```adn
' Cualquier golpe que no sea un regalo: me giro hacia el tirador,
' retrocedo y le contesto con los desechos
start
 *.shflav 0 !=
 *.shflav -2 != and
 0 .shflav store
 *.aim *.shang sub .setaim store
 *.maxvel .dn store
 -4 .shoot store
 *.waste .shootval store
stop
```

[[.shang]] es el ángulo del disparo que te pegó: con `*.aim *.shang sub` el
bot se orienta hacia de dónde vino. Es una defensa elegante y gratis… hasta
que el enemigo insiste: en la corrida, contra el mismo −1 que no pudo con el
erizo, saltó al azar con cada golpe recibido, se fue vaciando de todos modos
y quedó cadáver antes del ciclo 75. La reacción llega siempre un ciclo tarde;
la toxina parada rebate el golpe en el mismo ciclo en que te lo tiran.

## Un erizo mínimo {#erizo}

Acá tenés la versión mínima de «toxina mientras me sobra energía», completa
y lista para sembrar:

```adn
' Erizo de toxina: quien lo muerde, queda mudo
cond
 *.robage 0 =
start
 .shoot .ploc store
 0 .pval store
stop

' Toxina mientras tenga energia de sobra
cond
 *.poison 1000 <
 *.nrg 500 >
start
 100 .strpoison store
stop
end
```

El porqué del 1000: la toxina solo rebota golpes más chicos que ella, y un
−1 de un cazador de 1000 de cuerpo pega con 220. Mantener 1000 cuesta unos 5
de energía por ciclo (25 por cada reposición de 100, más el 2 % que se
evapora; con los costos de la liga F1, 5,2), mientras haya energía de sobra.

<!-- probado: erizo-toxina contra el cazador del tutorial (campo 1500x1000, semilla 1), --ciclos 200: tres mordidas en los primeros ciclos, el cazador queda .poisoned 438 → 263 y con .shoot borrado; su energia clavada en 3000 (2994 con --cost de la F1: 3 disparos × 2); erizo 3000 → 1600. El mismo cazador contra un blanco quieto: cadaver antes del ciclo 40, cazador 3000 → 6163; re-corrido: idéntico (poisoned 438 → 263, cazador en 3000, erizo 3000 → 1600) -->

Contra el cazador del tutorial, en 200 ciclos: el cazador lo mordió tres
veces en los primeros ciclos, cada rebote le sumó ~146 ciclos de
envenenamiento, y con su [[.shoot]] borrada ciclo a ciclo no volvió a
disparar nunca. Su energía quedó clavada en 3000: cero ganancia. El erizo
gastó 1400 en mantenerse tóxico y terminó entero. El mismo cazador contra un
blanco quieto lo dejó cadáver antes del ciclo 40, con 6163 de energía.

La variante de caparazón, contra un cazador de −6:

```adn
' Erizo de caparazon: el caparazon se come los -6
cond
 *.shell 1000 <
 *.nrg 500 >
start
 100 .mkshell store
stop
end
```

<!-- probado: erizo-caparazon contra un cazador de -6 (campo 1500x1000, semilla 1), --ciclos 200: caparazon oscila alrededor de 1000, cuerpo 1000 intacto, energia 3000 → 2440 (~2,8 por ciclo); cazador clavado en 3000. El blanco quieto contra el mismo cazador: cadaver antes del ciclo 60, cazador 3000 → 14871 -->

Como el caparazón no se evapora, este erizo solo repara lo que le comen los
disparos: unos 2,8 de energía por ciclo bajo fuego. En 200 ciclos terminó con
el cuerpo intacto y el cazador sin haber ganado nada. Sin caparazón, el blanco
quedó cadáver antes del ciclo 60 y el cazador pasó de 3000 a 14871.

## Qué probar después {#despues}

<!-- 21-MEMORIA/conespecífico (veneno y toxina absorbidos entre parientes, [[simulacion/especies#especie]]); sysvars refshell/refpoison/refvenom -->

- **Combiná.** Caparazón + toxina cierran el −6 y el −1; sumale baba si hay
  quien ate. Después medí cuánto antes se queda seco el mismo bot en la liga
  F1 subiendo el [[param:cost:54]].
- **Mirá las defensas del otro** antes de atacarlo: [[.refshell]],
  [[.refpoison]] y [[.refvenom]] te dicen cómo viene equipado (es lo que
  hace _Paranoia_ para decidir a quién cazar).
- **Lleválo a un torneo**: donde lo que importa es durar, un bot que nadie
  puede morder se paga solo — [[estrategias/torneos]].
- **Y ojo con los de tu propia especie**: al veneno y a la toxina un
  conespecífico los absorbe sin daño, así que contra un caníbal de tu
  especie no te defienden — [[estrategias/canibales]].
