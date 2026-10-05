---
titulo: Un alimentador por lazo
resumen: "Paso a paso: un bot que encuentra una presa, la ata con un lazo, le chupa la energía por el lazo, la suelta cuando se seca y se reproduce con la ganancia."
etiquetas: [tutorial, lazos, caza, energía, parásito]
estado: revisada
---
En [[tutoriales/busca-comida]] le robás la energía a los vegetales a disparos,
y en [[tutoriales/vegetal]] criaste esas algas que fabrican energía de la luz.
Este tutorial construye al tercero en discordia: un bot que no caza ni
fotosintetiza, sino que ata su comida con un lazo y se la chupa. Cada paso le
agrega genes al ADN y te dice qué deberías ver.

## Un lazo en vez de un disparo {#por-que}

<!-- 34-TIES §2 (transferencias por tieloc −1); port/core ties.hpp tie_transfers (al sacar 1000, quien saca gana 700 de nrg, 29 de body y 10 de waste); 30-FISICA §3.1 (el lazo es un muelle amortiguado) -->

Cazar a disparos ([[tutoriales/dispara]]) es correr detrás de la comida. Con
un lazo ([[simulacion/lazos]]) te atás _una vez_ y el lazo trabaja solo:
**fija** a la presa (es un resorte: no se va a ningún lado mientras comés) y
la **vacía** (por el lazo le transferís energía cada ciclo, directo de su
reserva a la tuya — [[simulacion/lazos#recursos]]).

El precio: de cada 100 que le sacás, te quedás con 70 como energía, casi 3
como cuerpo y 1 como desecho. Rinde menos que un buen disparo; la
compensación es que la orden pasa todos los ciclos, gratis y sin puntería.

## Paso 1 · La presa {#presa}

<!-- app/observar #sembrar (DialogoSembrar: «Vegetal (hace fotosíntesis)»); app/bots #nuevo (como en tutoriales/dispara #blanco) -->

Necesitás algo con energía que no se defienda. Sembrá en **Observar** →
**Sembrar** el alga que armaste en [[tutoriales/vegetal]] marcada como
**Vegetal (hace fotosíntesis)**, o unas cuantas copias de un blanco quieto
como el de [[tutoriales/dispara]]:

```adn
' Blanco de practica: no hace nada
cond
start
stop
```

Al blanco lo vamos a ver morir de a poquito; el alga, con el sol de fondo,
dura más. Para las mediciones de este tutorial usamos el blanco quieto, un
campo de 1200×900 y bots de 3000 de energía.

## Paso 2 · Encontrarla y acercarse {#acercarse}

<!-- 34-TIES §1 (FireTies: solo ata al bot que se está viendo, a ≤ 4·RobSize + radios; maketie exige length ≤ 1,5·(radios + 2·RobSize): con bots de 1000 de cuerpo, hasta unos 470 de borde a borde, menos si son chicos); 32-VISION §2.6 (el ojo con foco llena las ref*); sysvars .refnrg (un cadáver muestra su energía real) -->

El lazo solo alcanza al bot que estás viendo, y de cerca: el motor no ata a
más de unos 480 de borde a borde, y menos si los bots son chicos. Así que
primero está la caza de siempre: girar buscando,
apuntar, acercarse. Con dos genes alcanza, porque el ojo con foco ya te
describe al que mejor tenés enfrente: su posición en [[.refxpos]] y
[[.refypos]], su energía en [[.refnrg]] y su especie en [[.refeye]]
([[simulacion/vision#foco]]).

```adn
' Manos libres y lo de enfrente no se come: virar al azar y avanzar
cond
 *.tiepres 5 !=
 *.refnrg 100 <
 *.refeye *.myeye =
 or
start
 314 rnd .aimdx store
 10 .up store
stop

' Manos libres y presa a la vista: apuntarle y acercarse
cond
 *.tiepres 5 !=
 *.refnrg 100 >
 *.refeye *.myeye !=
start
 *.refxpos *.refypos angle .setaim store
 10 .up store
stop
```

Tres decisiones nuevas en esas condiciones:

- **[[.refnrg]] por encima de 100** es «esto tiene energía y está vivo»: los
  cadáveres, que muestran su energía real, 0, quedan fuera del menú.
- **[[.refeye]] distinto de [[.myeye]]** es la prueba de especie de
  [[tutoriales/reconoce-especie]]: no le corre a los tuyos.
- **[[.tiepres]] distinto de 5** es «no estoy comiendo»: el 5 es el _puerto_
  con el que vamos a llamar al lazo del paso siguiente, y esta marca impide
  que el bot ate dos presas a la vez.

El primer gen usa [[op:or]]: vira si lo que ve no se come _o_ es pariente, y
avanza siempre, empujando lo que estorbe.

**Qué deberías ver:** el bot pivota y camina al azar hasta que la presa entra
al abanico de los ojos; ahí clava el rumbo con [[.setaim]] y va derecho. En
nuestra corrida la tenía enfocada al ciclo 2 y la tocaba al 11.

## Paso 3 · Atarla {#atarla}

<!-- 34-TIES §0.2 (puertos asimétricos: el creador elige el número, el receptor su orden de llegada), §0.5 (TIECOST/(numties+1), baba deflecta: Random(2,92), −20 por intento), §0.1 (máximo 9); opciones.js cost:22 (0 por defecto, 2 en la F1) -->

```adn
' Presa cerca y enfrente: atarla con el puerto 5
cond
 *.tiepres 5 !=
 *.refnrg 100 >
 *.refeye *.myeye !=
 *.eye5 50 >
start
 5 .tie store
stop
```

Un [[.eye5]] de 50 son unas 200 unidades de borde a borde: al cruzar esa
línea, el bot escribe 5 en [[.tie]] y al final de la fase de acciones el motor
lo ata al bot que está viendo. El 5 es el _puerto_: el nombre con el que _vos_
vas a elegir ese lazo; la presa lo va a llamar 1, por su orden de llegada
([[simulacion/lazos#puertos]]). La orden se borra siempre, salga o no, y cada
intento cobra el costo de atar ([[param:cost:22]]): 0 en las simulaciones de
fábrica, 2 en la liga F1.

La presa todavía puede zafar: su baba desvía el intento ([[.slime]] — con más
de 92 no hay lazo posible) y cada intento, salga o no, le gasta 20
([[simulacion/defensas#baba]]).

**Qué deberías ver:** en la app, una línea fina entre los dos, azulada mientras
el lazo está blando. En la memoria del inspector ([[app/inspector]]): el
alimentador con [[.numties]] en 1 y `.tiepres` en 5; la presa, con `.tiepres`
en 1.

:::cuidado
Atar dos veces al mismo bot reemplaza el lazo viejo, pero atar a **dos presas
distintas con el mismo puerto** te deja con dos lazos llamados 5, y el control
se te suelta: las órdenes por puerto —transferir, fijar, escribir en la memoria
del otro— les llegan **a los dos a la vez**, mientras que las
[[sysvars/tref|celdas tref*]] solo describen al primero y [[.deltie]] corta un
lazo por pasada. Por eso todos los genes de caza exigen «manos libres»:
mientras `.tiepres` valga 5, este bot no busca, no se acerca ni ata a nadie
más.
:::
<!-- port/core ties.hpp Update_Ties/tieportcom (las órdenes con .tienum recorren TODOS los lazos con ese puerto; readtie lee el primero; el bucle de .deltie, con el corrimiento de DeleteTie, corta uno por pasada — igual que Ties.bas:193-200); core DeleteTie (borrar el lazo más antiguo deja .tiepres en 0 aunque queden otros) -->

## Paso 4 · Chuparle la energía {#comer}

<!-- 34-TIES §2 (transferencias por tieloc negativo: −1 energía, tope sacar 3000 por ciclo); port/core ties.hpp tie_transfers (al sacar, quien recibe se queda 0,7 como nrg, 0,029 como body y 0,01 como waste; con toxina suficiente en la presa, en vez de comer te envenena); comprobado con probar-adn --otro (1200x900, semilla 3, sin costos ni mutaciones) -->

```adn
' Presa atada que no es de los mios: leerla y chuparle energia
cond
 *.tiepres 5 =
 *.trefeye *.myeye !=
start
 5 .readtie store
 5 .tienum store
 -1 .tieloc store
 -1000 .tieval store
stop
```

Cuatro órdenes: [[.readtie]] apunta los sentidos del lazo (las
[[sysvars/tref|celdas tref*]]) al puerto 5; [[.tienum]] elige el lazo 5 para
todo lo demás; [[.tieloc]] en −1 dice «transferir energía» y [[.tieval]]
negativo, «sacar». Podés sacar hasta 3000 por ciclo; pedimos 1000, y el motor
te lo recorta a lo que le quede a la presa.

La transferencia ocurre en la fase de movimiento de ese mismo ciclo, y al
siguiente ya estás comiendo. Lo que medimos contra el blanco quieto:

| Ciclo | Presa | Alimentador (energía / cuerpo / desecho) |
|---|---|---|
| 12 | 3000 (atada) | 3000 / 1000 / 0 |
| 13 | 2000 | 3700 / 1029 / 10 |
| 14 | 1000 | 4400 / 1058 / 20 |
| 15 | 0: cadáver | 5100 / 1087 / 30 |

Cada ciclo la presa pierde 1000 y vos ganás 700 de energía, 29 de cuerpo y 10
de desecho ([[.waste]]): el 30 % restante se pierde en el camino. La
condición con [[.trefeye]] es la misma prueba de especie, ahora mirando al
atado en vez de al visto.

:::cuidado
Sacarle energía a un bot con toxina te envenena en vez de alimentarte. En una
corrida contra una presa que fabricaba toxina con [[.strpoison]], el
alimentador quedó marcado como envenenado ([[.poisoned]]) ciclo tras ciclo sin
ganar nada. Tampoco es para siempre: cada intento fallido le gasta toxina a la
presa, y cuando su reserva queda corta, el lazo empieza a pasar energía
normal — es lo que medimos. Para no bancarte el castigo, atacá primero a los
que no la fabrican ([[simulacion/defensas#toxina]]).
:::
<!-- port/core ties.hpp tie_transfers (retaliación: con poison > un cuarto de lo pedido, Poisoned en vez de transferir, y la presa pierde esa toxina); comprobado con probar-adn contra una presa con 100 .strpoison por ciclo: poisoned 249 -> 2383 mientras la toxina de la presa baja de ~1000 a ~200, y recien ahi el alimentador empieza a cobrar -->

## Paso 5 · El resorte: fijar la presa {#resorte}

<!-- 30-FISICA §3.1 (muelle con zona muerta de 20; blando k 0,01, endurecido 0,05; rotura a más de 1000 de borde a borde), §3.2 (TieTorque en ambos bots); 34-TIES §0.4 (endurecimiento a los 19 ciclos, regang, multibot); comprobado con probar-adn: atar a la carrera deja al par deslizando junto unas 200 unidades antes de asentarse; endurecido, .multi 1 en los dos -->

Atar a la carrera tiene su física. El lazo nace con el largo que había al
formarse y tolera 20 unidades de diferencia sin hacer nada: fuera de esa zona
muerta es un resorte que tira de los dos. Como llegás empujando, el largo
queda corto, la presa queda casi pegada y el par sigue deslizando junto unas
200 unidades antes de asentarse — arrastrar funciona igual al revés, cadáver
incluido. Eso sí: un vegetal cargado de cloroplastos es muchísimo más masivo
que un bot de puro cuerpo ([[simulacion/fisica#estado]]).

A los 19 ciclos el lazo se endurece: en la app la línea se vuelve ocre y más
gruesa, y los dos bots pasan a ser multicelulares ([[.multi]] vale 1 en los
dos). Para entonces podés mandarle geometría: [[.fixlen]] fija el largo y
[[.fixang]] el ángulo, y la presa pasa a colgarte de un brazo corto, frente a
la nariz.

```adn
' Lazo endurecido: llevarla pegada y al frente
cond
 *.multi 1 =
 *.tiepres 5 =
start
 100 .fixlen store
 0 .fixang store
stop
```

En nuestra corrida, desde el endurecimiento, [[.tielen]] bajó de a poco hasta
unos 40 de borde a borde y [[.tieang]] fue acercándose a 0: la presa quedó a
un palmo, muerta adelante. Con una presa chica el banquete dura menos que
esos 19 ciclos, así que el gen recién luce con las presas gordas. Ser
multicelular con tu propia comida tiene efectos laterales —los costos se
dividen y tus disparos pegan más ([[simulacion/lazos#multicelulares]])— y es,
exactamente, el mecanismo que [[tutoriales/multibot]] usa para bien.

## Paso 6 · Soltar cuando se seca {#soltar}

<!-- 34-TIES §1 (DeleteTie desde cualquier extremo; el cadáver sigue atado); 21-MEMORIA §9 (las tref* se leen con un ciclo de atraso); comprobado con probar-adn: sin este gen el cadaver queda atado cientos de ciclos; con el, numties 0 un ciclo despues de que la presa llega a 0 -->

La presa seca no desaparece: queda como cadáver y **sigue atada**, y un bot
que no suelta vive arrastrando su despensa vacía. El gen que falta:

```adn
' La presa se seco: soltarla
cond
 *.tiepres 5 =
 *.trefbody 0 >
 *.trefnrg 100 <
start
 5 .deltie store
stop
```

[[.trefnrg]] es la energía del atado, leída por el lazo con un ciclo de
atraso. Con menos de 100 no queda nada que chupar: [[.deltie]] corta el lazo
5 y el bot queda libre. La condición con [[.trefbody]] evita un falso
positivo: en el primer ciclo del lazo las celdas `tref*` todavía están vacías,
y sin ese control el bot cortaría la presa recién atada.

**Qué deberías ver:** un ciclo después de que la presa llega a 0, los dos
quedan con `.numties` en 0 y el alimentador vira a buscar otra. No vuelve a
atar al cadáver: la prueba de `.refnrg` del paso 2 ya lo deja fuera del menú.

## El bot completo {#el-bot}

Falta lo de siempre: cuando la energía sobra, hijos. El gen pide un 30 % con
[[.repro]] a partir de 6000, y solo con las manos libres: el parto necesita
lugar libre delante, y mientras comés tenés la presa tapando ese lugar. Este
es el bot entero, tal como lo corrimos:

```adn
' Un alimentador por lazo
' Busca presa, la ata con el puerto 5, le chupa la energia,
' la suelta cuando se seca y, con la ganancia, tiene hijos.

' Manos libres y lo de enfrente no se come (o es de los mios):
' virar al azar y avanzar
cond
 *.tiepres 5 !=
 *.refnrg 100 <
 *.refeye *.myeye =
 or
start
 314 rnd .aimdx store
 10 .up store
stop

' Manos libres y presa a la vista: apuntarle y acercarse
cond
 *.tiepres 5 !=
 *.refnrg 100 >
 *.refeye *.myeye !=
start
 *.refxpos *.refypos angle .setaim store
 10 .up store
stop

' Presa cerca y enfrente: atarla con el puerto 5
cond
 *.tiepres 5 !=
 *.refnrg 100 >
 *.refeye *.myeye !=
 *.eye5 50 >
start
 5 .tie store
stop

' Presa atada que no es de los mios: leerla y chuparle energia
cond
 *.tiepres 5 =
 *.trefeye *.myeye !=
start
 5 .readtie store
 5 .tienum store
 -1 .tieloc store
 -1000 .tieval store
stop

' Lazo endurecido: llevarla pegada y al frente
cond
 *.multi 1 =
 *.tiepres 5 =
start
 100 .fixlen store
 0 .fixang store
stop

' La presa se seco: soltarla
cond
 *.tiepres 5 =
 *.trefbody 0 >
 *.trefnrg 100 <
start
 5 .deltie store
stop

' Energia de sobra y manos libres: un hijo
cond
 *.nrg 6000 >
 *.tiepres 5 !=
start
 30 .repro store
stop
```

Contra dos blancos quietos, en un campo de 1200×900: vació al primero en
diez ciclos (quedó en 5100), tardó unos setenta más en dar con el segundo,
lo vació igual, y al ciclo 90 nació el primer hijo — el padre quedó en 5037,
el hijo arrancó con 2157 y el mismo ADN. Después los dos vagaron sin
encontrar nada: el campo estaba limpio.

<!-- probado: final contra 2 blancos (--qty 2) como primera especie y el alimentador como --otro, 1200x900, semilla 3, 150 ciclos: presa 1 muerta al ciclo 10, presa 2 al 85, parto al 90 (padre 5037.84, hijo 2157.84), despues nada mas que vagar; lint sin avisos -->

En el Bestiario hay alimentadores por lazo de verdad. El _Hybrid of a
tiefeeder and Alga Chloroplastus_ es este bot con menos nudos: se ata con
`.tie` a quien no es de su especie, le saca 1000 por ciclo con `.tieloc` en
−1 y corta el lazo si el atado resulta pariente. Lo corrimos contra un
blanco quieto: lo vació en unos diez ciclos, pero siguió arrastrando el
cadáver. Soltar la presa seca es la mejora que le pusimos nosotros.
<!-- Bestiario: port/web/bots/Hybrid_of_a_tiefeeder_and_Alga_Chloroplastus.txt (genes: .tie inc a quien no es de la especie; *.tiepres .tienum store, -1000 .tieval, -1 .tieloc; .deltie si *.trefeye = *.myeye); comprobado con --veg --otro blanco, 1200x900, semilla 5: 3000 -> 0 en el blanco al ciclo ~30 y numties 1 (al cadaver) todavia al 60 -->

## Qué probar después {#despues}

- **Presas gordas.** Contra un vegetal que fotosintetiza mientras comés,
  subí la extracción: el tope es 3000 por ciclo, no 1000. Y probá soltar
  _antes_ de que se seque del todo: el umbral está en el gen del paso 6.
- **Comerte los cadáveres.** El −1 solo saca energía; con `.tieloc` en −6 le
  sacás cuerpo, y el cuerpo del cadáver atado es la sobremesa. En una corrida
  larga contra un campo lleno de algas, nuestro bot terminó enterrado entre
  los cadáveres de sus propias presas: son muros — y de fábrica ni se pudren,
  porque la [[param:opt:51|Descomposición por ciclo]] viene en 0. Vaciarlos
  con el −6 es la cura.
  <!-- .tieloc (-6 cuerpo, sacar 300 por ciclo); 10-CICLO §5 P2 + 33-SHOTS §5 (Decay: cada opt:52 ciclos el cadáver pierde opt:51/10 de cuerpo; con el 0 de fábrica, nada); opciones.js opt:51 (por defecto 0); comprobado: el alga --veg --vegs 3 como primera especie y el alimentador como --otro, 1500x1000, semilla 7, 600 ciclos: ~33 presas vaciadas (nrg 26095) y desde el ~300 atascado entre cadaveres (eye5 32000, refnrg 0); los cuerpos (1004) no se descompusieron en 540 ciclos -->
- **Que no te lo roben.** Otro alimentador puede atarse a tu presa, o a vos.
  La baba es la defensa específica: con más de 92 nadie te puede atar, y cada
  intento fallido le cuesta 20. La toxina castiga al que chupa. Y como
  `.deltie` corta desde cualquier extremo, un gen que corte los lazos que no
  pediste te limpia de parásitos — ojo: cortaría también el lazo de
  nacimiento con tu hijo
  ([[simulacion/lazos#nacimiento]], [[simulacion/defensas]]).
- **Paralizar la presa.** Por el lazo también viaja veneno: `.tieloc` en −3
  la deja quieta con tu [[.strvenom]], para que no se arrastre con vos a
  ningún lado ([[.tieloc]]).
- **El mismo mecanismo, para bien.** Todo lo que acá usaste para vaciar a
  otro, un multibot lo usa para alimentar a los suyos: `.tieval` positivo le
  pasa energía a tu compañero, y [[.sharenrg]] la reparte parejo. Seguí con
  [[tutoriales/multibot]] y, para las tácticas de torneo,
  [[estrategias/multibots]].
