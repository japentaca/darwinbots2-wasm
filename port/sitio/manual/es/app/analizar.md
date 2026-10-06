---
titulo: Analizar
resumen: "La pantalla para entender qué pasó en una corrida: gráficos de un catálogo de métricas, hallazgos automáticos, especies, árbol de parentesco, genética, eventos y comparaciones entre corridas."
etiquetas: [analizar, gráficos, especies, filogenia, genética, comparar]
estado: revisada
---
Observar te muestra el mundo ciclo a ciclo; **Analizar** te muestra la película
entera. Mientras una corrida avanza, la app toma una _muestra_ cada 100 ciclos:
cuántos bots hay de cada especie, cuánta energía tienen, qué largo tiene su ADN,
cuántas veces dispararon, quién es hijo de quién. Analizar dibuja todo eso y te
ayuda a encontrar lo interesante.

Se abre desde **Analizar** en la barra de arriba. Tiene siete pestañas:
**Panel**, **Especies**, **Filogenia**, **Genética**, **Eventos**, **Comparar** e
**Informes**. Las primeras cinco miran una sola corrida; las dos últimas trabajan
con varias.

## Qué corrida estás mirando {#corrida}
<!-- web2/src/screens/Analizar.svelte; lib/analizar/fuente.js; i18n/es/analizar.json (analizar.corrida, meta.*, rango.*, sinCorrida, sinHistoria); lib/sim/metricas.js MUESTREO_CORRIDA (cada 100, dominante 10) -->

Arriba a la derecha, el selector **Corrida** ofrece:

- **La corrida actual (en vivo)**: la que está corriendo en Observar. Los gráficos
  se actualizan solos, como mucho una vez por segundo.
- Cada **corrida guardada** en este navegador, con su nombre y su último ciclo. Se
  abre en _solo lectura_: Analizar lee la historia que se guardó con ella, sin
  cargar la simulación ni tocar la que esté corriendo.

Para tener una corrida guardada, usá **Guardar** en Observar (ver
[[app/observar]]). La app conserva las últimas 20 corridas (ver
[[app/tus-datos]]).

Debajo del título, una línea resume la corrida: si es la actual o una guardada,
el ciclo al que llegó, su semilla y cada cuántos ciclos se tomó la muestra. Si
todavía no hay muestras, la app te avisa en qué ciclo llega la primera; si no
hay ninguna corrida en curso, te ofrece **Ir a Observar**.

Al lado está el **Rango de ciclos**: **Todo**, **Últimos 10k** o **Últimos 1k**.
Recorta a la vez los gráficos del Panel, de Especies y de Eventos, así quedan
alineados entre sí.

La dirección de la página guarda la corrida y la pestaña elegidas: si recargás o
copiás el enlace, volvés al mismo lugar. Con el foco en las pestañas, las flechas
izquierda y derecha pasan de una a otra.

### Cómo se guarda la historia {#historia}
<!-- web2/engine/history.js (cabecera); PLAN.md decisión 8 y C21; i18n analizar.panel.nota (banda clara del mínimo al máximo) -->

Una corrida larga junta muchísimas muestras. Para que la historia no pase de unos
5 MB, cuando se llena la app _funde_ los puntos viejos de a dos: el punto nuevo
guarda la media de las muestras que junta, y también su mínimo y su máximo. Por
eso, en los tramos viejos de una corrida larga, cada punto de un gráfico vale
por varias muestras y lleva una **banda clara** que va del mínimo al máximo. La
última muestra nunca se funde.

Los eventos (extinciones, siembras, cambios en caliente…) y el linaje se guardan
aparte y no se funden.

## Panel {#panel}
<!-- web2/src/lib/analizar/Panel.svelte; catalogo.js (PANEL_POR_DEFECTO, seriesDe: maxEspecies 8, «Otras» en apilados); grafico/Grafico.svelte (tooltip, marca, banda); i18n analizar.panel.*, analizar.grupo.*, analizar.m.* -->

El Panel muestra cuatro gráficos. De fábrica son los bots vivos por especie, los
nacimientos por especie, la longitud media del ADN por especie y la energía
total. Cada uno tiene un botón **Cambiar** que abre el **Catálogo de gráficos**:
un centenar de métricas repartidas en seis grupos.

