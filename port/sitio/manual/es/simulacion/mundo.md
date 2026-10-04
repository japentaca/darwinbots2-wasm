---
titulo: El mundo
resumen: "El escenario donde viven los bots: el tamaño del campo, los bordes con paredes o conectados, los obstáculos y laberintos, los teleporters, la luz, la gravedad y las mareas, y los costos que valen para todos."
etiquetas: [mundo, campo, bordes, obstáculos, teleporters, costos]
estado: revisada
---
Los bots viven en un rectángulo plano. Todo lo que no es un bot (el tamaño de ese
rectángulo, lo que pasa en sus bordes, las paredes que haya adentro, la luz, la
gravedad, lo que cuesta cada acción) es parte del _mundo_, y se configura con los
parámetros de la app (ver [[app/experimentar]] y [[app/experimentar-avanzado]]).

Esta página recorre esas piezas. Las que tienen página propia (el sol y los
vegetales, la física fina) se cuentan acá solo lo necesario, con el enlace.

## El campo {#campo}
<!-- 50-MUNDO §1; engine/opciones.js base:fieldW/fieldH, dimensionesCampo; sysvars .xpos .depth -->

El campo mide [[param:base:fieldW]] por [[param:base:fieldH]]. El origen está
arriba a la izquierda: la coordenada horizontal crece hacia la derecha y la
vertical hacia abajo, y por eso el bot lee su altura como una profundidad, en
[[.depth]], y la horizontal en [[.xpos]].

La app ofrece los tamaños clásicos del original: el 1 es el campo de los torneos
F1, de 9237 × 6928, y del 2 al 12 crecen de a 8000 × 6000 (el 2 mide
16000 × 12000). También se puede poner cualquier medida a mano. El tamaño no se
puede cambiar en una simulación que ya está corriendo: hace falta una nueva.

Para tener una idea de la escala: con la velocidad máxima por defecto
([[param:opt:11]]), un bot avanza a lo sumo 40 unidades por ciclo, así que cruzar
un campo F1 le lleva más de doscientos ciclos.

## Los bordes {#bordes}
<!-- 30-FISICA §5 (bordercolls: ReSpawn toroidal del organismo, clamp + amortiguador); engine/opciones.js opt:1-3; probado: viajero.txt en 2000x1000, con y sin opt:3 -->

Cada par de bordes puede ser una pared o estar conectado:

- [[param:opt:3]]: lo que sale por la derecha entra por la izquierda, y al revés.
- [[param:opt:2]]: lo que sale por abajo entra por arriba, y al revés.
- [[param:opt:1]] es el atajo para conectar los dos pares a la vez: un mundo
  _toroidal_, sin bordes.

