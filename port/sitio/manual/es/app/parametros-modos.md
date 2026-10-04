---
titulo: "Parámetros: Modos de juego (F1 / rondas)"
resumen: "Las reglas de concurso del original: rondas que se reinician, el modo F1 en que las especies compiten hasta que gana una, los topes de ciclos y de población y la descalificación."
etiquetas: [F1, rondas, concurso, descalificación, torneos, parámetros]
estado: revisada
---
<!-- opciones.js «Modos de juego (F1 / rondas)»; core gamemodes.hpp (FindSpecies, Countpop), robots.hpp:2105 (Restart), sim.hpp DisqualifyAction; web2/engine/sim.js newRound/checkGameState; 50-MUNDO §5; port/README «Ajustes F1» y «Torneos» -->

Este grupo trae las reglas con las que el DarwinBots original hacía competir
especies: una simulación que se juega por **rondas**, cada una la gana la última
especie que queda en pie, y un concurso que termina cuando una especie juntó
suficientes victorias. Es el _modo F1_, el de las ligas de bots.

En la app, lo normal es no tocar nada de esto y competir desde **Competir** (ver
[[app/competir]]): ahí se arman los partidos, se fijan estos valores en cada uno y
se lleva la tabla. Este grupo sirve para armar a mano, desde Experimentar, un
concurso o una simulación que se reinicia sola.

## Qué es una ronda {#ronda}
<!-- web2/engine/sim.js newRound: semilla nueva (roundSeed), mismas especies, opciones de la sim que termina (ROUND_OPT_IDS + costos 0..70), 90-101 restaurados; objetos según PP-03; resetSim → db_sim_round_carry (TotRunCycle y repoblación siguen, RV-33/RV-35); gamemodes.hpp Countpop pone TotRunCycle = 0 al abrir la ronda F1 -->

Cuando una ronda termina, la app rearma el mundo desde cero con una semilla
nueva: vuelve a sembrar las especies del principio, con la cantidad y la energía
del escenario. Las opciones pasan tal como estaban al terminar la ronda, incluidos
los cambios que hizo la propia simulación (por ejemplo, el multiplicador que movió
el ajuste de [[app/parametros-costos-dinamicos]]). Lo que pasó en la ronda
anterior no se hereda: ni bots, ni mutaciones, ni energía. El contador de ciclos
vuelve a 0 en las rondas del concurso F1; en las de [[param:opt:90]] sigue
contando desde donde estaba.

Hay dos formas de que empiece una ronda nueva: con [[param:opt:90]], cuando se
extinguen los animales, o con el [[param:opt:91|modo F1]].

## Cómo se decide un concurso F1 {#f1}
<!-- gamemodes.hpp Countpop: censo cada SampFreq = 10 ciclos; SpeciesLeft == 1 → Wins + 1; Maxrounds; Wins > Sqr(MinRounds) + MinRounds/2 al llegar a MinRounds, si no MinRounds + 1; i18n/es/competir.json competir.regla.* -->

Con el modo F1 encendido, al arrancar la simulación el motor anota las especies
que no son vegetales, y cada 10 ciclos cuenta cuántos bots le quedan a cada una.
Cuando queda una sola, esa especie gana la ronda y empieza otra. El concurso
termina de una de dos maneras:

1. **Por tope de victorias.** Si [[param:opt:98|el tope de rondas ganadas]] es mayor que 0, la primera
   especie que gana esa cantidad de rondas se lleva el concurso enseguida.
2. **Por margen.** Al completarse [[param:opt:97|las rondas mínimas]] (llamemos N a ese
   número), gana la especie que tenga **más de √N + N/2** victorias. Si ninguna
   llega, es un empate estadístico y se juega una ronda más, con la misma cuenta
   para N + 1.

La regla del margen es exigente a propósito: con N = 5 hacen falta las 5
victorias; con N = 8, 7 de 8; con N = 10, 9 de 10. Con N menor que 5 ni ganándolas
todas alcanza, así que, salvo que alguien llegue antes al tope de victorias, el
concurso dura al menos 5 rondas. Un 4 a 1 en 5 rondas
se sigue jugando, y se define recién en la octava si el que va ganando gana las
tres que siguen.

Cuando hay un ganador, la simulación se detiene en el mundo final.

:::parametro opt:90
<!-- robots.hpp:2105: totnvegs == 0 && Restart && !F1 → StartAnotherRound -->
Si se acaban los bots que no son vegetales, la app empieza una ronda nueva con
semilla nueva y las mismas especies del principio. Sirve para dejar corriendo
una búsqueda larga: si una semilla sale mal y los animales se extinguen, se
prueba con otra sin que tengas que reiniciar a mano. Con [[param:opt:91]]
encendido no hace nada, porque el concurso maneja sus propias rondas.
:::

