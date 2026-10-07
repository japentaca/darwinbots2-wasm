---
titulo: Recorrido por la app
resumen: "Las seis secciones de la barra superior (Inicio, Observar, Experimentar, Analizar, Bots y Competir), para qué sirve cada una y dónde se explica en detalle, más la interfaz clásica."
etiquetas: [app, navegación, secciones, interfaz]
estado: revisada
---
La app tiene seis secciones, siempre a mano en la barra de arriba. Hay una sola
simulación en curso a la vez: la que se ve en Observar. Las demás secciones la
preparan (Experimentar), la estudian (Analizar), le dan bots (Bots) o la usan
para jugar partidos (Competir).

| Sección | Para qué |
|---|---|
| **Inicio** | Empezar: escenarios, la última corrida, tus corridas guardadas y tus bots recientes. |
| **Observar** | El mundo en vivo, con sus controles, eventos, estadísticas y el inspector de bots. |
| **Experimentar** | Los escenarios y los parámetros de la simulación, con cambios en caliente registrados. |
| **Analizar** | Métricas, especies, filogenia, eventos, comparaciones e informes de las corridas. |
| **Bots** | La biblioteca de bots, sus fichas y el editor de ADN. |
| **Competir** | Partidos y torneos entre bots, con tabla, rondas y salón de la fama. |

## La barra de arriba {#barra}
<!-- web2/src/lib/BarraSuperior.svelte; i18n/es/app.json; web2/PLAN.md decisión 24; i18n/es/comparar.json (comparar.chip.*) -->

Además de las seis secciones, la barra tiene:

- El **logo** de DarwinBots, que lleva a Inicio. Al dejar el puntero encima
  muestra la versión de la app.
- Un **indicador de la simulación**: «Corriendo · _nombre_» o «En pausa ·
  ciclo _N_». Un clic te lleva a Observar.
- Un **indicador de trabajos** cuando hay réplicas o rondas de torneo
  corriendo en segundo plano (o terminadas, con un aviso). Un clic te lleva a
  donde se ven.
- **ES** y **EN**, para cambiar el idioma.
- Tres botones de **tema**: el del sistema, claro u oscuro. El mundo se dibuja
  siempre sobre fondo oscuro.