| Grupo | Algunas métricas |
|---|---|
| **Población** | bots vivos, vegetales, animales, cadáveres, especies vivas, bots en multibots |
| **Evolución** | generación media y máxima, mutaciones, edad, hijos por bot |
| **Genética** | longitud del ADN (media, mínima, máxima), genes por bot |
| **Comportamiento** | disparos de cada tipo, reproducciones, nacimientos, lazos creados, caparazón, baba, veneno y toxina fabricados, muertes, presas cazadas |
| **Energía** | energía total, de vegetales y de animales, cuerpo, desechos, cloroplastos |
| **Entorno** | tamaño del campo, obstáculos, teleporters, luz disponible, posición y alcance del sol, día o noche |

Las métricas que llevan «· especie» en el catálogo se dibujan una curva por
especie; las otras son un total de todo el mundo. Las cantidades que se suman
(bots, energía, disparos) salen como **áreas apiladas**, una capa por especie, y
los promedios (generación, largo del ADN) como **líneas**. Entran las ocho
especies que llegaron a tener más bots; en las áreas apiladas, las demás se juntan
en una capa gris, **Otras**.

Al pasar el puntero por un gráfico aparece el ciclo y el valor de cada curva (con
su mínimo y máximo si el punto está fundido) y, en las áreas, el total. La
elección de los cuatro gráficos se recuerda en este navegador.

Qué mide cada cosa está en el capítulo de la simulación: la energía y el cuerpo
en [[simulacion/energia]], los disparos en [[simulacion/disparos]], las defensas
en [[simulacion/defensas]] y los lazos en [[simulacion/lazos]].

### Hallazgos {#hallazgos}
<!-- web2/src/lib/analizar/hallazgos.js (REFRESCO_HALLAZGOS_MS 5000, agrupados como el informe); engine/detectors.js (UMBRALES); engine/report/textos.es.json hallazgo.*; i18n analizar.hallazgos.* -->

A la derecha del Panel, la tarjeta **Hallazgos** lee la historia con un conjunto
de detectores y escribe una frase por cada cosa notable que encuentra. Son
reglas fijas, no una inteligencia artificial: por eso la tarjeta dice «texto por
reglas».

| Tipo | Qué busca |
|---|---|
| **Dominio** | Una especie que pasa de la mitad de los animales durante al menos 5000 ciclos. |
| **Colapso** | Una caída brusca de la población de animales: a la mitad o menos en unos 2000 ciclos, y que se sostiene. |
| **Extinción** | Una especie que se queda sin bots y no vuelve. Un vegetal que reaparece por la repoblación no cuenta. |
| **Largo del ADN** | Un crecimiento o una reducción sostenida (de 20 % o más) del largo del ADN de los animales. |
| **Sustitución** | Una especie que desplaza a otra como la más numerosa. |
| **Oscilación** | Una población que sube y baja con un período regular, al menos cinco veces seguidas. |

Los vegetales no cuentan en ninguno, salvo en la extinción. Cada hallazgo tiene un
enlace con su ciclo: al tocarlo, una línea discontinua marca ese ciclo en los cuatro
gráficos. Si los detectores no encuentran nada, la tarjeta lo dice. Con la
corrida actual, los hallazgos se recalculan cada pocos segundos. Son las mismas
frases que abren un informe (ver [[app/informes]]).

Debajo hay una tabla con las especies más numerosas (hoy, su máximo y su
generación más alta) y el enlace **Todas las especies**, que abre la pestaña
siguiente.

## Especies {#especies}
<!-- web2/src/lib/analizar/Especies.svelte; especies.js (COLUMNAS, comportamientoEspecie: últimos 10 puntos, por bot cada 1000 ciclos, COMPORTAMIENTO_FICHA); i18n analizar.col.*, analizar.esp.* -->

Una tabla con una fila por especie y estas columnas: **Especie**, **Hoy** (bots
vivos en la última muestra), **Máximo**, **Aparición**, **Extinción** («viva» si
sigue), **Gen. máx.**, **Mutaciones**, **ADN medio**, **Energía por bot**, **Edad
media** e **Hijos por bot**, más una curva chica de **Bots vivos**. Hacé clic en un
encabezado para ordenar por esa columna; otro toque invierte el orden.

Al tocar el nombre de una especie se abre su ficha, debajo de la tabla:

- de dónde salió (fundadora presente desde tal ciclo, o derivada de otra especie)
  y, si se extinguió, cuándo;
- los mismos números de la tabla y el ciclo de su máximo;
- su población a lo largo de la corrida, con la banda de los puntos fundidos;
- su **Comportamiento** reciente, por bot y cada 1000 ciclos: disparos de energía,
  de cuerpo y de veneno, reproducciones, lazos creados, caparazón activado y
  muertes.