Contra una pared, el bot no rebota: queda apoyado en el borde, frenado, y
[[.edge]] se enciende. En un borde conectado, en cambio, reaparece del otro lado
con la misma velocidad. Si es un multibot (ver [[simulacion/lazos]]), cruza el
organismo entero de una vez, sin que se estiren los lazos. Los detalles del
choque contra la pared están en [[simulacion/fisica#bordes]].

Este bot mira a la derecha al nacer y avanza siempre:

```adn
' Mira a la derecha y avanza siempre
cond
 *.robage 0 =
start
 0 .setaim store
stop
cond
start
 10 .up store
stop
end
```

En un campo de 2000 de ancho con paredes, llega a la derecha en el ciclo 33 y
se queda ahí, con `.edge` en 1. Con los lados conectados, en el ciclo 36 ya está
cerca del borde izquierdo y sigue viaje.

## Obstáculos y laberintos {#obstaculos}
<!-- 50-MUNDO §4; 30-FISICA §4.4; core physics.hpp TrashCompactorMove; wasm db_sim_maze_polar_ice; engine/escenarios/index.js (objetos); i18n experimentar.objetos.* -->

Los obstáculos (también llamados _formas_) son rectángulos fijos dentro del campo.
En Experimentar, «Objetos del mundo», se agregan de tres maneras: un obstáculo
suelto, tandas de diez al azar, o un laberinto. Se ubican con la semilla de la
simulación, así que la misma semilla da el mismo mapa, y cambiarlos pide una
simulación nueva.

Los laberintos son seis; en los de filas y en la espiral se eligen el ancho del
pasillo y el de la pared, y en el damero, el del pasillo:

| Laberinto | Cómo es |
|---|---|
| horizontal, vertical | Filas de paredes, cada una con una abertura al azar. |
| espiral | Anillos rectangulares uno dentro del otro, con las bocas corridas. |
| damero | Una cuadrícula de bloques cuadrados en el centro del campo. |
| polar | Nueve bloques grandes, uno encima del otro en el centro, que se separan a la deriva (el laberinto enciende la deriva). |
| escombros | Dos paredes desde los costados. Si [[param:opt:85]] es mayor que 0 al crearlas, avanzan, se cruzan y vuelven; con el valor de fábrica (0) quedan quietas. |

Un bot que choca con un obstáculo es empujado hacia afuera por el lado más cercano
y siente el golpe en [[.hit]] y sus direcciones. Si un bot queda apretado entre
tres a la vez, el motor lo hace saltar para destrabarlo.

Lo demás se configura:

| Parámetro | Qué cambia |
|---|---|
| [[param:opt:80]] | Los ojos detectan los obstáculos. Si no, son invisibles: el bot solo se entera al chocar. Ver [[simulacion/vision]]. |
| [[param:opt:81]] | Se ve a través de ellos. |
| [[param:opt:82]] | Los disparos que los tocan desaparecen (si no, rebotan). |
| [[param:opt:84]], [[param:opt:83]], [[param:opt:85]] | Los obstáculos se desplazan solos, de lado o de arriba abajo. |

Cuando lo más cercano que ve el ojo con foco es un obstáculo, [[.reftype]] vale 1,
y eso lo distingue de otro bot.

## Teleporters {#teleporters}
<!-- 50-MUNDO §3 (local: ReSpawn del organismo, 2 RNG); engine/sim.js case 'teleporter' (ancho 300, vegetales, cadáveres y heterótrofos); escenarios TOPE_TELEPORTERS = 10; web2/PLAN.md C22 -->

Un teleporter es un círculo que manda a otra parte lo que lo toca. En la app son
_locales_: el bot que entra (sea animal, vegetal o cadáver) reaparece en un punto
al azar del campo, y si es un multibot viaja el organismo entero. Se pueden poner
hasta diez, en lugares al azar con la semilla.

Sirven, por ejemplo, para mezclar poblaciones que un laberinto mantendría
separadas.

:::nota
El original tenía además teleporters que mandaban bots a otra computadora por
Internet, y que los recibían. Esta app no los trae todavía.
:::

## La luz {#luz}
<!-- 50-MUNDO §2.2 (feedvegs: día/noche, umbrales, banda móvil, estanque); core vegs.hpp (reloj CycleLength); probado: quieto.txt con opt:33=1, opt:34=5 -->

La energía entra al mundo por el sol, que alimenta a los bots con cloroplastos.
Cómo comen está en [[simulacion/cloroplastos]]; lo que el mundo decide es cuándo
y dónde hay luz:

- **Día y noche.** Con [[param:opt:33]], el sol se apaga y se prende. Cada mitad
  dura un ciclo más que [[param:opt:34]]: con 5, seis ciclos de día y seis de
  noche. Los bots lo leen en [[.daytime]].
- **Sol al azar.** Con [[param:opt:40]], la luz cae en una franja vertical que se
  corre de a poco y cambia de rumbo de vez en cuando. Fuera de la franja no se
  come.
- **Umbrales de energía.** [[param:opt:35]] y [[param:opt:37]] prenden o apagan
  el sol según la energía total del mundo (los umbrales son [[param:opt:36]] y
  [[param:opt:38]]), y [[param:opt:39]] dice si eso vale por un ciclo, para
  siempre o si adelanta el reloj del día.
- **Estanque.** Con [[param:opt:30]], la luz llega con [[param:opt:31]] arriba y
  se debilita con la profundidad, según [[param:opt:32]].

## Gravedad, estanque y mareas {#gravedad}
<!-- 30-FISICA §2 (GravityForces, flotabilidad); core physics.hpp GravityForces; core robots.hpp mareas (BouyancyScaling pisa Ygravity y PhysBrown); vegs.hpp (acttok × (1 − BouyancyScaling)); probado: boya.txt (opt:30=1, opt:20=0.05) y quieto.txt con opt:64=100 -->

[[param:opt:20]] tira de cada bot hacia abajo con una fuerza proporcional a su
masa ([[.mass]]). Es la que hace del campo un estanque con fondo. La otra,
[[param:opt:19]], no mueve a nadie: aprieta a los bots contra el «suelo» y así
activa el rozamiento (ver [[simulacion/fisica]]).

En modo estanque, con gravedad y con los bordes de arriba y abajo sin conectar, los
bots pueden flotar. Cada uno tiene una flotabilidad entre 0 y 1, que ajusta con
[[.setboy]] y lee en [[.rdboy]]: el motor lo empuja hacia arriba o hacia abajo
para llevarlo a la altura que le corresponde. Con flotabilidad 0 se hunde hasta el
fondo, con 1 sube hasta la superficie y con 0,5 busca la mitad del estanque.
Mantenerse a flote cobra energía como el movimiento ([[param:cost:20]]).

```adn
' Al nacer fija su flotabilidad en la mitad
cond
 *.robage 0 =
start
 16000 .setboy store
stop
end
```

En un estanque de 2000 de alto, sin rozamiento, este bot sembrado a 731 de
profundidad baja, pasa la mitad y vuelve: oscila alrededor de 1000. _B-Alpha
Pond_, del Bestiario, hace lo contrario: al nacer escribe −50 en `.setboy`, se
hunde, y se fija con [[.fixpos]] al pasar los 6500 de profundidad.

**Las mareas** ([[param:opt:64]]) hacen oscilar el mundo con el período que les
pongas, en ciclos. En una parte del período la gravedad sube (hasta 4) y el sol
alimenta a pleno; en la otra la gravedad cae casi a 0, el agua se agita
(movimiento browniano) y los vegetales casi no comen.

:::cuidado
Mientras hay mareas, el motor reescribe la gravedad y el movimiento browniano
([[param:opt:13]]) en cada ciclo: lo que pongas en esos parámetros no se usa. Y si
las apagás, quedan con el último valor que les dio la marea.
:::

## Los costos {#costos}
<!-- 31-ENERGIA §0.5 (COSTMULTIPLIER escala todo); 10-CICLO §2 pasos 6-7; core master.hpp DynamicCostsStep -->

Lo que cuesta cada cosa también es del mundo, igual para todos los bots: ejecutar
instrucciones, moverse, disparar, tener cuerpo o un ADN largo, fabricar defensas,
reproducirse. Son los parámetros de costos (como [[param:cost:7]] o
[[param:cost:23]]); vienen en 0, salvo que elijas una base que los fije, como la
de los torneos F1. Qué cobra cada uno y en qué momento está en
[[simulacion/energia]] y en [[adn/ejecucion]].

Todos se multiplican por [[param:cost:54]]: con 0 todo es gratis, con 2 todo cuesta
el doble. Con [[param:cost:56]] ese multiplicador se ajusta solo, subiendo cuando
sobran bots y bajando cuando faltan, para acercar la población a
[[param:cost:53]]; y aparte hay un freno que pone todo gratis cuando quedan muy
pocos bots ([[param:cost:52]]). Cómo funcionan los dos está en
[[simulacion/ciclo#costos-dinamicos]].

## Torneos y otros modos {#modos}
<!-- 50-MUNDO §5 (capa de torneo ⚙) -->

El original traía además reglas para concursos: rondas que se reinician cuando no
quedan animales ([[param:opt:90]]), el modo F1 de especies que compiten hasta que
gana una ([[param:opt:91]]) o la descalificación de las especies que hacen algo
prohibido ([[param:opt:93]]). Están en la app, pero lo normal es usarlas desde
Competir (ver [[app/competir]]), que arma los partidos y lleva la cuenta.
