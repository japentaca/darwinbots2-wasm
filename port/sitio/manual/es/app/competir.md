---
titulo: Competir
resumen: "Partidos y torneos entre bots: el partido rápido, el asistente de torneos, los seis formatos, las reglas del partido, la tabla con Elo, las temporadas, el Salón de la fama y cómo se juega."
etiquetas: [torneos, competir, elo, partido, jugar]
estado: revisada
---
En **Competir** los bots pelean entre ellos con reglas fijas y la app lleva la
cuenta: quién ganó cada partido, con qué semilla, la tabla de la temporada y
un Elo que sigue de un torneo a otro. Sirve para saber si tu bot es mejor que
otro, y no solo para verlo un rato en [[app/observar]].

<!-- web2/src/screens/Competir.svelte; i18n/es/competir.json; PLAN.md decisiones 21-23 -->

La pantalla tiene tres columnas:

- **A la izquierda**, la lista: **Nuevo torneo**, el **⚡ Partido rápido**,
  **Mis torneos** y, abajo, el **Salón de la fama**, con **Importar .json** y
  **Exportar**.
- **En el medio**, el torneo abierto: su nombre, el formato, cuántos bots y en
  qué temporada va, y sus pestañas.
- **A la derecha**, **Jugar**: la próxima pelea, los botones para jugarla y el
  último partido.

## Partidos, rondas y temporadas {#conceptos}
<!-- competir.campo.rounds.ayuda, competir.regla.*, competir.campo.cap.ayuda; engine/rondas.js (escenario efectivo: reglas + alga de arranque + luchadores); partido.js ALGA_ARRANQUE -->

Tres palabras que se usan en toda la sección:

- Una **ronda** es un mundo nuevo con los luchadores sembrados. La gana la
  última especie en pie. Si la ronda llega al tope de ciclos, la gana la
  especie con más bots o con más energía, según la regla que elijas.
- Un **partido** es una serie de rondas. Con _N_ rondas mínimas, gana quien
  junta más de √N + N/2 victorias de ronda. Si nadie llega, se juega otra
  ronda. Con **Victorias para ganar**, la primera especie que llega a esa
  cantidad se lleva el partido enseguida.
- Una **temporada** es una vuelta completa del formato: todos los partidos que
  hacen falta para tener un campeón. Un torneo puede tener muchas temporadas.

En cada ronda, además de los participantes, el mundo arranca con 15 algas
(Alga Minimalis) sembradas como vegetales, igual que en la interfaz clásica.
Las algas no cuentan como luchadores, y los bots vegetales no se pueden
inscribir.

## El partido rápido {#rapido}
<!-- competir.rapido.*; engine/torneos.js «El Scratch no se guarda (vive en memoria hasta Save as tournament)» -->

El **⚡ Partido rápido** es para probar sin armar nada: todos juntos en un
mismo mundo, hasta 20 bots. No se guarda. Si recargás la página, se pierde.

1. Hacé clic en **⚡ Partido rápido** en la lista.
2. En la pestaña **Participantes**, hacé clic en **Inscribir desde la Biblioteca**,
   buscá los bots y hacé clic en **Inscribir**.
3. En **Jugar**, hacé clic en **▶ Jugar**.

Si el resultado te interesa, escribí un nombre y hacé clic en **Guardar como torneo**:
pasa a **Mis torneos** con sus partidos. **Vaciar** quita los participantes y
los partidos.