Los botones **Ver en Filogenia** y **ADN dominante vs fundador** llevan a las
pestañas que siguen con esa especie ya elegida. La especie elegida es la misma en
Especies, Filogenia y Genética. Qué es una especie para el motor está en
[[simulacion/especies]].

## Filogenia {#filogenia}
<!-- web2/src/lib/analizar/Filogenia.svelte; filogenia.js; engine/lineage.js (poda a ancestros de vivos); PLAN.md C7; i18n analizar.filo.* -->

Arriba, el **Árbol de especies**: una barra por especie que va del ciclo en que
apareció al último en que tuvo bots, con una × donde se extinguió. Si una especie
nació de otra, cuelga de ella, y la flecha al lado del nombre pliega o despliega
sus derivadas.

En una simulación armada en la app el árbol suele ser **plano**: todas las
especies son fundadoras, sembradas por vos o llegadas por un teleporter. Es que la
app no enciende la autoespeciación, que es lo que hace nacer especies nuevas (ver
[[simulacion/especies#autoespeciacion]]). Un árbol con ramas aparece al cargar un
archivo `.dbsim` que la traiga encendida.

Debajo, los **Individuos** de la especie elegida: un árbol de parentesco
ordenado por generación, de izquierda a derecha. Los círculos de color son los
bots vivos; los puntos, sus ancestros. Para no crecer sin fin, la app guarda solo
los vivos y sus ancestros: las ramas que se cortaron sin descendencia se
descartan. Si la cadena sigue más atrás de lo que entra en el dibujo, lo marca
con «…».

Al tocar un bot, la tarjeta **Individuo marcado** muestra su número, su
**Generación**, en qué ciclo nació, su **Madre**, sus **Mutaciones**, la
**Longitud del ADN**, sus **Hijos** y si está vivo o es un ancestro. El árbol se
recorre también con el teclado: izquierda va a la madre, derecha al primer hijo,
arriba y abajo al bot vecino. El linaje es por línea materna, como explica
[[simulacion/especies#linaje]].

## Genética {#genetica}
<!-- web2/src/lib/analizar/Genetica.svelte; genetica.js (KINDS_LINAJE, mapaCalor); engine/lineage.js (MAX_FOTOS 50, fotos solo si cambia el hash); lib/sim/metricas.js (dominante cada 10 muestras); i18n analizar.gen.*, analizar.hist.* -->

La pestaña tiene dos mitades.

**Histogramas.** Con **Histogramas de** elegís **Todas las especies** o una sola,
y con los botones, qué medir: **Longitud del ADN**, **Generación**,
**Mutaciones acumuladas**, **Edad**, **Energía**, **Cuerpo**, **Genes**, **Hijos**
y **Presas cazadas**. El histograma es de la última muestra, con una línea
discontinua en la mediana. Para todas las especies se suma **Evolución en la
corrida**: un mapa de calor con el tiempo en un eje y el valor en el otro, más
oscuro donde hay más bots. Ahí se ve, por ejemplo, cómo el largo del ADN se va
corriendo a lo largo de la corrida. Para una sola especie hay cuatro medidas
(largo del ADN, generación, mutaciones e hijos), que salen de sus individuos
vivos.

**ADN dominante vs fundador.** Cada 1000 ciclos la app fotografía el ADN
_dominante_ de cada especie, el que llevan más bots, y guarda la foto si cambió.
Elegí la **Especie** y, si hay varias, la **Foto**: la pestaña la compara con la
primera, que es la del fundador. Arriba, cuatro números: cuántos genes cambiaron,
el largo antes y ahora, la distancia al fundador y qué parte de la especie lleva
ese ADN. Después, un casillero por gen (**igual**, **modificado**, **nuevo** o
**borrado**) y, para cada gen que cambió, las palabras de antes y de después con
las diferencias resaltadas. Al final se despliega el ADN completo del dominante.

Esta distancia compara gen por gen; no es la que usa el motor para decidir si dos
bots pueden cruzarse ([[simulacion/especies#distancia]]). Cómo cambia el ADN al
mutar está en [[simulacion/mutaciones]], y [[tutoriales/evolucion]] propone un
experimento para verlo en esta pestaña.

## Eventos {#eventos}
<!-- web2/src/lib/analizar/Eventos.svelte; eventos.js (FILTROS; además del filtro «Todos»); i18n analizar.ev.* -->

Un gráfico de la población total con un pin por evento y, debajo, la lista de los
eventos de la corrida: los mismos que avisa Observar, guardados sin recortar. Los
botones filtran por tipo y cuentan cuántos hay:

| Filtro | Qué junta |
|---|---|
| **Especies nuevas** | especies que aparecieron y llegadas por teleporter |
| **Extinciones** | especies que se quedaron sin bots |
| **Récords** | récords de población y de generación |
| **Cambios en caliente** | parámetros cambiados con la corrida en marcha y cambios de objetos del mundo |
| **Siembras** | el inicio de la corrida y cada siembra |
| **Guardar y cargar** | cuándo se guardó, se retomó o se cargó de un archivo |

Al tocar un evento, en la lista o en su pin, su ciclo queda marcado con una línea
discontinua en este gráfico y en los del Panel y de Especies. **Quitar la marca** la
borra. Sirve para ver qué pasó con las métricas justo después de un cambio en
caliente o de una extinción.

## Comparar {#comparar}
<!-- web2/src/lib/analizar/comparar/Comparar.svelte, DosCorridas.svelte, Replicas.svelte, Barrido.svelte, SelectorMetrica.svelte; engine/replicas.js (MAX_REPLICAS 64, METRICAS_CLAVE, C19); engine/barrido.js (2-32 valores, 512 corridas); i18n/es/comparar.json; PLAN.md decisiones 10 y 13, C19 -->

Comparar tiene tres vistas.

**Dos corridas.** Elegí la **Corrida A** y la **Corrida B** (la actual o
guardadas), un **Grupo** y una **Métrica**: las dos curvas salen superpuestas,
cada una con su banda. Debajo, las **Diferencias de configuración**: escenario,
semilla, base de opciones, cada parámetro distinto al arrancar, las especies
sembradas, los objetos del mundo y los cambios en caliente y siembras de cada
una. Es la forma rápida de responder «¿por qué estas dos corridas terminaron tan
distinto?».

**Réplicas.** Una sola corrida puede engañar: el azar pesa mucho. Las réplicas
repiten el escenario de una corrida con otras semillas para ver qué resultado es
típico y cuál fue suerte.

1. En **Corrida de origen** elegí la corrida. Tiene que haber salido de un
   escenario; una simulación cargada de un archivo no se puede replicar.
2. Elegí cuántas **Réplicas** (de 1 a 64), cuántos **Ciclos** y cuántos **Workers
   a la vez** (hasta 8 de fábrica, como mucho los núcleos de tu equipo menos uno).
3. Elegí la métrica que querés ver y hacé clic en **Lanzar réplicas**.

Cada réplica corre sin dibujar, a toda velocidad, y repite los cambios en caliente
de la corrida de origen en el mismo ciclo. La réplica 1 usa la semilla de la
corrida de origen. El resultado es una línea con la media de las réplicas y una
banda del percentil 10 al 90, más una tabla del valor final de las métricas
principales (bots vivos, animales, vegetales, especies vivas, generación máxima,
mutaciones, largo del ADN, energía y presas cazadas) con su media, desvío, mínimo
y máximo. Mientras faltan réplicas, se ve lo que ya terminó.

**Barrido.** Lo mismo, pero cambiando un parámetro: elegí uno con el buscador
**Parámetro** (por nombre, variable o clave), sus **Valores** (**De un valor a
otro en pasos iguales** o una **Lista de valores**, entre 2 y 32) y las
**Semillas por valor**. La app corre cada valor con cada semilla, hasta 512
corridas en total, y muestra la métrica al final según el valor del parámetro,
una tabla por valor y la serie media de cada valor. Si la corrida de origen tenía
cambios en caliente de ese mismo parámetro, se reescriben con el valor de cada
corrida. Los parámetros están en [[app/experimentar-avanzado]]; de fábrica el
barrido propone [[param:base:maxEnergy]].

Las réplicas y los barridos son _trabajos en segundo plano_: siguen mientras usás
el resto de la app y se retoman si la cerrás. Cómo se manejan, y cómo se hace un
informe con sus resultados, está en [[app/informes#trabajos]].

:::nota
El motor distingue solo 65.536 mundos distintos por semilla: dos semillas
diferentes pueden dar exactamente la misma corrida. Las réplicas y el barrido
descartan las semillas que repetirían un mundo ya usado, para que la banda y el
desvío no salgan más angostos de lo que son.
:::
<!-- C19; verificado con probar-adn: semillas 12345 y 73151 (misma mezcla según estadoSemilla) dan posiciones idénticas; 12346 no -->

## Informes {#informes}

La última pestaña arma informes de una corrida, de dos corridas o de un trabajo
de réplicas, y exporta los datos crudos. Tiene su propia página:
[[app/informes]].