- **Interfaz clásica**, el enlace a la otra interfaz (ver
  [[empezar/recorrido#clasica|más abajo]]).

## Inicio {#inicio}
<!-- web2/src/screens/Inicio.svelte; i18n/es/inicio.json -->

Es la puerta de entrada. Arriba, la **Última corrida**: la que tenés abierta,
con **Continuar** y **Ver análisis**, o, si no hay ninguna abierta, la última
que guardaste, con **Retomar**. Debajo, la galería de **Escenarios**: cada tarjeta tiene
**Iniciar**, que arranca una corrida nueva y te lleva a Observar, y
**Ajustar**, que la abre en Experimentar. La tarjeta **Desde un archivo**
carga una simulación guardada (`.dbsim`) o siembra un bot desde su archivo
`.txt`, con algas en el mundo por defecto.

Al costado, tus **Corridas guardadas** y tus **Bots recientes**, con un enlace
a la biblioteca completa.

Detalle en [[app/inicio]]. Si es tu primera vez, seguí
[[empezar/primera-simulacion]].

## Observar {#observar}
<!-- web2/src/screens/Observar.svelte; lib/observar/*; lib/inspector/Inspector.svelte; i18n/es/observar.json, mundo.json, mundoObj.json -->

El mundo en grande. En la barra de abajo: **Iniciar** / **Pausar**, **Un
ciclo**, la velocidad (**× 1**, **× 10**, **× 100**, **Máx.**), **Sembrar**
una especie nueva, **Mundo** para poner obstáculos, laberintos y teleporters
sobre el campo, **Guardar**, **Buscar el mejor**, **Instantánea** (una imagen
del mundo o una ficha de cada bot vivo o muerto) y **Corridas**. A la derecha,
la **Vista** y **Color por**, que cambian cómo se dibujan los bots.

El panel lateral muestra **En vivo** (bots, especies, energía, generación, el
gráfico de población y los eventos) y, cuando hacés clic en un bot, el
**inspector**: sus recursos, sus sentidos, su memoria, su ADN, una consola y
un modo para manejarlo con el teclado.

Detalle en [[app/observar]] y [[app/inspector]].

## Experimentar {#experimentar}
<!-- web2/src/screens/Experimentar.svelte; lib/experimentar/*; engine/opciones.js (CONTROLES_BASICOS, GRUPOS); i18n/es/experimentar.json; web2/PLAN.md decisiones 12-14 -->

Acá se arma el mundo. A la izquierda, los **Escenarios de fábrica** y los
**Míos**. A la derecha, el escenario abierto como _borrador_: sus parámetros,
sus **Especies a sembrar** y sus **Objetos del mundo**.

- En modo **Básico** hay diez controles: costos, mutaciones, tamaño del
  campo, bordes, energía solar, tope y repoblación de vegetales, día y noche,
  medio (agua, sólido o espacio) y cadáveres.
- En modo **Avanzado** están todos los parámetros del motor, por grupo, con un
  buscador y la marca de los que cambiaste.

Cada cambio se puede mandar a la simulación que está corriendo con **Aplicar a
la actual**, sin empezar de nuevo (salvo el tamaño del campo, la siembra
inicial y los objetos, que requieren una simulación nueva), o usar para una
corrida nueva con **Nueva simulación**. Lo aplicado en caliente queda anotado
en la corrida como un evento.

Detalle en [[app/experimentar]], [[app/experimentar-avanzado]] y
[[app/escenarios]].

## Analizar {#analizar}
<!-- web2/src/screens/Analizar.svelte; i18n/es/analizar.json (analizar.tab.*), comparar.json (comparar.vista.*), informes.json; web2/PLAN.md decisiones 7-11 -->

Todo lo que se puede medir de una corrida, en siete pestañas:

| Pestaña | Qué muestra |
|---|---|
| **Panel** | Cuatro gráficos a elección, de seis grupos de métricas (población, evolución, genética, comportamiento, energía y entorno), y los hallazgos automáticos. |
| **Especies** | Una fila por especie, con su historia. |
| **Filogenia** | El árbol de especies y de individuos. |
| **Genética** | Histogramas y el ADN dominante de cada especie, comparado con el de su fundador. |
| **Eventos** | Lo que pasó y cuándo; elegir uno lo marca en todos los gráficos. |
| **Comparar** | **Dos corridas** superpuestas, **Réplicas** del mismo escenario con varias semillas y **Barrido** de un parámetro. |
| **Informes** | Un archivo `.html` con los gráficos y los datos adentro, que se abre sin conexión y se imprime a PDF. |

Detalle en [[app/analizar]] y [[app/informes]].

## Bots {#bots}
<!-- web2/src/screens/Bots.svelte; lib/bots/*; lib/bots/editor/*; i18n/es/bots.json, editor.json; web2/PLAN.md decisiones 18-20 -->

La **Biblioteca** reúne los bots del Bestiario y los tuyos. Se buscan por
nombre, se agrupan y se filtran por capacidad («caza (energía)»,
«fotosíntesis», «usa lazos», «veneno»…), se marcan como favoritos y se siembran de a varios con **Sembrar en
lote**.

Cada bot tiene su **ficha**, con tres pestañas: **Resumen** (qué hace, qué lee
y qué escribe), **ADN** e **Historial** (en qué corridas, torneos y pruebas
participó). Los bots del Bestiario son de solo lectura: para cambiarlos, se
duplican. Los tuyos se crean con **+ Nuevo bot** y se escriben en el
**editor de ADN**, que avisa de los errores mientras escribís, muestra el ADN
gen por gen, guarda versiones y tiene **Probar**: corre las copias del bot que elijas,
durante los ciclos que elijas, sin dibujar, y te dice cómo le fue comparado
con la versión anterior.

Detalle en [[app/bots]] y [[app/editor]].

## Competir {#competir}
<!-- i18n/es/competir.json competir.rapido.*, competir.nuevo.paso1-3, competir.formato.*, competir.jugar.*, competir.salon.ayuda -->
<!-- web2/src/screens/Competir.svelte; lib/competir/*; i18n/es/competir.json; web2/PLAN.md decisiones 21-23; port/README.md Torneos (E10-E12) -->

Partidos y torneos entre bots. El **Partido rápido** junta hasta 20 bots y no
se guarda, salvo que lo conserves con **Guardar como torneo**.
Un **Nuevo torneo** se arma en tres pasos (formato, participantes y reglas)
con seis formatos: partido único, rey de la colina, todos contra todos,
escalera, mundial y suizo.

Los partidos se miran en Observar con **▶ Jugar**: uno solo, la temporada
entera o una edición tras otra, con cortinillas entre peleas y, si querés, a
pantalla completa. También se juegan con la **Ronda en segundo plano**, sin
dibujar y a toda velocidad; el resultado es el mismo. La tabla lleva puntos, Elo y desempates, y el
**Salón de la fama** reúne a los bots de todos los torneos guardados, con un
Elo único calculado sobre todos sus partidos.

Detalle en [[app/competir]].

## Tus datos {#datos}
<!-- i18n/es/inicio.json inicio.nota; web2/PLAN.md decisión 17; lib/analizar/informes/guardados.js -->

Todo lo que guardás (corridas, bots propios, escenarios, torneos, informes)
queda en este navegador. Cada sección tiene cómo exportarlo a un archivo y cómo
volver a importarlo. Qué se guarda, dónde, y qué pasa si borrás los datos del
navegador está en [[app/tus-datos]].

## La interfaz clásica {#clasica}
<!-- web2/PLAN.md decisión 5 (monitor RGB, skins, imagen de fondo, .gsave), decisión 17, C22; lib/bots/migracion.svelte.js y lib/competir/migracion.svelte.js (una sola vez, la clásica no se toca); port/README.md Página web, Internet Mode (E7); port/web/index.html -->

El enlace **Interfaz clásica** abre la primera versión web del port, en
`/classic/`. Usa el mismo motor, está en inglés y se parece más al programa
original: ventanas flotantes, inventario de bots, gráficos del original e
Internet Mode. Ya no cambia: se publica tal cual.

La app nueva hace todo lo que hace la clásica, salvo unas pocas cosas que
quedaron afuera a propósito (como el monitor de memoria en colores o la imagen
de fondo) e Internet Mode. La primera vez que abrís la app nueva, copia los
bots y los torneos que tuvieras guardados en la clásica, sin tocarlos. Detalle
en [[app/clasica]].