:::parametro opt:91
<!-- gamemodes.hpp FindSpecies (al arrancar si ContestMode; una sola especie → se apaga; más de 2 con topes → 99 y 100 a 0) -->
Enciende el concurso por rondas descripto arriba. Necesita al menos dos especies
que no sean vegetales: con una sola, el motor apaga el modo. El
concurso se arma al empezar una simulación nueva; encenderlo en una simulación que
ya corre no lo pone en marcha (lo dice la nota de la ficha). Las especies se
distinguen por su nombre, así que dos especies con el mismo nombre cuentan como
una. Con las reglas F1 los costos suelen estar encendidos
([[app/parametros-costos#atajos]]), pero este modo no los toca.
:::

:::parametro opt:97
<!-- set_opt 97 escribe MinRounds y optMinRounds; Countpop: MinRounds + 1 en empate -->
Las rondas tras las cuales se mira si alguien ganó por margen (la N de la regla
√N + N/2). De fábrica vale 5, el mínimo con el que la regla se puede cumplir. Más
rondas hacen el resultado más confiable, porque una especie con suerte en una
semilla no alcanza. Cada empate estadístico le suma 1 durante el concurso.
Escribirlo escribe también [[param:opt:101]].
:::

:::parametro opt:98
<!-- Countpop: Wins > Maxrounds − 1 → ganador, en cada censo -->
Si es mayor que 0, la primera especie que gana esta cantidad de rondas se lleva
el concurso, sin esperar a la regla del margen. Con 0 (de fábrica) solo cuenta el
margen. Es útil con tres o más especies, donde llegar al margen puede llevar
muchas rondas.
:::

:::parametro opt:99
<!-- Countpop: optMaxCycles; TotRunCycle > tope → mata a la especie con menos bots (solo PopArray 1 y 2); extensión adaptativa cada 1000 ciclos; FindSpecies: > 2 especies → 0 -->
Un tope de ciclos por ronda, pensado para duelos: cuando la ronda pasa de esta
cantidad de ciclos, la especie con menos bots muere entera y la otra gana la
ronda. Si están empatadas, no pasa nada. El tope puede estirarse solo: cada 1000
ciclos, si la especie que va perdiendo viene creciendo más rápido que la otra, el
motor le da más tiempo. Con más de dos especies el motor lo apaga al empezar.
Los partidos de Competir no lo usan: tienen su propio tope, que
sirve para cualquier cantidad de especies.
:::

:::parametro opt:100
<!-- Countpop: si pop1 o pop2 > MaxPop, mata a los de menos nrg + body×10 de las dos, en proporción -->
Otro control para duelos: si una de las dos especies pasa de esta cantidad de
bots, el motor mata a los más débiles (los de menos energía, contando el cuerpo)
de las dos, en proporción: la que se pasó queda por debajo del tope y la otra
pierde la misma fracción. Evita que un duelo se trabe con miles de bots. Con más
de dos especies se apaga al empezar, como [[param:opt:99|el tope de ciclos]].
:::

:::parametro opt:93
<!-- sim.hpp DisqualifyAction (== 2); ties.hpp give/take nrg/body a otra especie (== 1); shots.hpp newshot −7 al fabricar el virus (1 o 2), info shot (2); robots.hpp mkshell/slime/venom/poison, maketie, sexual, delgene (2); dreason mata a la especie; solo con F1 (o x_restartmode 1) -->
Prohíbe ciertas acciones durante el concurso. La especie que hace una acción
prohibida queda **descalificada**: todos sus bots mueren en el acto. Solo actúa
con [[param:opt:91]] encendido, o con [[param:opt:92]] en 1 (el modo de siembra
de [[app/parametros-evolucion]]).

| Nivel | Descalifica a la especie que… |
|---|---|
| 1 | fabrica un virus ([[.mkvirus]]), o pasa energía o cuerpo a un bot de otra especie por un lazo, o se los saca |
| 2 | fabrica un virus, caparazón, baba, veneno o toxina; ata con [[.tie]]; dispara a la memoria de otro (un disparo positivo); intenta la reproducción sexual ([[.sexrepro]]); o borra un gen ([[.delgene]]) |

El nivel 2 no repite la regla de los lazos del 1, pero como prohíbe atar, solo
quedan los lazos de nacimiento, que unen a bots de la misma especie. Sirve para
torneos de bots "limpios", que compiten solo comiendo y moviéndose.
:::

:::parametro opt:101
<!-- gamemodes.hpp declareWinner: if x_restartmode == 0 → MinRounds = optMinRounds -->
El valor al que vuelven las [[param:opt:97]] cuando un concurso termina, ya que
los empates estadísticos las van subiendo. Como escribir las rondas mínimas lo
escribe también, casi nunca hace falta tocarlo aparte.
:::
