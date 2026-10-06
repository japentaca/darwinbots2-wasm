---
titulo: Semillas y reproducibilidad
resumen: "Qué es la semilla de una simulación, cuándo dos corridas son idénticas, cuándo son válidas pero no idénticas, y cuántos mundos distintos hay de verdad."
etiquetas: [semilla, reproducibilidad, azar, mundos, réplicas]
estado: revisada
---
Muchas páginas del manual te mandan acá con la misma promesa: «misma semilla,
misma simulación». Esta página la cumple y agrega lo que suele quedar en el
camino: qué es exactamente esa semilla, qué _no_ se repite nunca aunque
quieras, y por qué dos semillas distintas pueden dar el mismo mundo.

## Qué es la semilla {#que-es}

La semilla es el número que arranca el generador de azar del mundo. El motor no
tira dados: usa un generador de números pseudoaleatorios, una máquina que
produce una secuencia larguísima de números que _parece_ azar pero es pura
matemática. La semilla es el punto de esa secuencia donde arranca.

Todo lo que el motor sortea sale de esa única secuencia, en orden: dónde nace
cada bot sembrado, dónde caen los obstáculos y teleporters del escenario, qué
mutación sale en cada parto, dónde reaparecen los vegetales que repuebla el
motor, y los sorteos de cada fase del ciclo (ver [[simulacion/ciclo]]). Como
todo sale de la misma secuencia en el mismo orden, cambiar el punto de partida
cambia toda la historia.
<!-- core rng.hpp (VbRng: LCG de 24 bits, la única fuente de azar del motor); spec OPEN_QUESTIONS Q01 (inventario de consumos: siembra, formas, repoblación, browniano, mutaciones, disparos…); wasm/dbcore_api.cpp db_sim_start (Rnd -1 : Randomize CLng(semilla)/100 en cada arranque) -->

De ahí la regla que leíste en todos lados: **el mismo escenario, con el mismo
ADN en cada especie, y la misma semilla dan la misma simulación, ciclo a
ciclo**. No «parecida»: idéntica. Mismas posiciones, misma energía, mismos
nacimientos y muertes en los mismos ciclos.
<!-- verificado: probar-adn.mjs, ADN con rnd y movimiento, --qty 4 --ciclos 40 --cada 10, semilla 7 dos veces → salida byte a byte igual; semilla 8 → distinta (scratchpad c8-semillas/s7a-s7b-s8) -->

En la app la semilla es un entero entre 1 y 2147483646. Se elige al lanzar la
simulación, en la columna derecha de [[app/experimentar]], con un dado (🎲,
**Otra semilla al azar**) por si querés sortear una; el escenario no la guarda
(ver [[app/escenarios]]). Otros lugares donde aparece:

- **cada partido de un torneo** lleva la suya, anotada en la pestaña
  **Partidos** de [[app/competir]], y es la que reusa **↻ Repetir**;
