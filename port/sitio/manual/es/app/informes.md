---
titulo: Informes
resumen: "Cómo convertir una corrida, una comparación, un trabajo de réplicas o un torneo en un informe .html que se abre sin conexión y se imprime a PDF, cómo exportar los datos crudos y cómo funcionan los trabajos en segundo plano."
etiquetas: [informes, exportar, PDF, CSV, réplicas, trabajos]
estado: revisada
---
Un informe es un solo archivo `.html` con todo adentro: el texto, los gráficos y
los datos. Se abre en cualquier navegador sin conexión, se imprime a PDF y se
puede mandar por correo o subir a un foro sin adjuntar nada más. Sirve para
guardar el resultado de un experimento o para mostrárselo a alguien que no tiene
la app abierta.

Los informes se arman en la pestaña **Informes** de Analizar (ver
[[app/analizar]]). Dos más salen de otros lugares: el de un torneo, también desde
Competir, y el de un barrido de parámetros, desde Comparar.

## Generar un informe {#generar}
<!-- web2/src/lib/analizar/informes/Informes.svelte; i18n/es/informes.json (paso.*, tpl.*, idioma.*, generar, descargar, imprimir, vista*); engine/report/index.js TIPOS -->

1. En **1 · Plantilla**, elegí qué informar: **Corrida**, **Comparación**,
   **Réplicas** o **Torneo**. Cada tarjeta dice qué incluye y de dónde saldría.
2. En **2 · Origen e idioma**, elegí la corrida (la actual o una guardada), las
   dos corridas a comparar, el trabajo de réplicas o el torneo, según la
   plantilla. Elegí también el **Idioma del informe**: **Español** o **English**,
   aunque la app esté en el otro.
3. Tocá **Generar y ver**. El informe aparece en la **Vista previa**, a la
   derecha.
4. Con **Descargar .html** lo bajás; con **Imprimir / PDF** se abre en una ventana
   y el navegador ofrece imprimirlo o guardarlo como PDF.

La app propone de entrada la corrida que estás mirando en Analizar. Para comparar
hacen falta dos corridas: si solo tenés la actual, guardala desde Observar o corré
otra. Si el navegador no deja abrir la ventana de impresión, permití las ventanas
emergentes del sitio, o descargá el `.html` y imprimilo desde ahí.

Un informe de la corrida actual es una foto: muestra la corrida hasta el ciclo en
que lo generaste. Si la corrida sigue, generá otro más tarde.

## Qué trae cada plantilla {#plantillas}
<!-- engine/report/corrida.js, comparacion.js (GRUPOS_CMP), replicas.js, torneo.js, barrido.js; engine/report/textos.es.json (sec.*, kpi.*, cmp.*, rep.*, torneo.sec.*, barrido.sec*) -->

Todos empiezan igual: un título, una línea con los datos de lo que se informa
(ciclos, semilla, base de opciones, réplicas…) y un **Resumen** escrito por
reglas.

### Corrida {#corrida}

Abre con los números principales: bots al final, el pico de población, cuántas
especies siguen vivas, las extinciones, la generación máxima, el largo medio del
ADN al final, los nacimientos y los ciclos. Después, seis secciones:

1. **Configuración**: la base de opciones y cada parámetro cambiado, las especies
   sembradas y los objetos del mundo.
2. **Población por especie**: bots por especie, apilados, con los hallazgos
   marcados.
3. **Métricas**: un bloque por grupo (población, evolución, genética,
   comportamiento, energía y entorno), con los histogramas de la última muestra.
4. **Especies**: una tabla con el final, el pico, la generación máxima, el ADN
   medio y el estado de cada una.
5. **Eventos y cambios en caliente**.
6. **Genealogía**: el árbol de especies y, para cada especie, su ADN dominante
   frente al del fundador, gen por gen.

### Comparación {#comparacion}

