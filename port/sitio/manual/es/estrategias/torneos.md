---
titulo: Bots de torneo
resumen: "Cómo se diseña un bot que gana partidos de la liga F1: qué se cobra de verdad, qué conviene gastar y las virtudes que separan a los campeones del Bestiario."
etiquetas: [torneos, liga f1, eficiencia, competir, bestiario]
estado: revisada
---
En [[app/competir]] están los formatos, las reglas y el Elo; esta página es la
otra mitad: cómo se piensa un bot que las aproveche. Un partido no es una
simulación libre. Los costos se cobran de verdad, los muertos no dejan comida,
las mutaciones vienen apagadas y la ronda la gana el que dura. La estrategia de
torneo es, antes que nada, economía.

<!-- opciones.js ajustesF1 (btnSetF1_Click): F1_COSTOS, F1_OPTS y F1_NOMBRADAS; port/README «Ajustes F1» -->

## Otra cancha, otras reglas {#economia}

El mundo de un partido con la **Base F1** es chico y sin rincones: un campo de
9237 × 6928 con los dos ejes conectados (no hay paredes donde esconderse),
suelo con rozamiento, una velocidad máxima de 180 y sin día ni noche. Dos
detalles que cambian todo el diseño:

<!-- opciones.js F1_OPTS (2=1, 3=1, 11=180, 16=0.6, 17=0.4, 19=2, 33=0, 40=1, 50=0); F1_NOMBRADAS (fieldW 9237, fieldH 6928, mutations 0, maxEnergy 40, minVegs 10, maxPopulation 25) -->

- **Los cadáveres están apagados** ([[param:opt:50]] en 0): un bot que muere
  desaparece con su energía. Comer es solo por disparos o por lazos; matar de
  gusto no deja premio.
- **Las mutaciones están apagadas y el ADN se congela al inscribirse**: lo que
  anotás es exactamente lo que corre, partido tras partido. No hay evolución
  dentro de la liga; la selección la hacés vos en el taller.

La despensa también es finita: cada ronda arranca con 15 algas de 3000 y la
repoblación solo repone si bajan de 10, así que la energía que entra al mundo
es acotada. Con los valores por defecto del torneo (5 bots por
especie, 3000 de arranque, tope de 5000 ciclos), lo que decide la ronda es cómo
administrás la tuya.

<!-- partido.js ALGA_ARRANQUE (qty 15, nrg 3000; el alga de arranque de la liga) y F1_NOMBRADAS (minVegs 10); competir.md valores por defecto (LG_FMT_DEFAULT: qty 5, nrg 3000, cap 5000); opciones.js F1_NOMBRADAS -->

Lo que la liga cobra, con el multiplicador en 1:

| Acción | Precio |
|---|---|
| Una comparación (aunque el gen no dispare) | 0,004 |
| Un [[op:store|store]] | 0,04 |
| Empujar, por unidad | 0,05 |
| Girar | gratis |
| Un disparo | 2 |
| Un intento de lazo | 2 |
| Un cloroplasto nuevo | 0,2 |
| Vivir un ciclo (edad + 1000 de cuerpo) | 0,02 |