- **la primera réplica** de un trabajo de réplicas usa la de la corrida de
  origen, para repetirla (ver [[app/analizar#comparar]]);
- **la prueba de un bot** (**Probar**, en el editor) corre varias semillas y,
  con la misma primera, da siempre lo mismo (ver [[app/editor#probar]]).
<!-- web2/src/lib/experimentar/borrador.js (SEMILLA_MAX 2147483646, parsearSemilla, semillaAleatoria); i18n experimentar.semilla.ayuda, experimentar.error.semilla; engine/replicas.js semillasReplicas (la primera es la de la corrida); lib/trabajos/prueba.js -->

## Cuándo dos corridas son idénticas {#identicas}

La lista completa de lo que tiene que coincidir es corta:

| Tiene que coincidir | Qué abarca |
|---|---|
| El escenario | Parámetros del mundo, especies (cuáles, cuántas, con qué color), objetos. |
| El ADN | El de cada especie: si el escenario referencia un bot por nombre, el mismo bot; el Bestiario es el mismo para todos. |
| La semilla | El punto de partida del azar. |
| La versión del motor | Entre versiones de la app puede cambiar algún detalle del motor y con él la corrida. |

<!-- engine/escenarios/index.js aplicar (escenario + semilla = mensajes que arman el mundo); PLAN.md C15 (reset limpio: «escenario + semilla» da la misma corrida en cualquier worker; colores de formas nuevas desde un generador sembrado con la semilla) -->

Si las cuatro coinciden, las dos corridas son la misma, y no importa dónde:
la misma configuración en cualquier navegador, en tu máquina o en la de un
amigo, arranca el mismo mundo y sigue el mismo camino.

Los cambios que le hacés a una simulación en caliente no rompen nada: quedan
registrados con el ciclo en que entraron y se guardan con la corrida. Por eso
una réplica puede repetir tu corrida entera, aplicando cada cambio en su mismo
ciclo (ver [[app/experimentar#aplicar]]).

## Válidas pero no idénticas: retomar {#retomar}

Hay un caso en el que una corrida sigue siendo válida pero **no** idéntica a
como habría seguido: retomar una corrida guardada, o cargar un `.dbsim`.

El archivo guarda el mundo (bots, posiciones, energía, lazos, los disparos en
vuelo), pero no la posición exacta del generador de azar. Al cargar, la app
vuelve a sembrar el azar con la semilla de la corrida, como si la secuencia
empezara de nuevo. A partir de ahí todo es legal: los sorteos siguen saliendo
bien, pero de otro lugar de la secuencia, así que el futuro no es el que habría
tenido la corrida si nunca la hubieras guardado. Es el comportamiento del
original y de la [[app/clasica|interfaz clásica]], no un defecto del port.
La historia de métricas, los eventos y el linaje tampoco van adentro del
archivo: quedan con la corrida guardada en el navegador
([[tecnico/formatos#dbsim-carga]]).
<!-- wasm/dbcore_api.cpp db_sim_load (post-carga: Rnd -1 : Randomize UserSeedNumber/100, incondicional; la semilla es la del archivo); PLAN.md C17 -->

Lo que sí está garantizado: **el mismo archivo cargado en cualquier navegador
sigue igual**. La carga es siempre la misma, así que tu corrida retomada acá y
en otra máquina toma el mismo camino. El ADN de una especie que el archivo no
traiga se repone buscando el bot por su nombre, y los pocos ajustes que el
formato no guarda se reescriben siempre con el mismo valor. Los bots del
Bestiario están en cualquier navegador; los tuyos, exportalos antes (ver
[[app/tus-datos]]).
<!-- PLAN.md C17 (dna-missing repone el ADN; StartChlr y opciones 92–101 se reescriben); lib/sim/corrida-nucleo.js (#resolverAdn por nombre) -->

En la práctica: para seguir mañana donde la dejaste, retomá tranquilo
([[app/inicio]]). Para que otro repita tu corrida desde el arranque, no le pases
el `.dbsim`: pasale el escenario exportado y la semilla (ver las recetas de
abajo). Cómo se guarda una corrida y qué trae el archivo está en
[[app/observar#guardar]] y [[tecnico/formatos]].

## Cuántos mundos hay de verdad {#mundos}

La pregunta incómoda: con 2.147.483.646 semillas para elegir, ¿cuántos mundos
distintos puede darte el motor? La respuesta: **65.536**.

El generador tiene un estado interno de 24 bits (16.777.216 valores), pero al
arrancar una simulación solo 16 de esos bits salen de la semilla: el motor
siembra el azar dividiendo la semilla por 100 y mezclando los bits del
resultado, y de esa mezcla sobreviven 16 bits. Es una herencia del original
que el port reproduce bit a bit. Con 65.536 mundos, cada uno lo comparten en
promedio unas 32.768 semillas.
<!-- core rng.hpp (Randomize n reemplaza solo los bytes medios del estado; el byte bajo sobrevive); wasm/dbcore_api.cpp db_sim_start (Randomize semilla/100); spec OPEN_QUESTIONS Q02 y 70-CASOS-DORADOS R-01 (algoritmo, caso 1234 → EE3C); PLAN.md C19; verificado: engine/replicas.js estadoSemilla replica la mezcla (test: 3.017/3.017 semillas) -->

Que dos semillas «distintas» den el mismo mundo no es raro: entre las primeras
20.000 semillas hay 473 que repiten el mundo de otra. Algunos pares,
comprobados corriendo el motor: **12345 y 73151** dan exactamente la misma
corrida; también **1234 y 66184**, y **49 y 807**. La 12346, en cambio, da
otro mundo. Dos semillas gemelas no son «parecidas»: son el mismo mundo, y si
las comparás vas a comparar una corrida consigo misma.
<!-- verificado: scratchpad c8-semillas/t-semillas.mjs (estadoSemilla de engine/replicas.js: 12345 y 73151, 1234 y 66184, 49 y 807 comparten mezcla; 1..20000: 473 repetidas) y probar-adn.mjs con semillas 49 y 807 → salida byte a byte igual; 50 → distinta; re-corrido por el revisor: t-semillas.mjs de nuevo (mismos pares, período 2^24) y probar-adn con 49/807/50 (49 y 807 idénticas byte a byte) -->

Dentro de una corrida, el generador recorre sus 16.777.216 estados antes de
repetir la primera extracción; como una simulación con población consume
miles de extracciones por ciclo, la secuencia no se te va a acabar.
<!-- verificado: scratchpad c8-semillas/t-semillas.mjs (ciclo del LCG desde el estado de la semilla 12345: 16.777.216 pasos = 2^24, período completo); re-corrido por el revisor: idéntico (16.777.216 extracciones hasta volver al estado inicial) -->

La app conoce el asunto y te cubre:

- las **réplicas y el barrido descartan** las semillas que repetirían un mundo
  ya usado, para que la banda y el desvío no salgan más angostos de lo que son
  (ver [[app/analizar#comparar]]);
- el **informe de comparación avisa** cuando las dos corridas que comparás
  arrancan del mismo mundo (ver [[app/informes#comparacion]]);
- si elegís semillas a mano, no alcanza con que sean distintos números: en un
  trabajo de 64 réplicas, un 3,5 % repetía algún mundo sin que se note.
<!-- engine/replicas.js semillasReplicas (descarta misma mezcla); engine/report/textos.es.json cmp.mismoMundo; PLAN.md C19 (3,5 % de trabajos de 64 réplicas repetían un mundo) -->

## Lo que garantiza la app {#garantias}

- **Escenario + semilla dan la misma corrida en cualquier navegador y en
  cualquier hilo de ejecución.** Una réplica interrumpida se reinicia desde
  cero y da lo mismo; una corrida larga no depende de la máquina.
- **Cada partido de torneo lleva su semilla**, así que la ronda en segundo
  plano da el mismo resultado que jugarla mirando, y **↻ Repetir** avisa si
  algo no coincide (ver [[app/competir#tabla]]).
- **Todo lo que registra una corrida viaja con su semilla**: la corrida
  guardada, el informe, el JSON de datos, el de réplicas (con la semilla de
  cada una) y el de torneo. Lo que contás lo puede verificar cualquiera con el
  escenario, la semilla y la misma versión de la app.
- **El mismo `.dbsim` cargado en cualquier lado sigue igual.**
<!-- PLAN.md C15, C17, C19 y decisión 23; engine/report/textos.es.json rep.c19 (el informe de réplicas cuenta las descartadas); i18n competir.partidos.ayuda -->

## Recetas {#recetas}
<!-- app/experimentar (Nueva simulación, Semilla, aplicar en caliente), app/analizar#comparar (Réplicas, barrido con Semillas por valor), app/competir#tabla (↻ Repetir), app/observar#guardar (Descargar .dbsim), app/informes#comparacion (aviso de mismo mundo) -->

| Querés | Hacé |
|---|---|
| Repetir exacto una corrida | En [[app/experimentar]], abrí el mismo escenario, escribí la misma **Semilla** y tocá **Nueva simulación**. Si la corrida tenía cambios en caliente, usá **Réplicas** en [[app/analizar#comparar]]: la primera repite la corrida entera, con sus cambios en el mismo ciclo. |
| Repetir un partido | En [[app/competir]], pestaña **Partidos**, **↻ Repetir**: mismas reglas, participantes, orden de siembra y semilla. |
| Comparar mundos | **Réplicas** en [[app/analizar#comparar]]: hasta 64 corridas del mismo escenario con semillas que no repiten mundo, con media, banda y desvío. Para dos corridas sueltas, mirá si el informe avisa que las semillas dan el mismo mundo. |
| Compartir tu corrida | Para que otro la siga desde donde la dejaste: **Guardar** → **Descargar .dbsim** en [[app/observar#guardar]]. Para que la repita exacta desde el arranque: **Exportar** el escenario y pasale también la semilla. |
| Probar si un resultado fue suerte | Corré varias semillas: réplicas, o el barrido de un parámetro con **Semillas por valor**. Si en la mayoría gana lo mismo, no fue suerte. |

Las dudas comunes sobre repetir están en [[empezar/preguntas#repetir]]. Y si te
preguntás cómo se logra que la secuencia de azar del programa original salga
igual en un navegador de hoy, esa historia está en [[tecnico/como-esta-hecho]]
y en [[tecnico/diferencias]].
