---
titulo: Observar
resumen: "La pantalla del mundo en vivo: las disposiciones y las pestañas, la cámara, la pantalla completa, el tiempo, las tres vistas, el panel En vivo con su gráfico y sus eventos, sembrar, guardar, instantáneas, los torneos y el Player Bot."
etiquetas: [observar, cámara, velocidad, vistas, sembrar, guardar]
estado: revisada
---
Observar es donde mirás la simulación mientras corre. Ocupa la pantalla en tres
partes:

- **El mundo**, a la izquierda: el campo con los bots, los disparos, los lazos y
  los obstáculos.
- **El panel lateral**, a la derecha, con pestañas: **En vivo** (las cifras de
  la corrida), **Torneo** (solo con un torneo en curso) y **Bot** (el
  [[app/inspector|inspector]] del bot que elegiste).
- **La barra de abajo**: el tiempo, la velocidad, las herramientas (sembrar,
  guardar, instantáneas…) y la vista.

Si entrás a Observar sin ningún mundo en memoria, la app arranca sola el
escenario **Sopa primordial** con una semilla nueva y lo pone a correr. Para
elegir otro, andá a [[app/inicio]].

## Disposiciones y pestañas {#disposiciones}
<!-- Observar.svelte (disposicion, pestaña); lib/observar/disposicion.js (DISPOSICIONES, pestañaTras, KV_DISPOSICION); i18n observar.disposicion.*, observar.lateral.*; PLAN-TORNEO-EN-CURSO.md TC3 -->

Tres botones de la barra de abajo, a la izquierda de **⛶**, reparten el lugar
entre el mundo y el panel lateral:

| Botón | Qué se ve |
|---|---|
| **▣ Campo** | el mundo solo, sin el panel lateral |
| **◧ Mixta** | el mundo y el panel lateral (la de siempre) |
| **▤ Datos** | el panel a lo ancho, y el mundo en miniatura en una esquina |

El mundo nunca se oculta: en **Datos** sigue corriendo en la miniatura, y ahí
también se puede hacer clic en un bot o usar el zoom. La app recuerda la
disposición en este navegador. En un teléfono, **Datos** deja el mundo arriba,
más bajo, y el panel debajo.

