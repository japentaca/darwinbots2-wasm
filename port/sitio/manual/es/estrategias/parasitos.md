---
titulo: Parásitos y virus
resumen: "Del lazo que ata y chupa al virus que reescribe el ADN ajeno: tres bots del Bestiario diseccionados, con números medidos, y una receta mínima de contagio."
etiquetas: [parásitos, virus, lazos, bestiario, epidemia]
estado: revisada
---
En [[tutoriales/alimentador]] armaste un bot que ata su comida con un lazo y la
vacía. Para ese bot era una técnica de caza; los de esta página hacen del
parasitismo un estilo de vida: viven pegados a otro bot, o directamente viven
_dentro_ de su ADN. La mecánica ya la conocés — los lazos en [[simulacion/lazos]],
los virus en [[simulacion/virus]] —, así que acá vamos derecho a los diseños del
Bestiario y a lo que pasa cuando los ponés a correr.

## Cuándo paga cada estrategia {#cuando-paga}

Un lazo alcanza apenas: solo ata al bot que estás viendo y de cerca, unos 400
de borde a borde. Atar es la parte fácil; retener es la carísima. El lazo nace
blando y estira sin frenar a una presa que corre (lo medimos estirado a 490
sin romperse; recién revienta pasado el 1000) y solo a los 19 ciclos, si no
re-ataste, se endurece y se vuelve un brazo. Conviene, entonces, contra presas
lentas o quietas: vegetales, bots trabados contra una pared. Y como chuparle a
un bot con toxina te envenena en vez de alimentarte
([[tutoriales/alimentador#comer]]), las víctimas indefensas son las que mejor
pagan.
<!-- 34-TIES §1 (alcance del FireTies, endurecimiento a los 19, rotura > 1000); probado: Leechbot con el huesped huyendo a vel 40, lazo blando estirado a ~490 -->

El virus es lo contrario: no apunta. Sale hacia un lado al azar, vuela lejos y
contagia al primero que toque, así que paga en mundos poblados y con la presa
lejos. Lo paga caro la baba del otro: con unas 20 unidades frena cualquier virus
([[simulacion/virus#infeccion]]). Y no distingue especies: tu propia descendencia
puede contagiarse.

| | Parásito de lazo | Virus |
|---|---|---|
| Qué le sacás al otro | Energía — y con el reparto, también caparazón y baba | El mando de su ADN |
| Cuánto esperás | El lazo endurece a los 19 ciclos; recién ahí compartís | El gen incuba 2 ciclos por palabra |
| Falla contra | Presas rápidas; la baba desvía el atado | ~20 de baba; los cadáveres |

## Leechbot: chupar compartiendo {#leechbot}

_Leechbot_ (Atutouato, 2013) es el parásito de lazo en su forma más
descarnada. Su gen de caza ata a lo que ve, sin preguntar de qué especie es; el
trabajo sucio lo hace el reparto:
<!-- Leechbot_F1_Atutouato_25.3.2013.txt (genes six, eight, 12, nine, 10, 11) -->

```adn
' Atar a lo que se ve, hasta tres lazos
cond
*.eye5 40 >
*.numties 3 <
start
1 .tie store
stop

' Multicelular: quedarme con el 99 % de todo
cond
*.multi 1 =
start
99 .sharenrg store
99 .shareslime store
99 .shareshell store
.sharewaste inc
stop
```

El 99 en [[.sharenrg]] no es una transfusión: es «sumá tu energía con la mía y
déjame el 99 %», cada ciclo, hasta el tope de su cuerpo. Es una succión mucho
más rendidora que el `−1` del tutorial, que pierde el 30 % en el camino; acá solo
se paga el 1 % de lo movido. Lo mismo le hace a la baba y al caparazón del
atado.
<!-- 34-TIES §2.1 (sharenrg: tope por body, 1 % al iniciador, se borra cada ciclo, solo el lado que creó el lazo); port/core ties.hpp tie_transfers (el −1 rinde 0,7) -->

Corrido contra un blanco que camina: lazo al primer ciclo, endurecimiento
recién al 53 (el gen de caza re-ata cada vez que ve a la presa, y cada
re-ata re inicia el reloj) y desde ahí el huésped se vació a mil por ciclo —
de 3000 a 2000 y a 1000 en los ciclos 54 y 55, cadáver al 60—, con el parásito
cobrando 990. Después tuvo un hijo, y ahí se vio el
costo de no mirar de quién es el atado: pibe y padre quedaron atados entre sí,
los dos corrieron el gen de chupado, se sacaron 1000 por ciclo cada uno, y el
padre terminó seco al ciclo 67. El hijo, que venía con menos, frenó en 548
cuando el otro pasó a ser cadáver.
<!-- probado: 800x600, semilla 1, 80 ciclos, --cada 1: lazo en el ciclo 1 (puerto 2: el 1 del gen six más el .tie inc del gen 10), multi al 53, huesped 3000 -> 2000 -> 1000 (ciclos 54-55) -> cadaver al 60; hijo al 56, padre e hijo a −300 netos por ciclo, padre cadaver al 67, hijo frena en 548; re-corrido (--cada 10): multi al 60, huesped cadaver al 60, padre cadaver al 70, hijo frena en 548.25 -->

El bot tiene además un gen que promete chupar 1000 por ciclo con `−1`, y un gen
«hacker» que le escribiría un 0 en la [[.up]] del atado para frenarlo. Los dos
juntos no hacen ninguna de las dos cosas: el hacker pisa `.tieloc` con la
dirección de `.up` (la transferencia pide `.tieloc` negativo) y deja `.tienum`
leyendo una celda que nadie escribió nunca, así que la escritura en la memoria
ajena tampoco sale. El huésped, mientras tanto, nunca aflojó: siguió
empujando a fondo —su [[.vel]] marcó 40 toda la corrida— hasta quedar
apretado contra la pared del campo, con el lazo estirado sosteniéndolo.
<!-- Leechbot genes 12 y nine: *55 .tienum store lee la celda 55 (0 para siempre); .up .tieloc store deja tieloc positivo; probado: el huesped nunca bajo su velocidad (en el campo chico termina apretado contra el borde) -->

## P1 Parasite bot: la remora {#p1-parasito}

_P1 Parasite bot_ (Fizban, 2004) es un parásito de lazo con modales. Elige
huésped: quien dispara ([[.refshoot]] por encima de 0, así no pierde tiempo en
vegetales), que no esté clavado, que no sepa atarse ([[.reftie]], la firma de
los lazos) y que no lleve su código de familia, un 666 que publica en
[[.out1]] y comprueba en [[.in1]]:

```adn
' Solo un huésped que dispara, no clavado, que no sepa atar
' y que no lleve mi marca: atarlo con el puerto 666
cond
*999 0 =
*.numties 0 =
*.eye5 20 >
*.refshoot 0 >
*.reffixed 0 =
*.in1 666 !=
*.reftie 0 =
start
666 .tie store
0 .aimsx store
0 .up store
-1 999 store
stop
```

Después de atar fija su propio ángulo del lazo en 0 — el huésped siempre le
queda adelante y viaja colgado como una remora (en la corrida, el ángulo se
quedó rondando los −17, una fracción de vuelta) — y una vez multicelular chupa
a sorbitos, según lo lleno que esté el otro:

```adn
' Chuparle despacio mientras el huésped está lleno
cond
*999 3 =
*.refnrg 2500 >
start
666 .tienum store
-15 .tieval store
-1 .tieloc store
stop
```

Medido contra un huésped con 3000: le saca 15 por ciclo (cobra 10,5) y baja a
10 cuando el otro baja de 2500. No lo mata: lo ordea. A los 3050 pide un hijo…
que nunca llega, porque el parto necesita lugar libre delante y adelante está
siempre el huésped: en 120 ciclos no nació nadie. El parásito que no mata al
huésped tampoco logra multiplicarse.
<!-- P1_Parasite_bot_F1_Fizban_-26.06.04.txt; probado en una variante sin los dos genes de infancia (400x300, semilla 2): atado al ciclo 8, multi al ~28, −15/ciclo (huesped −150 cada 10) y luego −10 (−100 cada 10); 999=4 desde ~36 sin partos en 120 ciclos; 36-REPRO §2 (colisión en el punto de parto); re-corrido contra un huésped que dispara: multi al 30, huesped −150 cada 10 y luego −100 cada 10, 999=4 desde el ~40, sin partos al 120 -->

Un detalle de la táctica: al huésped también le escribe cosas — un 666 en su
`.tienum` y un 628 en su [[.fixang]], para que lo mantenga bien adelante. Esa
orden no llega a ningún lado: el huésped llama a ese lazo con su número de
orden, no con el 666 del parásito, y la instrucción queda sin destinatario. El
viaje en pareja lo sostiene igual el `0 .fixang` del propio parásito.
<!-- 34-TIES §0.2 (el puerto es asimétrico: el receptor lo llama por su número de orden); probado: el par sigue junto igual -->

El bot original tiene una máquina de estados completa (una celda propia, la 999,
dice qué hacer: buscar, atar, acomodarse, chupar, multiplicarse). Por la letra
del ADN, en una simulación normal la cría es paciente: un gen la deja quieta
mientras tenga algún lazo y menos de 75 ciclos, y a los 75 se declara lista;
pero el gen de atado exige estar sin lazos, así que con el lazo de nacimiento
ocupándole el cupo recién puede tomar huésped cuando aquel se corta solo, a los
100 ciclos (esto se lee de los genes; no lo medimos con padres de verdad). En
nuestra prueba sin padres ató en seguida, y ahí apareció el otro supuesto: la
cría pisa con su −2 el −1 que dejó el atado, la máquina queda dormida y pasa la
corrida remolcando al huésped sin chuparle nada. La lección vale para todo este
capítulo: estos diseños dependen de supuestos («si tengo un lazo es porque
nací») que conviene releer cuando el mundo cambia.
<!-- 34-TIES §1 (lazo de nacimiento: 100 ciclos, puerto 0); P1 genes de cría (*.robage 75, *.numties 0 != → −2; *.robage 75 = → 0; el gen de atado pide *.numties 0 =); probado con el bot original contra un huésped que dispara (400x300, semilla 2, 130 ciclos): atado al ~8, 999=−2 hasta el 75, luego 999=0 con el lazo puesto: remolca y no chupa; re-corrido: idéntico; con un huésped pacífico nunca ata (el gen exige *.refshoot 0 >) -->

## El virus que toma posesión {#takeover}

El segundo camino no le roba energía al otro: le roba el futuro. Un virus
inserta un gen en el ADN de la víctima y, desde el ciclo siguiente, ese gen
corre como si fuera suyo ([[simulacion/virus#infeccion]]); el ADN lo admite
siempre, salvo que ya esté al límite de las 32000 palabras. La receta epidémica
la viste: empaquetar el gen con [[.thisgene]] para que el contagiado fabrique
y dispare más copias ([[simulacion/virus#epidemia]]).

_virusparttakeover_ (Spork/Shadowgod, 2014) es un _Animal Minimalis_ con un gen
extra que hace exactamente eso, y de paso le recorta el ADN al huésped:

```adn
' El gen de toma de posesion, tal cual está en el bot
cond
start
*.genes *.thisgene *.genes sub sgn 1 add sub .delgene *51 1 sub abs mult store
1 51 store
0 51 *.repro sgn 0 floor mult store
.tie inc
*.thisgene .mkvirus store
.vshoot inc
stop
```

La primera línea borra, con [[.delgene]], el último gen del huésped que no sea
él mismo. La tercera debería desbloquear el borrado para el ciclo siguiente…
y no funciona: la pila queda al revés y la orden se escribe en la dirección 0,
que no dirige ninguna celda. Resultado medido: un gen recortado, uno solo, la
primera vez que el gen corre. En el propio fabricante ese gen recortado es el
de reproducirse: el bot se castra a sí mismo en su primer ciclo y no vuelve a
tener hijos jamás.
<!-- virusparttakeover_F1_Spork_Shadowgod_8-13-2014.txt.txt; verificado el apilado a mano y probado aislado: borra exactamente un gen (5 -> 4 en el bot entero, 2 -> 1 en la prueba aislada) y *51 queda en 1 para siempre -->

Lo demás sí funciona, y muy bien. `.tie inc` ata a quien tenga cerca, y
`*.thisgene .mkvirus store` con `.vshoot inc` lo convierte en una fábrica
continua: el gen es largo (~35 palabras), así que cada copia incuba unos 70
ciclos — un virus cada ~70, en una dirección al azar. Lo que medimos en un
campo chico, con el gen solo (sin los genes de caza del bot entero):

- Al ciclo ~75 la primera víctima recibe el gen (uno entró, uno le recortaron:
  misma cantidad de genes, ADN más largo) y empieza a fabricar sus propios
  virus.
- Al ~155 la segunda víctima se contagia — de la primera, no del bot.
- Al ~160 el propio bot pilla una copia de vuelta: tiene el gen doble.
- Al ~215 la primera víctima recibe una segunda copia: con su celda 51 ya en
  1, esta no recorta nada, solo suma gen.

Cada contagiado paga sus propios disparos. La epidemia se sostiene sola.
<!-- probado (variante con el gen solo como --otro, 300x200, semilla 7, 3 victimas, 240 ciclos): victima 1 dnalen 16 -> 43 al ciclo 80 con vtimer 66; victima 2 dnalen 43 al 160; el bot genes 1 -> 2 al 160; victima 1 genes 2 -> 3 al 220; 35-VIRUS §0.3 (vtimer = 2 x palabras) -->

El bot entero, tal cual está en el Bestiario, conserva los genes de caza del
_Animal Minimalis_ y se come a las víctimas a disparos antes de que el virus
las alcance: en dos corridas con tres víctimas cada una, las seis murieron sin
contagiarse. Igual, el virus es el arma más pensada: la caza alimenta a la
generación actual, el gen insertado le gana la guerra a la especie rival
entera, porque cada hijo de la víctima nace contagiado.
<!-- probado: 300x200 semilla 7 y 900x700 semilla 5, victimas qty 3, nrg 9000: ninguna infectada (genes 2 hasta morir), el bot termina con 12000-32000 -->

## Un sedante mínimo {#sedante}

Para cerrar, una receta propia de una sola de las dos: un virus que no mata ni
drena, solo inmoviliza. El gen inyectado escribe 1 en [[.fixpos]], y ya está:
`.fixpos` es un interruptor que el motor nunca borra y que la física respeta
sin importar dónde cayó el gen en el ADN ajeno ni qué escriba después el
huésped. A vos la marca te salva: la celda 91 se escribe antes de que corra el
gen del sedante.
<!-- .fixpos: latch (el motor nunca la borra), un bot fijo no recibe fuerzas (30-FISICA §2); 35-VIRUS §3 (la inserción cae en cualquier frontera entre genes) -->

```adn
' Gen 1: marcarme (antes de que corra el gen 3) y avanzar
cond
start
1 91 store
10 .up store
stop

' Gen 2: fabricar el virus con el gen 3 y dispararlo
cond
*.vtimer 0 =
start
3 .mkvirus store
30 .vshoot store
stop

' Gen 3: el sedante — solo corre en quien no tiene la marca
cond
*91 0 =
start
1 .fixpos store
stop
```

Corrido contra un blanco que camina, en un campo de 300×200: al ciclo ~15 un
virus le pegó; el blanco quedó clavado en seco (velocidad 40 a 0, posición
congelada el resto de la corrida) y su ADN pasó de 1 gen a 2. El fabricante
siguió moviéndose: la marca funciona. Y siguió disparando: como ninguna
infección deja inmunidad, cada copia que le pega al mismo huésped le suma un
gen — al ciclo 150 su ADN ya llevaba siete copias del sedante, ocho genes en
total. Lo que paga el fabricante es la fuerza de cada disparo (acá 30, que el
multiplicador de costos no toca), más la copia y el disparo de costos de
siempre ([[simulacion/virus#costos]]).
<!-- probado: 300x200, semilla 1, 150 ciclos: victima fixed 1 y vel 0 desde el ~15, clavada en (185,7; 85,7), genes 1 -> 2 -> 8; fabricante fixed 0 toda la corrida; −30 de energia por virus (la fuerza), con todos los costos en 0 -->

¿Y ahora qué hacés con la presa clavada? Lo que quieras, con calma: acercarte a
dispararle como en [[tutoriales/dispara]], o atarte y chuparla como el
alimentador. ¿Hacerlo epidémico, agregándole `*.thisgene .mkvirus store` al gen
del sedante? Se puede, pero ojo: los virus no distinguen especie, así que un
pariente contagiado fabrica virus que te pueden pegar a vos. Toda arma
contagiosa necesita su marca, como la celda 91 de esta.

## Qué probar después {#despues}

- **Soltar a tiempo.** Tanto el alimentador como el parásito de lazo viven
  mejor si dejan al huésped con un piso de energía y se buscan otro: el corte
  está en [[tutoriales/alimentador#soltar]] y el umbral lo ponés vos. P1 hace
  algo así de elegante con sus sorbitos.
- **Borrar genes a propósito.** El gen del _takeover_ recorta uno por la
  equivocación de una línea; un diseño limpio elige qué borrar. El borrador
  completo, gen por gen hasta dejar al otro sin ADN, está armado y medido en
  [[simulacion/virus#delgene]].
- **La contra de las víctimas.** La baba frena los lazos y los virus
  ([[simulacion/defensas]], [[estrategias/defensivos]]). Y hay antivirus de
  verdad: _Animal Minimalis Antivirus_ (Shasta) registra el número de cada
  gen y, si una infección le desacomoda el ADN, borra al intruso. Lo probamos
  contra el sedante: el gen entró (lo dejó clavado), el antivirus lo borró en
  el acto y su ADN volvió a los cinco genes… pero lo que el gen ya había
  escrito en `.fixpos` no se deshace: siguió inmóvil hasta el final. Y de paso
  se comió a mi sedante a disparos: la mejor defensa sigue siendo atacar.
   <!-- probado: sedante vs Animal_Minimalis_Antivirus_Shasta.txt, 300x200, semilla 1, --cada 1: genes 5 → 6 al recibir el virus y 6 → 5 al ciclo siguiente, con fixed pasando a 1 en ese mismo ciclo (el gen corrió una vez, escribió .fixpos y fue borrado); el antivirus queda inmóvil y come al sedante (nrg 3000 -> 6115) -->
- **Las reglas del torneo.** Si competís, mirá [[param:opt:93]]: los niveles
  más estrictos descalifican por fabricar virus, por chupar energía a un rival
  por un lazo y por borrar genes. Tu parásito favorito puede ser ilegal sin que
  lo notes.