Dos corridas, A y B. Trae las **Configuraciones** de las dos lado a lado con sus
diferencias, las **Métricas** de cada grupo superpuestas (A en línea continua y B
en discontinua) junto con la población por especie de cada una, y los **Valores
finales** con la diferencia B − A. Si las dos semillas dan el mismo mundo, el
informe lo avisa (ver la nota de [[app/analizar#comparar]]).

### Réplicas {#replicas}

Un trabajo de réplicas de Comparar. El resumen da el valor final de las métricas
principales como media ± desvío. Siguen el **Escenario y semillas** (con la
semilla de cada réplica y si terminó), la **Media y banda p10–p90** de cada
métrica y los **Valores finales: medias y desvíos**. Se puede informar un trabajo
que quedó a medias, cancelado o con alguna réplica fallida, si al menos una
terminó: el informe aclara que los resultados son parciales.

### Torneo {#torneo}

La última temporada de un torneo guardado: **Tabla**, la estructura del formato
(rondas, grupos y cuadro, calendario, escalera…), **Evolución del Elo**,
**Partidos** con sus semillas y **Reglas**. El de otra temporada se genera desde
Competir (ver [[app/competir]]).

### Barrido {#barrido}

No está entre las plantillas: se baja con **Informe .html** al ver un trabajo de
barrido en Comparar, junto a **CSV · resumen por valor** y **CSV · cada
corrida**. Trae el parámetro, el escenario y las semillas, el valor final según el
parámetro, la serie media de cada valor y la tabla por valor.

## El resumen automático {#resumen}
<!-- engine/detectors.js; engine/report/corrida.js (frases con enlace #fig); informes.resumenNota; PLAN.md decisión 11 -->

En los informes de corrida y de comparación, las frases del resumen salen de los
mismos detectores que la tarjeta Hallazgos del Panel (ver
[[app/analizar#hallazgos]]): dominio de una especie, colapso de la población,
extinciones, cambios en el largo del ADN, sustituciones y oscilaciones. En el de
réplicas resumen el valor final de cada métrica. No hay inteligencia artificial
ni servidor de por medio: son reglas fijas sobre los números. Cada frase termina
con un enlace a la figura que la respalda.

Si un detector no encuentra nada, no escribe nada. Un resumen corto, o vacío, no
es un error: la corrida no tuvo nada de eso.

## El archivo .html {#archivo}
<!-- engine/report/plantilla.js (autocontenido, @media print A4, barra con script, datos en <script type=application/json>); PLAN.md decisión 24 (informes siempre claros); Informes.svelte (iframe sandbox="") -->

- **No necesita conexión ni nada externo**: los gráficos van dibujados dentro del
  archivo y los datos, embebidos.
- **Arriba tiene una barra** con **Datos · CSV**, **Datos · JSON** e **Imprimir /
  PDF**, que bajan los datos del informe sin pasar por la app. Esa barra funciona
  en el archivo descargado; en la vista previa de la app los botones no
  responden.
- **Se imprime en A4**: sin la barra, con saltos de página entre secciones y sin
  cortar figuras ni tablas.
- **Es siempre claro**, aunque uses la app con el tema oscuro.

## Informes generados {#generados}
<!-- web2/src/lib/analizar/informes/guardados.js (MAX_INFORMES 30, guarda el html entero); i18n informes.generados, ver, bajar, borrar; competir.informe.listo -->

Cada informe que generás queda en la lista **Informes generados**, con su
plantilla, su idioma, la fecha y el tamaño. **Ver** lo vuelve a abrir en la vista
previa, **Descargar** lo baja de nuevo y **Borrar** lo quita. Se guarda el archivo
entero, así que lo podés volver a bajar aunque ya hayas borrado la corrida de la
que salió. Los informes de torneo que generás desde Competir también aparecen
acá.

La app conserva los 30 más recientes; al generar el 31, se borra el más viejo.
Todo queda en este navegador (ver [[app/tus-datos]]).

## Solo datos {#datos}
<!-- Informes.svelte (bajarCsv, bajarJson, bajarPng, MAX_LEYENDA 12); engine/export.js (csvLargo, jsonCorrida); lib/analizar/informes/png.js; i18n informes.datos.*, informes.png.* -->

Si preferís hacer tus propios gráficos, la tarjeta **Solo datos** exporta la
corrida que estás mirando en Analizar:

| Botón | Qué baja |
|---|---|
| **Series · CSV** | Una tabla con todas las series de la historia, una fila por punto: ciclo, métrica, especie (vacía si es un total), media, mínimo, máximo y cuántas muestras junta el punto. Se abre en cualquier planilla. |
| **Todo · JSON** | La historia completa, los eventos, el linaje y los datos de la corrida (nombre, semilla y escenario). |
| **Gráfico · PNG** | Uno de los cuatro gráficos del Panel, el que elijas en **Gráfico del Panel**, como imagen. Sale con el tema que estés viendo; la leyenda muestra hasta 12 series. |

Los puntos fundidos de una corrida larga salen como están guardados: con su
media, su mínimo y su máximo (ver [[app/analizar#historia]]).

## Trabajos en segundo plano {#trabajos}
<!-- web2/src/lib/trabajos/trabajos.svelte.js, pool.js (TOPE_POR_DEFECTO 8, núcleos − 1), ListaTrabajos.svelte, ejecutores.js (replicas, prueba, ronda, barrido); engine/replicas.js; lib/BarraSuperior.svelte (chip); i18n comparar.trabajos.*, comparar.aviso.*, comparar.chip.*; PLAN.md decisiones 10 y 23, C20 -->

Las réplicas y los barridos de Comparar corren como _trabajos en segundo plano_:
la app los pone en una cola y los ejecuta en varios hilos a la vez, sin dibujar y
a toda velocidad, mientras vos seguís usando el resto. La misma cola corre
también las rondas de torneo en segundo plano y la prueba de un bot del editor
(ver [[app/competir]] y [[app/editor]]).

Cada trabajo aparece en la lista de Comparar (**Trabajos de réplicas** o
**Trabajos de barrido**) con su estado: **En espera**, **Corriendo**,
**Terminado**, **Falló** o **Cancelado**, y cuántas unidades lleva hechas. Los
botones:

- **Cancelar** frena uno en espera o en curso. Lo que ya terminó se conserva.
- **Reintentar** vuelve a correr uno fallido o cancelado. Las rondas de torneo no
  se reintentan: se pide otra ronda desde Competir.
- **Borrar** lo quita junto con sus resultados, después de confirmar.

Algunas cosas útiles:

- **Cuántos a la vez.** El campo **Workers a la vez** de Comparar fija cuántas
  unidades corren juntas: 8 de fábrica, y como mucho los núcleos de tu equipo
  menos uno. Más rápido no siempre es mejor si querés seguir usando la
  computadora.
- **Sobreviven a una recarga.** Si cerrás la app con trabajos a medias, se retoman
  al volver a abrirla. Las unidades terminadas no se repiten; la que quedó
  cortada empieza de nuevo y da lo mismo, porque una corrida con su escenario y
  su semilla sale igual en cualquier hilo.
- **Una sola pestaña los corre.** Con la app abierta en varias pestañas, una sola
  ejecuta la cola; en las demás se ven y se manejan igual. Si esa pestaña se
  cierra, otra toma la cola.
- **Avisos.** La barra de arriba muestra cuántos trabajos hay en curso o, cuando
  terminan, cuántos terminaron; al tocarla te lleva a Comparar (o a Competir, si
  son rondas de torneo). Al terminar un trabajo aparece además un aviso en la
  lista, con **Ver** y **Descartar**. Con **Avisarme con una notificación**, el
  navegador te avisa también con una notificación del sistema.

Cuando un trabajo de réplicas termina, pasa a estar disponible en la plantilla
**Réplicas** de Informes.