El panel lateral tiene pestañas. **En vivo** es la de siempre. **Torneo**
aparece mientras hay un [[app/observar#tv|torneo en curso]] y se abre sola
cuando empieza. **Bot** muestra el [[app/inspector|inspector]]: elegir un bot
salta a esa pestaña, y soltarlo vuelve a la de antes.

## La cámara {#camara}
<!-- web2/src/lib/mundo/Mundo.svelte (alTeclear, alRodar, alMover, encuadrar); lib/mundo/camara.js (ZOOM_MIN 1, ZOOM_MAX 64); i18n/es/mundo.json mundo.aria, mundo.acercar… -->

Al empezar ves el campo entero. Para acercarte:

| Qué querés | Con el mouse | Con el teclado |
|---|---|---|
| Acercar | rueda hacia adelante (acerca hacia donde está el puntero) o el botón **+** | `+` |
| Alejar | rueda hacia atrás o el botón **−** | `−` |
| Ver todo el campo | el botón **[ ]** (**Encuadrar todo**) | `0` |
| Moverte | arrastrar el mundo (solo con zoom) | las flechas |

Los atajos de teclado andan cuando el mundo tiene el foco: hacé clic una vez
sobre el campo, o llegá con Tab. El zoom va de 1 (el campo entero) a 64
aumentos. Abajo a la izquierda, una barra de escala dice cuántas unidades del
mundo mide y el tamaño del campo.

Arriba a la izquierda, un rótulo recuerda la vista que estás usando (y el
«color por», en la vista enriquecida).

### Pantalla completa {#pantalla}
<!-- Observar.svelte alternarPantalla (botón ⛶ de la barra, tecla F, Esc); i18n observar.pantalla.* -->

El botón **⛶**, a la derecha de la barra de abajo, o la tecla `F` ponen
Observar a pantalla completa, sin la barra de abajo y con la
[[app/observar#disposiciones|disposición]] elegida: con **▣ Campo**, el campo
solo; con **◧ Mixta** o **▤ Datos**, también el panel lateral. `Esc` o
**Salir de pantalla completa (Esc)** vuelven a Observar como estaba. Entrar y
salir no cambia la simulación ni el torneo que se esté jugando.

## Elegir y seguir un bot {#seleccionar}
<!-- Mundo.svelte alSoltar (clic = sesion.seleccionar), chip de foco (Seguir / Dejar de seguir / ×), efecto «acercar si hace falta» (z<2 → 4); i18n mundo.ayuda.clic, mundo.seguir, mundo.deseleccionar -->

Un clic sobre un bot lo elige: queda marcado, el panel lateral salta a la
pestaña **Bot**, con su [[app/inspector|inspector]], y el mundo dibuja su
rastro y sus nueve ojos. Un
clic en un lugar vacío lo suelta. Mientras no hay nada elegido, el rótulo dice
«Clic en un bot para inspeccionarlo».

Con un bot elegido, el rótulo de arriba a la izquierda muestra su número y su
especie, más dos botones:

- **Seguir**: la cámara lo acompaña. Si estabas lejos, se acerca sola. Arrastrar
  el mundo, moverlo con las flechas o encuadrar todo deja de seguirlo.
- **×** (**Quitar la selección**): lo suelta.

Si el bot muere mientras lo mirás, el inspector lo avisa y conserva sus últimos
datos.

## El tiempo {#tiempo}
<!-- web2/src/screens/Observar.svelte (barra); lib/sim/sesion.svelte.js VELOCIDADES [1,10,100,0], velocidad inicial 10; i18n mundo.iniciar, mundo.pausar, mundo.unCiclo, mundo.velocidad.* -->

Los tres primeros controles de la barra manejan el tiempo:

- **Iniciar** / **Pausar**: arranca o detiene la simulación.
- **Un ciclo**: avanza exactamente un ciclo. Sirve en pausa para ver, paso a
  paso, qué hace un bot (con el inspector abierto, los genes que corrieron se
  actualizan en cada paso).
- **Velocidad**: cuántos ciclos corre la simulación por cada cuadro que dibuja:
  **× 1**, **× 10** (la de arranque), **× 100** o **Máx.**, que corre tan rápido
  como puede y dibuja cuando alcanza.

A la derecha de la barra, un contador dice cuántos ciclos por segundo calcula
la simulación y cuántos cuadros por segundo dibuja. Con **× 1** ves cada ciclo;
con **Máx.** dejás que la evolución avance sin mirar cada paso. Lo que pasa en
cada ciclo está en [[simulacion/ciclo]].

## Las vistas {#vistas}
<!-- Observar.svelte selector «Vista»; lib/mundo/render-enriquecido.js (cabecera, ANILLOS, detalleBot, dibujarEventos), render-clasico.js (dibujarBotsClasicos, INDICADORES, flechas, dibujarVision); i18n mundo.vista.* -->

El selector **Vista** de la barra cambia cómo se dibujan los bots. No cambia la
simulación: solo el dibujo y algunos datos del panel.

**Enriquecida** (la de arranque). Cada animal es un círculo con una «nariz» que
marca hacia dónde mira; cada vegetal, un hexágono. El tono es el color de su
especie y el brillo sigue a su energía: un bot apagado está por quedarse sin
nada. Un tinte verde delata cloroplastos. Cuando un bot hace algo, lo rodea un
anillo breve de color (reproducirse, disparar, atar un lazo, fabricar defensas,
ganar energía…). Al acercarte aparecen detalles: el borde grueso del
caparazón, el halo de la baba, púas azules de veneno y amarillas de toxina, un
círculo interior en los que forman parte de un multibot, los ojos (los que ven
algo, en blanco) y el estado (paralizado, envenenado, con virus). Los
nacimientos destellan con una línea hasta la madre; los muertos se encogen y se
apagan, y el que se va por un teleporter deja un anillo cian.

**Clásica**. El dibujo de la interfaz original: círculos del color de la
especie, una línea hacia donde mira, flechas con el empuje de cada bot y anillos
finos que muestran sus reservas (energía, cuerpo, desechos, veneno, caparazón,
baba, toxina, virus y cloroplastos). Es la más liviana.

**Contorno**. Como la clásica, pero los bots son solo un contorno, sin relleno.
Ayuda a ver qué hay debajo cuando están amontonados.

En las tres, el bot elegido muestra su rastro y su rejilla de visión: nueve
arcos cian, el del ojo de foco en rojo (ver [[simulacion/vision]]).

:::nota
Algunos datos solo se calculan en la vista enriquecida: el nombre de cada
especie (en la clásica se agrupan por color), las extinciones, la generación
máxima, el tooltip y el «color por». El panel y el inspector lo avisan cuando
falta.
:::

### El tooltip {#tooltip}
<!-- Mundo.svelte actualizarTip; i18n mundo.tip.*, mundo.tipo.*, mundo.accion.* -->

En la vista enriquecida, al pasar el puntero sobre un bot aparece una ficha
breve: su especie, su número, si es animal, vegetal o cadáver (y si es parte de
un multibot), su energía, cuerpo y edad, su generación, mutaciones, largo del
ADN, víctimas ([[.kills]]) y lazos, y lo que hizo en el último segundo.

### Color por {#color-por}
<!-- render-enriquecido.js LENTES; Mundo.svelte leyenda (RAMPA_CSS, rango min/max, mundo.lente.sinReferencia); i18n mundo.lente.* -->

En la vista enriquecida, el selector **Color por** cambia el tono de los bots
para mostrar un dato en vez de la especie:

| Opción | Qué pinta |
|---|---|
| **Especie** | el color de cada especie (lo normal) |
| **Energía (nrg)** | [[.nrg]] |
| **Cuerpo (body)** | [[.body]] |
| **Generación** | cuántas generaciones tiene detrás |
| **Mutaciones** | cuántas mutaciones acumuló |
| **Edad** | ciclos de vida |
| **Largo del ADN** | cuántas instrucciones tiene su ADN |
| **Distancia genética** | cuánto difiere su ADN del bot elegido |

Con cualquier dato que no sea la especie aparece una leyenda con una escala de
colores y los valores mínimo y máximo entre los vivos. La **Distancia
genética** se mide contra el bot elegido; sin bot elegido, la leyenda lo avisa.
El inspector tiene un botón que la enciende de una vez
([[app/inspector#acciones]]).

## El panel En vivo {#en-vivo}
<!-- lib/observar/PanelVivo.svelte (VENTANA 1000, tarjetas); i18n observar.panel.*, observar.tarjeta.* -->

La pestaña **En vivo** del panel lateral muestra el ciclo actual y cuatro
tarjetas:

| Tarjeta | Qué dice |
|---|---|
| **Bots vivos** | cuántos hay, y cuánto subió o bajó en los últimos 1000 ciclos |
| **Especies** | cuántas hay vivas y cuántas se extinguieron |
| **Energía media** | la [[.nrg]] promedio por bot |
| **Generación máx.** | la generación más alta entre los vivos, y de qué especie es |

### Población por especie {#grafico}
<!-- lib/observar/GraficoPoblacion.svelte; metricas.js INTERVALO_MUESTRA 100, MAX_MUESTRAS 240 (al pasarse, una de cada dos e intervalo ×2), capasApiladas maxCapas 7 (más de 7: slice(0, 6) + otras); i18n observar.grafico.* -->

Debajo, un gráfico de áreas apiladas muestra cuántos bots de cada especie hubo
a lo largo de la corrida. Toma un punto cada 100 ciclos, así que aparece con el
segundo punto. Cuando la corrida se hace larga, junta los puntos de a dos para
que el gráfico abarque todo. Con siete especies o menos las muestra todas; con
más, dibuja las seis que más bots llegaron a tener y junta el resto en
**Otras**. La leyenda dice cuántos bots
tiene ahora cada una.

### Eventos {#eventos}
<!-- lib/observar/FeedEventos.svelte (max 40); detector-eventos.js (MIN_PICO 10, CAIDA_PICO 0.1, hitoGeneracion, especiesNuevas); i18n observar.evento.* -->

La lista **Eventos** anota lo importante de la corrida, lo más nuevo arriba y
con su ciclo:

- **lo que pasa en el mundo**: una especie que se extingue, un pico de población
  (de diez bots o más, anotado cuando la población ya bajó), una generación
  récord (cada una hasta la 10, después de a cinco hasta la 50 y luego de a
  diez), una especie que llega por un teleporter o una especie nueva que nadie
  sembró;
- **lo que hacés vos**: una corrida nueva (con su semilla), una siembra, un
  cambio de parámetros en caliente, una orden de la barra **Mundo**, y cada vez
  que guardás, retomás o abrís un archivo.

El enlace **Ver análisis completo** abre [[app/analizar]] con mucho más:
métricas, especies, árbol genealógico e informes.

## Sembrar {#sembrar}
<!-- lib/observar/DialogoSembrar.svelte (presets, elegirBot: 5 / 15 si vegetal, 3000; tope 500); corrida-nucleo.js sembrar (evento 'siembra'); i18n observar.sembrar.*, bots.selector.opcion -->

**Sembrar** agrega bots de una especie al mundo que está corriendo, sin
reiniciarlo. Sirve para meter un depredador en un mundo tranquilo, reponer una
especie que se extinguió o probar un bot nuevo contra los que ya están.

1. Hacé clic en **Sembrar** en la barra.
2. En **Bot**, elegí de dónde sale el ADN:
   - **Un bot de la biblioteca…**: buscalo por nombre, archivo, etiqueta o nota.
     Toma su nombre, si es vegetal, 5 copias (15 si es vegetal) y un color que no
     esté en uso.
   - **Animal Minimalis (animal simple)** o **Alga Minimalis (vegetal)**: los dos
     bots mínimos de siempre.
   - **Pegar el ADN…**: aparece un cuadro para pegar el código.
3. Revisá **Nombre de la especie**, **Cantidad** (de 1 a 500), **Energía inicial**
   y **Color**, y marcá **Vegetal (hace fotosíntesis)** si corresponde (ver
   [[simulacion/cloroplastos]]).
4. Hacé clic en **Sembrar**.

Los bots aparecen enseguida y la siembra queda anotada en
**Eventos**. Las especies sembradas mutan con las tasas de fábrica, como las
del escenario (ver [[simulacion/mutaciones#quien-muta]]).

:::nota
La siembra queda registrada en la corrida con su ciclo exacto: si después
repetís la corrida, se vuelve a sembrar en el mismo momento. Lo mismo pasa con
los cambios de parámetros que hagas desde [[app/experimentar]] y con las
órdenes de la barra **Mundo**.
:::

## La barra Mundo {#mundo}
<!-- lib/observar/objetos/BarraMundo.svelte; Mundo.svelte teclaBorrar (N, Mayús+N, Supr/Retroceso/Intro, Esc); i18n mundoObj.json -->

**Mundo** abre, sobre el campo, una barra para poner y sacar obstáculos y
teleporters mientras la simulación corre:

- **Tamaño**: ancho × alto de las formas nuevas, como fracción del campo (más de
  0 y hasta 1).
- **Obstáculo** agrega una forma de ese tamaño en un lugar al azar; **+10 al
  azar** agrega diez; **−10 al azar** borra diez.
- **Laberinto** agrega las formas de un laberinto: **Horizontal**,
  **Vertical**, **Espiral**, **Damero**, **Polar** (placas que derivan) o
  **Escombros** (dos paredes que se cierran). **Pasillo** y **Muro** fijan el
  ancho de los pasillos y el grosor de los muros.
- **Teleporter** agrega uno en un lugar al azar, hasta el máximo que admite el
  motor.
- **Borrar** activa el modo borrar: un clic sobre una forma o un teleporter lo
  quita. Con el mundo enfocado, `N` y `Mayús+N` recorren los objetos, `Supr`
  borra el resaltado y `Esc` sale del modo.
- **Borrar todo** quita **Todas las formas** o **Todos los teleporters**,
  después de preguntar.
- **Guardar en el escenario** pasa los objetos actuales al escenario de la
  corrida, para que [[app/experimentar]] los muestre y una corrida nueva los
  ponga otra vez. Una corrida abierta de un archivo no tiene escenario donde
  guardarlos.

Cada orden queda registrada en la corrida y se repite en el mismo ciclo al
repetirla. Cómo afectan los obstáculos a los bots está en [[simulacion/mundo]].

## Guardar y retomar {#guardar}
<!-- revisor: engine/corridas.js MAX_CORRIDAS 20; marcar() existe en el motor pero ningún control de la app lo usa, por eso no se nombran las «marcadas» -->
<!-- lib/observar/DialogoGuardar.svelte, DialogoCorridas.svelte; Observar.svelte guardar/cargar/abrirArchivo/puedeDescartar; i18n observar.guardar.*, observar.corridas.*, observar.aviso.* -->

**Guardar** abre un diálogo con un **Nombre** y estas opciones:

- **Guardar en el navegador**: guarda la corrida en este navegador, con su
  escenario, su semilla y sus eventos. Se conservan las últimas 20 corridas;
  al pasarte, se borran las más viejas y la app te avisa cuántas.
- Si la corrida ya estaba guardada, el botón dice **Actualizar la guardada** y
  aparece **Guardar como nueva**, que deja una copia aparte sin tocar la otra.
- **Descargar .dbsim**: baja el estado completo de la simulación a un archivo,
  para llevarlo a otro equipo o compartirlo.

**Corridas** abre la lista de lo guardado, con una miniatura, el ciclo, los bots
y la fecha de cada una. **Retomar** la carga en pausa (hacé clic en **Iniciar** para
seguir), **Borrar** la elimina y **Abrir un archivo .dbsim…** carga uno desde
tu equipo. La que está cargada lleva la marca **la actual**.

Si la corrida en pantalla tiene cambios sin guardar, retomar otra o abrir un
archivo te pregunta antes de descartarlos. Qué guarda cada formato está en
[[tecnico/formatos]]; dónde queda lo guardado, en [[app/tus-datos]].

## Buscar el mejor {#mejor}
<!-- Observar.svelte buscarMejor; engine/sim.js 'findbest' → api.fittest; core database.hpp SnapshotFitness (intFindBestV2); opciones.js opt:96 -->

**Buscar el mejor** elige al bot más apto de la simulación y abre su
inspector. La aptitud combina su descendencia con su energía y su cuerpo; cuánto
pesa cada parte lo fija el parámetro [[param:opt:96]]. Los vegetales no cuentan: si solo hay
vegetales, la app avisa que no hay candidatos.

## Instantánea {#instantanea}
<!-- lib/observar/MenuInstantanea.svelte; inspector/veterano.js ARCHIVOS_MUERTOS, archivosVivos; opciones.js opt:111, opt:112; i18n observar.snp.* -->

El menú **Instantánea** baja datos de la corrida a tu equipo:

- **Imagen del mundo (PNG)**: el campo tal como se ve ahora.
- **Instantánea de los vivos (.snp)**: una ficha de cada bot vivo, con su ADN,
  su generación, sus mutaciones, su descendencia y su aptitud. Con **Con el
  detalle de mutaciones** marcado, baja además un `_Mutations.txt` con la
  historia de mutaciones de cada uno.
- **Registro de muertos**: con **Registrar los muertos** encendido, la simulación guarda una ficha de cada bot que muere;
  **Sin vegetales** deja afuera a los vegetales. El menú
  dice cuántos registros lleva acumulados; **Descargar** los baja
  (`DeadRobots.snp` y `DeadRobots_Mutations.txt`) y **Reiniciar** los borra.

Las dos casillas del registro de muertos son los parámetros
[[param:opt:111]] y [[param:opt:112]], y tocarlas es un cambio en caliente:
queda anotado en la corrida. Durante un partido F1 no se pueden cambiar. El formato
de los `.snp` está en [[tecnico/formatos]].

## Player Bot {#jugador}
<!-- lib/observar/IndicadorJugador.svelte; lib/inspector/jugador.svelte.js; i18n observar.pb.* -->

Desde la pestaña **Control** del inspector podés manejar un bot con el teclado
y el mouse (ver [[app/inspector#control]]). Mientras el modo está encendido,
un indicador sobre el mundo dice **Player Bot activo** y a quién controlás, con
un botón **Salir** (o `Esc`). Si no hay ningún bot bajo control, un clic sobre
uno lo toma.

Lo que hagas en este modo no queda en la corrida: al repetirla no se repite.

## Torneos {#tv}
<!-- Observar.svelte (auto); lib/observar/tv/ (RotuloTv, PeleaTv, tv.svelte.js: pararTv, abandonarPelea, alTerminar, hayTorneoEnCurso, irAFranja; avance.js; FranjaTorneo.svelte: reanudarTv; AvisoTorneo.svelte); i18n observar.tv.*; PLAN-TORNEO-EN-CURSO.md TC1 a TC4 -->

Las peleas de un torneo se juegan en Observar: se empiezan con **▶ Jugar** en
[[app/competir#jugar]]. Antes de cada pelea, una cortinilla anuncia quién
pelea contra quién. Durante la pelea se ve el marcador. Al terminar, un
respiro muestra al ganador, y al cerrar la temporada, al campeón.

Los controles del torneo están en la [[app/observar#franja|franja]] de arriba y, a
pantalla completa (donde la franja no se ve), sobre el campo, arriba:

- **Cortinilla (s)**: los segundos de pausa entre peleas (de 0 a 60).
- **Al terminar la pelea**: qué hace el torneo cuando termina cada pelea.
  Con **parar** juega solo esa; con **seguir hasta el final de la temporada**
  sigue hasta anunciar al campeón; con **seguir con nuevas ediciones** sigue
  después con otra edición, en bucle (con los mismos participantes si el
  torneo es de lista fija; si no, con sorteo nuevo). Se puede cambiar
  mientras se juega.
- **Parar al terminar la pelea**: la pelea en juego sigue y se registra; después
  el torneo no avanza más. Mientras espera, **Seguir** lo deja sin efecto. Si
  no hay ninguna pelea en juego (en la cortinilla, por ejemplo), el botón dice
  **Parar** y para enseguida.
- **Abandonar la pelea**: corta la pelea en juego sin registrarla, después de
  confirmar, y el torneo deja de avanzar.

Mientras dura el torneo, la pestaña **Torneo** del panel lateral muestra el
torneo y cuánto falta de la temporada, la pelea con su marcador, el ciclo y, si
el torneo tiene tope de ciclos, una barra fina que muestra cuánto va de la ronda
(o, entre peleas, la próxima, el campeón o el error que lo paró), la tabla de la
temporada y los últimos resultados, y lleva al torneo en Competir. Con
**▤ Datos**, la tabla es la completa de Competir y debajo está la estructura
del formato (las jornadas, el cuadro de la copa, las rondas del suizo…), de
solo lectura.

Con **▣ Campo**, sin panel, la tarjeta de la pelea va sobre el campo, abajo a
la derecha: `M` la oculta o la muestra, para mirar sin nada encima. Con
**▤ Datos**, el campo en miniatura no lleva la cortinilla ni los controles: la
pelea se sigue en la pestaña **Torneo**, y **Al terminar la pelea**, **Parar**
y **Abandonar la pelea** están en la [[app/observar#franja|franja del torneo]].

Mientras dura el torneo, **Sembrar**, **Mundo**, **Guardar**, **Corridas** y
el [[app/observar#jugador|Player Bot]] no se muestran: cambiarían la pelea.
En su lugar, la barra de abajo tiene **🏆 Controles del torneo**, que lleva a la
franja. La velocidad, la pausa, la vista, el color, el zoom, **Buscar el
mejor** y la **Instantánea** siguen como siempre. En el resto de la app pasa
lo mismo con todo lo que reemplazaría la simulación (ver
[[app/competir#en-curso]]).

### La franja del torneo {#franja}
<!-- TC5 (teléfono, ≤ 640 px): FranjaTorneo.svelte .mas/.controles, tv.controles (irAFranja los despliega); RotuloTv .cab solo a pantalla completa; competir/marcador.js ANGOSTA, plegadoInicial, flotanteVisible -->

El torneo sigue aunque vayas a otra sección. Mientras dura, debajo de la barra
superior se ve, en todas las pantallas, una franja con el torneo, la edición,
cuánto falta de la temporada y qué está pasando: la cortinilla, **EN VIVO**,
el ganador. Tiene **Ver**, que te trae a Observar, **Al terminar la pelea** y
los mismos botones para parar o abandonar la pelea. Los botones **Controles del
torneo** de las otras pantallas te traen hasta acá, y la franja se ilumina un
momento.

En un teléfono la franja ocupa un solo renglón: **Al terminar la pelea** y los
botones para parar o abandonar se despliegan con **Controles ▾** (en
Observar, junto con **Cortinilla (s)**), y **Controles del torneo** los
despliega solo. Sobre el campo los controles van solo a pantalla completa,
donde la franja no se ve; si no, se repetirían y taparían el campo. Tampoco aparece el marcador
flotante de las otras secciones: **Ver** te trae a mirar la pelea.

Si recargás la página con un torneo en curso, la pelea que se estaba jugando
se corta y no se registra. El torneo no sigue solo: la franja ofrece
**Reanudar**, que sigue desde la próxima pelea, o **Descartar**.

## Si algo sale mal {#avisos}
<!-- Observar.svelte aviso (no error: 6 s); i18n observar.aviso.*, mundo.errorCarga.* -->

Los avisos aparecen sobre la barra de abajo. Los informativos (corrida guardada,
corrida retomada, palabras del ADN que no se reconocen) se van solos a los pocos
segundos; los errores quedan hasta que
los cerrás con **✕**. Si el motor de la simulación no carga, revisá la conexión
y recargá la página. Si el navegador se queda sin espacio para guardar, borrá
corridas viejas desde **Corridas**.