<!-- opciones.js F1_COSTOS (5=0,004; 7=0,04; 20=0,05; 21 ausente = 0; 23=2; 22=2; 8=0,2; 30=0,00001; 31=0,01; 54=1; el resto en 0: números, lecturas, aritmética, lógica, control de flujo, giro, copia del ADN). El mantenimiento se cobra en la fase de fuerzas y choques (10-CICLO §5 P1). Precios de las defensas: [[estrategias/defensivos#precio]] -->

Los números, las lecturas de memoria y toda la aritmética salen gratis, y girar
también: escanear dando vueltas no cuesta nada; lo que cuesta es moverse,
escribir y disparar. Medido con estos ajustes: un bot quieto paga 0,02 por
ciclo, uno que empuja a fondo (40 de empuje) paga unos 2 y se queda seco antes
de los 1500 ciclos, y uno que busca a empujoncitos paga 0,34 y llega al tope de
5000 con energía de sobra. Nadar a fondo es la forma más cara de no encontrar
nada.

<!-- probado con probar-adn.mjs con los ajustes de la liga F1 (--campo 9237x6928 --opt 11=180,19=2,16=0.6,17=0.4,2=1,3=1,50=0,33=0,40=1,13=0,56=10000,63=0.5,60=1,62=1,21=0 --cost 5=0.004,7=0.04,23=2,20=0.05,22=2,26=0.01,27=0.01,28=0.1,29=0.1,8=0.2,30=0.00001,31=0.01,54=1 --maxe 40): inerte (cond start stop end) 3000 → 2998,01 en 100 ciclos (0,02/ciclo); nadador (40 .up por ciclo) 3000 → 2794,00 en 100 (2,06/ciclo); el buscador de más abajo 3000 → 2932,49 en 200 (0,34/ciclo) -->

## Las virtudes del campeón {#virtudes}

**Eficiencia antes que coraje.** Corrí un duelo suelto entre dos bots con
pedigree, _Russia_ y _Teriyaki_, en el campo de la liga: en 800 ciclos no se
cruzaron ni una vez (los dos cazan a la espera), pero a ese ritmo uno quedaba
con 2750 de energía y el otro con 580. Si la ronda llega al tope de ciclos y se
decide por energía, gana el que gastó menos. Y ojo con el detalle más
traicionero de la tabla: las comparaciones se cobran aunque el gen no dispare.
Un ADN con decenas de condiciones paga todas, todos los ciclos: _Russia_
dormida, sin hacer absolutamente nada, paga 0,31 por ciclo, casi todo en las
unas 65 comparaciones de sus condiciones.

<!-- probado (ajustes de la liga F1, campo 9237x6928): Russia_F1_League (qty 1) vs Teriyaki_F1 (otro), 800 ciclos: no se encuentran, Russia 3000 → 2747 (hibernando, 0,31/ciclo), Teriyaki 3000 → 584 (2,9/ciclo manteniendo 500 de toxina). Russia sola con 2500: 51=hibernate en 1, gasta 0,314/ciclo (65 tokens de comparación × 0,004 + un store de un gen que siempre corre + 0,02 de upkeep) -->

**Robustez: no depender de un solo canal.** Mi primer buscador tenía un solo
ojo y una lección gratis: cuando un pariente se le ponía delante, se quedaba
mirándolo para siempre. Veía algo (entonces no buscaba), pero no era comida
(entonces no lo cazaba): clavado, gastando sin avanzar. Los bots de torneo
reparten la mirada: _Russia_ usa ocho ojos bien abiertos para el perímetro y
uno fino de mira, así que ningún pariente distraído le tapa el mundo. La
versión mínima del arreglo es hacer que «no veo nada _o_ solo veo familia»
cuenten igual.

**Comportamiento social: no canibalizarse.** En la liga tus cinco bots
iniciales son tu equipo, y un equipo que se cobra entre sí pierde dos veces:
pierde la energía y pierde bots. La forma más barata de distinguir a los
suyos es la firma de [[.refeye]] contra [[.myeye]] (ver
[[tutoriales/reconoce-especie]]); _Russia_, _Teriyaki_ y el buscador de más
abajo la usan. Lo medí con tres copias de _Russia_ (200 ciclos) y dos del
buscador (400): cero bajas propias. Y hay un motivo extra: a un
conespecífico tu veneno y tu toxina no le hacen nada, así que morderlo es
gastar gratis ([[estrategias/defensivos]]). El contraejemplo es _Singula_,
de más abajo: drena a lo que mira sin preguntar, y su enjambre se lo cobra.

<!-- probado (ajustes de la liga F1, campo 1500x1000): Russia qty 3, nrg 2500, 200 ciclos, 3 vivos, kills 0 en todos; buscador qty 2, 400 ciclos, 2 vivos -->

**Saber rehusar una pelea.** Las reglas premian al que dura: la ronda la gana
la última especie en pie y, al tope de ciclos, la de más bots o más energía.
Pelear siempre no es una estrategia: cada disparo te cuesta 2, lo absorbe o no
el rival, y contra uno que absorbe tus golpes o te gana el intercambio, lo
único que hacés es financiarte tu propia derrota. Antes de morder, mirá cómo
viene equipado ([[.refshell]], [[.refpoison]], [[.refvenom]]): es lo que hace
_Paranoia_ para elegir a quién cazar ([[estrategias/defensivos]]). Y si el
intercambio no te conviene, no lo aceptés: alejarse cuesta lo mismo que
acercarse, y en el duelo de más arriba el bot que nunca peleó iba ganando.

<!-- competir.md #conceptos (ronda: la gana la última especie; al tope, más bots o más energía nrg + body×10); duelos medidos más arriba; Paranoia: defensivos.md (elige presa según .refshell/.refpoison) -->

## Tres con pedigree, verificados {#bestiario}

Los nombres del Bestiario con liga ganada se compran baratos: hay campeones de
verdad y bots que solo se llaman campeón. Estos tres corren y hacen lo que acá
se dice; cada corrida fue con los ajustes de la liga y sin mutaciones.
<!-- probar-adn.mjs con los ajustes de la liga F1 (opciones.js ajustesF1), sin mutaciones (el harness las trae apagadas); robots F1: Russia_F1_League_By_Spike43884_11-19-2014.txt, Teriyaki_F1_Spike43884_11-05-2014.txt, Singula_Haloculus_2_F1_bacillus_21.04.08.txt -->

### Russia duerme, Russia cobra {#russia}

_Russia_ (`Russia_F1_League_By_Spike43884_11-19-2014.txt`, de Spike43884, liga
Rusia 2014) es un cazador a la espera. Su firma es la hibernación: al nacer
(en el primer ciclo todos los sentidos leen 0) y siempre que no ve nada y anda
corto de energía se apaga entera y paga 0,31 por ciclo; despierta en cuanto un
ojo lateral ve algo. El gen que la apaga:

```adn
def hibernate 51

' Duermo si no veo nada (o si es familia) y ando corto de energia
cond
 *.eye1 0 =
 *.eye2 0 = and
 *.eye3 0 = and
 *.eye4 0 = and
 *.eye5 0 = and
 *.eye6 0 = and
 *.eye7 0 = and
 *.eye8 0 = and
 *.eye9 0 = and
 *.refeye *.myeye = or
 *.nrg 3000 < and
 *.hibernate 0 = and
start
 1 .hibernate store
stop
```

Cuando ve algo, caza con una mira fina y una periferia ancha, parándose al lado del
blanco y robándole la energía con [[.shoot]] en −1. Y al que lo muerde le
paga con veneno: la picadura le escribe 128 en el giro cada ciclo, así el
ladrón se pasa la vida girando en redondo en vez de seguir robando. Contra un
alga sola la vació en unos 20 ciclos y pasó de 3000 a más de 6000. Despierta
y ociosa vira al azar —girar es gratis— y cría recién con 20000: cada hijo es
una apuesta que solo paga con la despensa llena.

<!-- probado (ajustes de la liga F1, campo 1500x1000): Russia vs alga de arranque de la liga (engine/partido.js ALGA_ARRANQUE, nrg 3000): kills=1 al ciclo 20, 3000 → 6085 (los −2 de vuelta llegan un ciclo después de la muerte); re-corrido: kills=1 antes del 20, 3000 → 6055. Russia sola nrg 2500: hibernate=1, quieta, 0,314/ciclo en regimen (0,33 promediando el arranque); nrg 4000: duerme al nacer igual (el primer ciclo lee todo 0) y luego despierta, quieta, 0,354/ciclo. Trio: sin bajas -->

### Teriyaki escupe y no se deja morder {#teriyaki}

_Teriyaki_ (`Teriyaki_F1_Spike43884_11-05-2014.txt`, de Spike43884 con un
arreglo de Shadowgod2) es lo contrario: paga un sueldo por andar armado.
Mantiene 500 de toxina con un gen de dos líneas:

```adn
' No sabe a pollo: toxina mientras falte
cond
 *.poison 500 <
start
 50 .strpoison store
stop
```

Eso le cuesta unos 2,9 por ciclo (la toxina pierde el 2 % por ciclo, así que
reponer 500 es un gasto permanente), pero quien lo muerde recibe el golpe de
vuelta envenenado. Ataca mezclando −1 y −6: el −6 también le saca cuerpo, así
que de una sola alga que entró con 3000 y 1000 de cuerpo terminó sacando más
de 8000. A los parientes ricos les dispara esperma y cría sexual; y si se
pasa de 100 de desechos, se alivia disparándolos para atrás. Un bot completo,
con precio de bot completo: en el duelo con _Russia_ era el que se quedaba
seco.

<!-- probado (ajustes de la liga F1): Teriyaki sola: poison 0 → ~500 y oscila (505, 500, 497…, rearma a 539), 2,79-2,95/ciclo. Vs alga (campo 1500x1000): alga 3000/1000 → 261/447 y muerta al ~70; Teriyaki 3000 → 11069. El .txt tiene dos avisos del lint (.backshoot y -8!= pegado); los fragmentos citados están limpios -->

### Singula Haloculus 2: un gen y una bomba demográfica {#singula}

_Singula Haloculus 2_ (`Singula_Haloculus_2_F1_bacillus_21.04.08.txt`, de
bacillus, 2008) responde por qué a veces gana el más simple: es _un solo gen_,
siempre encendido, y ganaba ligas igual. Hace tres cosas a la vez. Cría sin
freno: pide un hijo con más de 200 de energía, y en 30 ciclos una sola copia
había sido doce. Mantiene el cuerpo chico, en un tercio de su energía, con la
línea más bonita del Bestiario:

```adn
' El cuerpo a un tercio de la energia: sobra, guardo; falta, devuelvo
cond
start
 *.nrg 3 div *.body sub dup .strbody store - .fdbody store
stop
```

Y se alimenta atando al que está mirando y chupándole 1000 por ciclo por el
lazo ([[.tieloc]] en −1, [[.tieval]] en −1000), sin preguntar de qué especie
es: en una corrida sin comida su propio enjambre se drenó entre sí hasta
quedar cuatro. La cereza: su disparo es de memoria, a la dirección de la
[[.shootval]] del otro, y le deja escrito −32000. Un cazador que cobra con −1
y tiene la .shootval rota se mata con su propio disparo: contra _Singula_ el
cazador del tutorial amaneció con la .shootval en −32000 y no llegó lejos; y
un cazador con la .shootval forzada a −32000 cayó él solo, con el alga de
blanco intacta. Por algo su encabezado dice que mata a los bots que se
alimentan a disparos.

<!-- probado (ajustes de la liga F1): Singula sola (campo 9237x6928): 1 → 12 bots al ciclo 30, se estabiliza en ~4 con cuerpo ~nrg/3. Vs cazador del tutorial (campo 1500x1000): el cazador amanece con shootval=-32000 y muere; Singula sobrevive. Cazador con --set shootval=-32000 contra un alga: el cazador muere solo antes del ciclo 25, el alga intacta. La línea del disparo usa floor=max(a,b) para elegir la dirección del store (spec 20-VM §6.4) -->

## Probalo antes de anotarlo {#prueba}

Acá va un bot de liga mínimo, completo, para partir: busca barato, caza lo que
no es de su especie, cría con la despensa llena y no se come a sus hermanos.

```adn
' Bot de liga minimo: caza algas y extranos, no toca a los suyos
cond
 *.robage 0 =
start
 100 .eye5width store
stop

' Cuando no veo nada (o solo veo familia): empujoncito barato
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 5 .up store
stop

' Veo a un extrano: me le acerco
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 *.refveldx .dx store
 *.refvelup 30 add .up store
stop

' Acompanado del blanco de cerca: le pido energia
cond
 *.eye5 50 >
 *.refeye *.myeye !=
start
 *.refveldx .dx store
 *.refvelup .up store
 -1 .shoot store
stop

' Con energia de sobra, hijos
cond
 *.nrg 5000 >
start
 50 .repro store
stop
end
```

Con los ajustes de la liga hace lo que promete: busca a 0,34 por ciclo
recorriendo el campo entero, vacía un alga en unos 60 ciclos y con lo ganado
tira su primer hijo, y dos copias juntas no se cruzan ni un golpe en 400
ciclos. Contra un cazador común del mismo estilo le banca el pulso: son
números y cría. Lo que no tiene son defensas: contra un bot armado no tiene
nada que decirle; para eso está [[estrategias/defensivos]].

<!-- probado (ajustes de la liga F1): solo (campo 9237x6928) 3000 → 2932,49 en 200 ciclos, cruza el campo de punta a punta. Vs alga (campo 1500x1000): kills=1 al ciclo 60, cría (padre 3444 + hijo 2658) y ambos siguen buscando. Qty 2: 400 ciclos, 2 vivos. Qty 3 vs 1 cazador del tutorial (campo 1500x1000): a los 200 ciclos el cazador en 1283 y los tres arriba, uno ya criado -->

Para las pruebas de verdad, en la app:

- **El escenario Partido F1** (en [[app/escenarios]]) te da el mundo de la liga
  con tres especies adentro: sembrá el tuyo al lado y mirá la energía en el
  inspector.
- **Experimentar** con la base **Liga F1** (y los costos **F1** del panel,
  [[app/experimentar]]) para tu propio banco de pruebas.
- **Competir**: un ⚡ partido rápido contra bots del Bestiario es el examen de
  ingreso. Si un resultado te raya, **↻ Repetir** lo corre con la misma
  semilla y **Repetir y analizar** lo abre como corrida en [[app/analizar]]
  para ver dónde se te fue la energía. Cómo se comportan las semillas, en
  [[tecnico/semillas]].

Y recordá la letra chica del reglamento: el ADN se congela al inscribirse, así
que inscribe la versión que quieras correr, no la que estás por arreglar.

## Qué probar después {#despues}

<!-- competir.md (#conceptos: el Elo histórico acumula de temporada en temporada); opciones.js F1_NOMBRADAS (mutations 0: la liga apaga las mutaciones) -->

- **Anotalo y mirá el Elo**: una temporada entera dice mucho más que un
  partido suelto, y el Elo histórico del torneo acumula de temporada en
  temporada ([[app/competir]]).
- **Evolucioná en tu taller, no en la liga**: la liga apaga las mutaciones y
  congela el ADN; la selección hacela vos en tu mundo, con tu criterio, y
  anotá al ganador ([[tutoriales/evolucion]]).
- **Ponle defensas**: en la liga, donde el que no puede ser mordido dura
  gratis, un caparazón o una toxina bien puestos se pagan solos
  ([[estrategias/defensivos]]).
- **Enfrentalo a un enjambre**: tu bot ordenado contra la bomba demográfica de
  siempre ([[estrategias/enjambres]]).