También podés inscribir un bot desde su ficha, con **Inscribir en torneo**
(ver [[app/bots#torneo]]).

## Crear un torneo {#asistente}
<!-- lib/competir/Asistente.svelte, asistente.js (nuevoAsistente: suizo, lista fija, pool all, n 8, reglas F1); competir.nuevo.*, competir.entrantes.* -->

**Nuevo torneo** abre un asistente de tres pasos. Abajo tenés **Atrás**,
**Cancelar** y el botón para seguir.

1. **1 · Formato.** Elegí cómo se enfrentan (ver la tabla de abajo) y
   completá sus opciones. El **Nombre** es opcional: vacío, queda «Torneo N».
2. **2 · Participantes.** Elegí el modo:
   - **Lista fija**: los que elijas. Pasan iguales a la temporada siguiente.
   - **Sorteo en cada temporada**: N bots del pool, sorteados de nuevo en cada
     temporada.
   - **Sorteo en cada pelea**: los luchadores salen del pool al jugar cada
     pelea. El mundial no admite este modo.

   Los bots salen de la [[app/bots|Biblioteca]]: buscalos por nombre, filtrá
   por **Origen** (**del foro** o **propios**), agregá una selección guardada
   con **Agregar una selección…** o sorteá N con **🎲 Sortear**. El _pool_
   puede ser toda la Biblioteca, tus favoritos, la selección actual, una
   etiqueta o una selección con nombre.
3. **3 · Reglas.** Elegí el mundo y los valores del partido (ver
   [[app/competir#reglas|más abajo]]).

**Crear el torneo** lo guarda y lo abre. El asistente avisa si algo no
cierra. Por ejemplo, un mundial necesita 8, 16 o 32 participantes, y en un
todos contra todos con muchos bots te dice cuántos partidos van a ser.

:::nota
El ADN de cada participante **se congela al inscribirse**. Si después
editás el bot, el torneo sigue con la versión que tenía. Así las repeticiones
de partidos viejos siguen valiendo.
:::

## Los formatos {#formatos}
<!-- competir.formato.*, competir.campo.*; engine/league.js LG_FMT_DEFAULT, LG_FMT_FIELDS, LG_MAX_FIGHTERS, LG_KOTH_CAP, lgSwissRounds; README «Torneos (E10, E11 y E12)» -->

| Formato | Cómo se juega | Opciones |
|---|---|---|
| **Partido único** | Todos en el mismo mundo, hasta 20. Si hay más, juegan los primeros 20. Es el concurso F1 de siempre. | — |
| **Rey de la colina** | El ganador se queda y recibe a los retadores siguientes. | **Luchadores por pelea** (2 a 20), **La temporada termina**, **El rey se retira a las** (5 victorias seguidas por defecto), **Sin repetir retadores** |
| **Todos contra todos** | Cada uno contra cada otro, por el método del círculo. | **Vueltas**: 1, o 2 con el orden de siembra invertido |
| **Escalera** | Entran de a uno, en el orden de inscripción. El primero ocupa el peldaño 1; cada aspirante desafía de arriba hacia abajo y, si gana, se queda con ese peldaño. | — |
| **Mundial** | Grupos de 4 a todos contra todos; pasan los 2 primeros de cada grupo a un cuadro de eliminación directa (1A–2B, 1B–2A…). 8, 16 o 32 bots. | **Vueltas de la fase de grupos**, **Bombos** (**por Elo** o **al azar**), **Partido por el 3.er puesto** |
| **Suizo** | Rondas de duelos entre bots con el mismo puntaje, sin repetir rival. Pensado para 16 a 32 bots. | **Rondas (0 = automático)** |

Algunos detalles de cada uno:

- **Rey de la colina.** El primero que gana las victorias seguidas que
  pediste _se retira invicto_ y se lleva la temporada. Si nadie lo logra, la
  temporada termina a las 3 × N peleas y gana el de mejor Elo. Con **La
  temporada termina: nunca (colina sin fin)**, cada retiro suma una 👑 y la
  colina vuelve a abrirse. Manda quien junta más coronas. Con retiro en 0, el
  rey se queda hasta que pierde.
- **Mundial.** **Bombos por Elo** usa el Elo histórico del torneo (1500 para
  quien no tiene historial): un bot de cada bombo por grupo. Los grupos se
  sortean al lanzar el primer partido, o antes con **Sortear los grupos** en
  Participantes. Desempate en los grupos: duelo directo, Elo del grupo, menos
  rondas por tope, menos ciclos y el orden del sorteo.
- **Suizo.** En automático se juegan ⌈log2 N⌉ + 1 rondas: 4 con 8 bots, 5 con
  16 y 6 con 17 a 32. Victoria 1 punto. Con un número impar de bots, el de
  más abajo que todavía no lo tuvo recibe un _bye_, que vale 1 punto.
  Desempate: Buchholz (la suma de los puntos de los rivales), Elo y rondas
  ganadas por extinción. Los bots que se inscriben con la temporada empezada
  juegan desde la siguiente.

En ningún formato hay empates: un partido nulo se vuelve a jugar.

## Las reglas del partido {#reglas}
<!-- lib/competir/Reglas.svelte, EditorPartido.svelte; competir.reglas.*, competir.campo.*; LG_FMT_DEFAULT; partido-f1.json; PLAN.md decisión 21 -->

Las reglas tienen dos partes.

**Mundo**: los parámetros del mundo, sin especies.

- **Base F1**: los ajustes de liga F1. Costos, física y un campo de
  9237 × 6928 toroidal.
- **Sin costos**: la base F1 con todos los costos en 0. Los bots no gastan
  energía.
- **Desde Experimentar**: las opciones y los objetos de un escenario (de
  fábrica, propio o el **Borrador de Experimentar**), sin sus especies. Ver
  [[app/escenarios]].

**Valores del partido**:

| Valor | Por defecto | Qué hace |
|---|---|---|
| **Bots por especie** | 5 | Cuántos bots de cada participante se siembran en cada ronda. Cada participante puede tener su propia cantidad. |
| **Energía inicial** | 3000 | La energía de cada bot al empezar la ronda. |
| **Rondas mínimas** | 5 | El _N_ de la regla √N + N/2. |
| **Victorias para ganar (0 = no)** | 3 | La primera especie que llega se lleva el partido. Útil con 3 especies o más. |
| **Tope de ciclos por ronda (0 = no)** | 5000 | Lo más que dura una ronda. |
| **Al tope, la ronda es de** | la especie con más bots | O **la especie con más energía** (nrg + body × 10). |
| **Máximo de bots por especie (0 = no)** | 500 | Si una especie lo pasa, se quitan sus bots más pobres. Evita que uno que se reproduce sin parar frene el partido. |

En la pestaña **Reglas** del torneo, **Ver los cambios** lista en qué difiere
el mundo de su base. **Abrir en Experimentar** lo abre como borrador, para
mirarlo o retocarlo; el torneo no cambia.

:::cuidado
Formato, valores y reglas **quedan fijos desde el primer partido** de la
temporada (verás un 🔒). Mientras la temporada no tenga partidos, **Cambiar
formato y reglas** los deja editar. Para cambiarlos después, empezá una
temporada nueva.
:::

Los parámetros del mundo están explicados uno por uno en
[[app/experimentar-avanzado]]. Los del concurso F1 manual
([[param:opt:91]], [[param:opt:97]], [[param:opt:98]], [[param:opt:99]],
[[param:opt:100]]) los fija el torneo en cada partido; no hace falta tocarlos.

## Participantes {#participantes}
<!-- lib/competir/Participantes.svelte; competir.participantes.* -->

La pestaña **Participantes** muestra cada bot con su **Color**, su
**Origen** (del foro, propio, híbrido o de fábrica), su cantidad de **Bots** y
la huella de su ADN congelado. Ahí también podés:

- inscribir más con **Inscribir desde la Biblioteca**;
- cambiar el color o la cantidad de uno (vacío = la del formato);
- quitar a uno con **Quitar**, si todavía no jugó en esta temporada;
- cambiar el modo de **Participantes** y, en los modos con sorteo, el pool y
  **Cuántos**; **Sortear** reemplaza la lista por un sorteo nuevo.

Con la temporada empezada, el sorteo queda bloqueado hasta la temporada
siguiente.

## Jugar {#jugar}
<!-- lib/competir/PanelJuego.svelte; juego.js vigiaPartido; competir.jugar.*; PLAN.md decisión 23 -->

La columna **Jugar** dice cuánto falta de la temporada y quiénes pelean
después. Hay dos formas de avanzar.

**▶ Jugar** lanza el próximo partido en la simulación de la app y te lleva a
Observar, con una cortinilla antes de cada pelea (5 segundos por defecto, se
cambia de 0 a 60). Debajo, **Al terminar la pelea** elige hasta dónde sigue:

| Opción | Qué hace |
|---|---|
| **parar** | Juega una pelea y para. |
| **seguir hasta el final de la temporada** | Sigue con las peleas que falten y para después de anunciar al campeón. Es la opción por defecto. |
| **seguir con nuevas ediciones** | Al terminar la temporada, empieza otra con sorteo nuevo y sigue, en bucle. |

Cada pelea se registra en el torneo. La elección se recuerda en este
navegador y se puede cambiar mientras se juega, desde el rótulo de Observar
(ver [[app/observar#tv]]). Ahí también están **Parar al terminar la pelea** y
**Abandonar la pelea**. El torneo sigue aunque vayas a otra sección: una
franja debajo de la barra superior lo muestra en todas las pantallas (ver
[[app/observar#franja]]).

**▶ Jugar** juega la temporada abierta con los participantes que tiene, aunque
todavía no haya empezado: no los vuelve a sortear. Las ediciones nuevas de
**seguir con nuevas ediciones** sí se sortean del pool del torneo. Para
mirarlo como en la tele, Observar tiene
[[app/observar#pantalla|pantalla completa]].

Mientras hay un partido en juego, esta columna muestra el marcador con la
ronda, el ciclo, los **Bots vivos** y las **Rondas ganadas** de cada uno.
**Mirar en Observar** te lleva a mirarlo, y **Abandonar** lo corta sin
registrarlo. En las otras secciones, un marcador flotante muestra lo mismo;
podés plegarlo, o volver con **Ir a Competir** (en un teléfono arranca
plegado y, con un torneo en curso, deja el lugar a la
[[app/observar#franja|franja]]). Con un torneo en curso,
**Abandonar** pide confirmación y además detiene el torneo, como **Abandonar la
pelea** en la franja.

:::cuidado
El partido ocupa la simulación de Observar y reemplaza lo que hubiera ahí.
Mientras se juega, no siembres, no edites objetos ni cambies parámetros: si
la simulación recibe un cambio en caliente, el partido se abandona y no se
registra.
:::

**Ronda en segundo plano** juega de una vez todos los partidos que el formato
deja jugar sin esperar otros resultados. Por ejemplo, todo el calendario
pendiente de un todos contra todos o la ronda en curso del suizo. Los partidos
corren sin dibujar, a máxima velocidad y en varios workers a la vez. Como cada
partido usa su propia semilla, el resultado es el mismo que mirándolos. Avisa
al terminar. Mientras corre, la temporada queda bloqueada.
**Cancelar la ronda** la detiene. El partido rápido no juega rondas en segundo
plano.

### Con un torneo en curso {#en-curso}
<!-- PLAN-TORNEO-EN-CURSO.md TC4 (T8, T10); tv.svelte.js hayTorneoEnCurso, torneoEnCurso; torneos.svelte.js enCursoBloquea, abrir, inscribirSinAbrir; Competir.svelte congelado; Inicio, Experimentar, DialogoLote, Inspector (consola.js MODIFICAN), DisenadorOjos; i18n competir.enCurso.*, observar.tv.enCurso.* -->

Mientras un torneo se juega, la simulación de la app es la de su pelea y el
torneo abierto es ese. Por eso, hasta que lo detengas (desde la franja o con
**Abandonar**):

- **El torneo queda de solo lectura**: participantes, reglas, sorteos, el
  nombre, la temporada nueva, ↻ y **Repetir y analizar**, **Vaciar** y
  **Borrar**. Un aviso arriba lo explica, con **Controles del torneo**.
- **No se abre otro torneo**: los demás se ven en la lista, más tenues, pero
  no se abren, porque abrir otro cortaría el que se juega. Tampoco se crea
  uno con **Nuevo torneo** ni se importa un .json (los dos abren el nuevo).
- **No se juega otra cosa**: no se pide una **Ronda en segundo plano** de este
  torneo. Una ronda de otro torneo pedida antes sigue corriendo.
- **En [[app/inicio]] y [[app/experimentar]]**, lo que reemplaza la simulación
  (iniciar un escenario, retomar una corrida, abrir un archivo, **Nueva
  simulación**, **Aplicar a la actual**) queda apagado, con el aviso «Hay un
  torneo en curso: detenelo para usar la simulación» y **Controles del
  torneo**. En [[app/bots]] pasa lo mismo con **Sembrar en la corrida actual**.
- **En el [[app/inspector]]** no aparece el Player Bot, el diseñador de ojos
  solo lee los ojos y arma el gen, y la consola no manda los comandos que
  cambian la pelea (`set`, `energy`, `cycle`, `execrob`, `play` y `pause`).
- **[[app/bots]] y [[app/analizar]] siguen libres.** **Inscribir en torneo**
  no ofrece el torneo en curso, e inscribe en los otros sin abrirlos.

<!-- engine/torneos.js lgEdition (con {sortear: false} desde tv.svelte.js; temporada terminada: lgNewSeason draw); tv/maquina.js PAUSA_DEF 5, PAUSA_MAX 60 -->

## Tabla, estructura y partidos {#tabla}
<!-- lib/competir/Tabla.svelte, Estructura.svelte, Partidos.svelte; vistas.js vistaEstructura; engine/league.js lgElo (K = 32 / (N − 1)), LG_ELO0, LG_H2H_MAX 14 -->

Las pestañas del torneo son **Tabla**, la vista del formato, **Partidos**,
**Participantes**, **Reglas** y **Temporadas**.

**Tabla**: posición, partidos jugados (**PJ**), ganados (**G**), perdidos
(**P**), porcentaje, **Por tope** (la parte de las rondas ganadas que decidió
el tope de ciclos), **Ciclos prom.**, **Elo** y los **Últimos** resultados.
El suizo suma **Pts** y **Buchholz**, y la colina sin fin, las 👑. Debajo,
el orden de desempate del formato y, hasta con 14 participantes, los
**Enfrentamientos directos**.

El **Elo** arranca en 1500. En una pelea de N, el ganador le gana a cada uno
de los demás con K = 32 / (N − 1). Así una pelea de muchos no vale más que un
duelo.

La **vista del formato** cambia de nombre:

| Formato | Pestaña | Muestra |
|---|---|---|
| Suizo | **Rondas** | Cada ronda con sus cruces y el bye |
| Mundial | **Grupos y cuadro** | Los bombos, las tablas de grupo y el cuadro |
| Rey de la colina | **Peleas y coronas** | El rey, su racha y las coronas |
| Escalera | **Escalera** | Los peldaños y quién desafía |
| Todos contra todos | **Calendario** | Las jornadas |

**Partidos** lista cada partido con su ganador, ciclos, rondas por tope y
**Semilla**. Dos acciones:

- **↻ Repetir** vuelve a jugar el partido con las mismas reglas,
  participantes, orden de siembra y semilla, y avisa si el resultado no
  coincide.
- **Repetir y analizar** lo vuelve a correr como una corrida y lo abre en
  [[app/analizar]]. No se registra.

La semilla es lo que hace repetible un partido: ver [[tecnico/semillas]].

## Temporadas {#temporadas}
<!-- lib/competir/Temporadas.svelte; competir.temporadas.*, competir.temporada.* -->

Cuando la temporada termina, **Jugar** muestra al campeón y un botón para
**Empezar la temporada N**, que pide confirmación. Si el torneo sortea
participantes, dice «(con sorteo)». La pestaña **Temporadas** tiene lo mismo
con **Nueva temporada**, la lista de temporadas (con **Ver** para abrir una
pasada) y la **Tabla histórica del torneo**: temporadas jugadas, ganadas, PJ,
G y un Elo que sigue de una temporada a otra.

Una temporada nueva desbloquea formato, valores y reglas. Los participantes
pasan iguales o se vuelven a sortear, según el modo.

## Salón de la fama {#salon}
<!-- lib/competir/Salon.svelte; competir.salon.* -->

El **Salón de la fama** junta todos los torneos guardados. Hay un renglón por
ADN: el mismo bot con otro nombre en otro torneo es el mismo renglón. Muestra
temporadas ganadas (🏆), torneos, temporadas jugadas, PJ, G, porcentaje y un
Elo único calculado sobre todos los partidos, en orden de fecha.
**Actualizar** lo recalcula.

## Informe, exportar e importar {#archivos}
<!-- competir.informe.*, competir.lista.* (competir.lista.archivos: clásica versión 1 y 2); README «Compartir»; lib/competir/migracion.svelte.js (al arrancar la app, src/main.js, una sola vez; aviso en Competir) -->

- **Informe del torneo** genera un informe `.html` de la última temporada:
  tabla, estructura del formato, Elo y partidos con sus semillas. Queda
  también en Analizar → Informes (ver [[app/informes]]).
- **Exportar** descarga el torneo abierto como `.json`, con sus reglas, sus
  participantes con el ADN y sus partidos.
- **Importar .json** lo carga como un torneo nuevo. Acepta también los
  archivos de torneo y de liga de la [[app/clasica|interfaz clásica]].

La primera vez que abrís la app nueva, copia los torneos de la interfaz
clásica de este navegador, y Competir te avisa qué trajo. Dónde se guarda todo y cómo
respaldarlo está en [[app/tus-datos]].

Para ideas de cómo se arma un bot que gane torneos, ver
[[estrategias/torneos]].
