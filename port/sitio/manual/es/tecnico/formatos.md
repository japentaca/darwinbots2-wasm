---
titulo: Formatos de archivo
resumen: "Qué es cada archivo que la app lee y escribe —el .txt de un bot, el .dbsim de una simulación, los .snp y los .json—, qué contiene por dentro y qué se reescribe al cargarlo."
etiquetas: [formatos, archivo, dbsim, snp, json, respaldo]
estado: revisada
---
La app trabaja con pocos formatos, y todos están pensados para que duren: se
pueden guardar, pasar a otra computadora y volver a abrir. Esta página es la
referencia de cada uno: qué es, qué contiene, con qué se abre y qué pasa
cuando la app lo carga. Cómo se exportan e importan desde cada pantalla está
en [[app/tus-datos]]; el formato del ADN en sí, en [[adn/formato]].

## De un vistazo {#tabla}
<!-- web2 src/lib/observar/descargas.js (nombreArchivo, descargar); i18n inicio.archivo.*, observar.guardar.*, observar.corridas.*, experimentar.*, competir.lista.*, bots.menu.*; port/web/index.html (Save sim/Load sim, .gsave); engine/league.js (lgFileName: .league.json) -->

| Archivo | Qué es | Quién lo escribe | Quién lo lee |
|---|---|---|---|
| `.txt` | El ADN de un bot, en texto | Vos y el [[app/editor\|editor]]; el motor, al exportar un bot vivo | El cargador de ADN, en la app y en la clásica |
| `.dbsim` | Una simulación guardada, en binario | [[app/observar]] (**Descargar .dbsim**) y la [[app/clasica\|clásica]] (**Save sim**) | La app (**Importar .dbsim**, **Abrir un archivo .dbsim…**) y la clásica (**Load sim**) |
| `.snp` y `_Mutations.txt` | Censo de los vivos y registro de los muertos | [[app/observar]] → **Instantánea** | Nadie dentro de la app: son texto para que lo leas vos |
| `.json` de escenario | La configuración de una simulación | [[app/experimentar]] (**Exportar**) | **Importar .json** de Experimentar, acá o en otro navegador |
| `.league.json` | Un torneo con sus participantes y partidos | [[app/competir]] (**Exportar**) | **Importar .json** de Competir (también la clásica) |
| `.json` de biblioteca | Tus bots con sus versiones y tus marcas | [[app/bots]] (**⋯** → **Exportar mis bots y marcas**) | **Importar biblioteca** de Bots (también el inventario de la clásica) |
| `.html`, `.csv`, `.json`, `eyes.txt`, `.png` | Salidas para leer aparte | [[app/informes]], Comparar y el inspector | Tu navegador, tu planilla, tu editor de texto |

## El .txt de un bot {#txt}
<!-- adn/formato.md (toda la mecánica del formato); Inicio.svelte abrirArchivo (.txt → escenario con algas); web/index.html Seed species -->

Todo bot es un archivo de texto: los del Bestiario (publicados en el foro y el
wiki), los que escribís vos y los que el motor reconstruye al exportar. Traer
uno a una simulación es sencillo: en [[app/inicio]], **Desde un archivo** con
extensión `.txt` lo siembra en un mundo con algas; un escenario los nombra en
sus especies; la clásica lo pega en el panel de siembra. Cómo lee el cargador
ese texto línea por línea —los comentarios, la cabecera `'#`, el hash— está
en [[adn/formato]], y no se repite acá.

## La simulación guardada (.dbsim) {#dbsim}

### Qué contiene {#dbsim-contiene}
<!-- 60-FORMATOS §4 (arquitectura de SaveSimulation: bots densos, SimOpts por capas, 5 pasadas de especies, Costs, teleporters, obstáculos, shots, MaxAbsNum, gráficas, sol, mareas); core formats.hpp SaveSimulation (UserSeedNumber, TotRunCycle, strSimStart, EnableAutoSpeciation y umbrales); robots.hpp ManageDeath (el cadáver sigue existiendo); wasm dbcore_api.cpp db_sim_save -->

El `.dbsim` es una fotografía completa del mundo en el ciclo en que lo bajaste:

- **los bots que existen en ese momento, cadáveres incluidos**: posición,
  rumbo y velocidad, energía, cuerpo, desechos, veneno, toxina, caparazón y
  baba, cloroplastos, edad, generación y mutaciones, especie y madre, la
  memoria entera, el ADN y los lazos (con el esperma recibido, si el bot
  estaba fecundado);
- los disparos en vuelo, los obstáculos y los teleporters;
- el registro de especies: nombre, color, si es vegetal, sus tasas de
  mutación;
- todos los parámetros y costos de la simulación, el ciclo actual, la semilla,
  la fecha de arranque, el sol y las mareas;
- el estado de la autoespeciación: si el archivo la trae encendida, con sus
  umbrales, el motor la cumple aunque la app no tenga un control para
  encenderla (ver [[simulacion/especies#autoespeciacion]]).

Es el mismo formato binario del DarwinBots original, que guardaba estos
archivos con el nombre `.sim`.

### Lo que no viaja y se reescribe al cargar {#dbsim-carga}
<!-- 60-FORMATOS §4 RV-40 (el registro de especie guarda ruta y nombre, no el ADN); core sim.hpp Specie::dnaMissing, master.hpp RobScriptLoadSim, vegs.hpp checkvegstatus (Native); web2 src/lib/sim/corrida-nucleo.js (dna-missing → dna-lib: escenario, siembras, bots propios del escenario, Bestiario; StartChlr y opciones 92–101 reescritas del escenario efectivo); i18n observar.aviso.error.sinAdn. 60-FORMATOS §4 RV-39; wasm dbcore_api.cpp CarryProcessGlobals. Quirk de mutaciones: core formats.hpp LoadSimulation (CInt(True) = −1: el flag DisableMutations cargado en True se resetea siempre); web2 engine/opciones.js (la casilla «Mutaciones» de Experimentar es este flag, invertido) -->

Tres cosas no están en el archivo, y al cargar se rellenan o se reescriben:

- **El ADN de cada especie.** El registro guarda el nombre, no el código. Al
  cargar, la app lo busca en lo que esta página sembró (el escenario de la
  corrida y tus siembras) y en el Bestiario. Si no lo encuentra, avisa con el
  nombre del bot: esa especie no puede volver a sembrarse ni a repoblar, aunque
  los bots que ya la llevan siguen bien, porque cada uno guarda su propio ADN.
- **Los cloroplastos iniciales y los ajustes de los modos de juego** (el
  reinicio, la descalificación, el F1…). En el original sobrevivían a la carga
  porque vivían en el programa, no en el archivo. Al retomar una corrida
  guardada con escenario, la app los reescribe con los del escenario; en un
  `.dbsim` abierto como archivo suelto valen los de la sesión.
- **El apagado global de las mutaciones.** El archivo lo guarda, pero el
  cargador del original lo encendía siempre (un detalle de cómo leía el
  indicador), y el port replica ese comportamiento: al cargar una simulación,
  las mutaciones quedan encendidas. Las tasas de cada especie sí viajan, así
  que solo tenés que volver a apagarlas si así lo querías.

Una cuarta no es del formato sino de la app: la historia de métricas, los
eventos y el linaje no van adentro del `.dbsim`; quedan con la corrida
guardada en el navegador, recortados al ciclo del archivo
(ver [[app/tus-datos]]). El `.dbsim` es el mundo, no la corrida entera.

### Retomar no es repetir {#dbsim-retomar}
<!-- wasm dbcore_api.cpp db_sim_load (Rnd -1 : Randomize UserSeedNumber/100: el generador se vuelve a sembrar con la semilla del archivo); web2 PLAN.md C17 (futuro válido pero no idéntico; el mismo archivo en cualquier worker sigue igual); probado (re-corrido con la API del wasm): sim guardada al ciclo 10, el buffer cargado en dos sims nuevas reproduce byte a byte la misma corrida en las dos, y ninguna sigue el futuro que habría tenido la original -->

El generador de azar tampoco viaja: al cargar, el motor lo vuelve a sembrar
con la semilla que trae el archivo. Por eso una corrida retomada sigue una
vida _válida_ pero no idéntica a la que habría tenido de no guardarla. Lo que
sí se garantiza: el mismo archivo, cargado en cualquier navegador, corre igual.
La mecánica completa de la semilla está en [[tecnico/semillas]].

### Una y otra interfaz {#dbsim-compat}
<!-- port/HISTORIA.md «Página web» (formato binario de VB6 como .dbsim); port/web/index.html (darwinbots-cycleN.dbsim; el selector de Load sim acepta .dbsim y .sim); wasm dbcore_api.cpp db_sim_save/db_sim_load compartidos por las dos orquestaciones (paridad byte a byte, PROGRESO E1) -->

La app y la clásica comparten motor y formato: un archivo de una se abre en la
otra. La clásica lo baja como `darwinbots-cycleN.dbsim` (_N_ es el ciclo) y su
selector también acepta archivos con la extensión vieja, `.sim`; por dentro es
lo mismo.

## Las instantáneas (.snp) {#snp}
<!-- core database.hpp (kSnpHeader, AppendSnpRecord: 14 columnas, el ADN detokenizado cierra cada registro; Snapshot/AddRecord = «Snapshot of the living» / «of the dead» de Database.bas); port/HISTORIA.md «Registro y análisis»; web2 MenuInstantanea.svelte + inspector/veterano.js (ARCHIVOS_MUERTOS DeadRobots.snp / DeadRobots_Mutations.txt; vivos <corrida>-<ciclo>.snp; deadTake → drain; deadReset) -->

El menú **Instantánea** de [[app/observar]] baja dos cosas:

- **Instantánea de los vivos (.snp)**: una ficha de cada bot vivo en el
  momento en que hacés clic en el botón, con su ADN completo. Con **Con el detalle de
  mutaciones** marcado baja además un `_Mutations.txt` con la historia de
  mutaciones de cada uno.
- **Registro de muertos**: con **Registrar los muertos** encendido, la
  simulación anota una ficha de cada bot que muere (es el parámetro
  [[param:opt:111]]; **Sin vegetales**, el [[param:opt:112]]). **Descargar**
  baja lo acumulado como `DeadRobots.snp` y `DeadRobots_Mutations.txt`, y el
  registro sigue; **Reiniciar** lo borra del todo.

Los vivos se bajan como `<corrida>-<ciclo>.snp`. Por dentro es texto plano,
como en el original:

```text
Rob id,Parent id,Founder name,Generation,Birth cycle,Age,Mutations,New mutations,Dna length,Offspring number,kills,Fitness,Energy,Chloroplasts

13,0,Animal Minimalis,2,1450,331,1,1,27,5,2,1045935.86,4300,0
 cond
 *93 1 <
 start
 5 .up store
 stop
```

Una línea de cabecera con las catorce columnas y, por cada bot, su línea de
números y debajo su ADN. «New mutations» son las propias del bot (no las
heredadas); «Energy» es su energía más diez veces su cuerpo; «Fitness» es la
misma aptitud que usa **Buscar el mejor**. Se abre con cualquier editor de
texto: sirve para quedarte con los ganadores de una evolución, compararlos o
analizarlos con tus propios programas. La app no los relee.

## Los .json de la app {#json}
<!-- escenarios: engine/escenarios/index.js (typedef: formato 1, id, nombre, etiquetas, destino, opciones base+cambios, especies con origen/hash/adn, objetos) y src/lib/experimentar/archivo.js (exportarEscenario JSON con sangría 2; importarEscenario renombra id ocupado o de fábrica); probado en el scratchpad: export de «Sopa primordial (copia)» y reimportación. Torneos: engine/league.js lgExportObj/lgImportObj (kind darwinbots-league, version 2, la 1 también se importa; entrants con dna; matches sin id ni liga), src/lib/competir/torneos.svelte.js (exportar/importar, nombre.league.json, «(importado)»); probado en el scratchpad. Biblioteca: engine/migracion.js (formato darwinbots2-biblioteca v1; también lee el darwinbots-inventario de la clásica) -->

### Escenarios {#json-escenario}

El `.json` de un escenario es texto con sangría, pensado para leerse y
editarse a mano: nombre, descripción y etiquetas; los parámetros como cambios
encima de una base (Clásica o Liga F1); las especies con su bot, cantidad,
color, marca de vegetal, energía inicial y una huella del ADN; y los objetos
del mundo. Los bots del Bestiario van por nombre y huella; los tuyos viajan
con su ADN adentro, así que el archivo funciona en cualquier navegador. Un
ejemplo entero, campo por campo, está en [[app/escenarios#archivo]]. Al
importar, si ya tenés un escenario con el mismo identificador, entra como uno
nuevo sin pisar el tuyo.

### Torneos {#json-torneo}

El `.league.json` lleva el torneo entero: cada temporada con sus reglas, su
formato y sus participantes —cada uno con el ADN congelado al inscribirse—, y
todos los partidos jugados. No hace falta tener los bots: el ADN viaja
adentro, así que se puede compartir con cualquiera. Al importar entra como
torneo nuevo (con «(importado)» si el nombre ya existía) y también se aceptan
los archivos que exporta la clásica.

### Tu biblioteca {#json-biblioteca}

El `.json` de Bots lleva todos tus bots propios con sus versiones, tus
favoritos, etiquetas, notas y selecciones con nombre. La importación suma sin
borrar nada, y también acepta el inventario exportado por la clásica. Los
detalles, en [[app/bots#importar]].

## Salidas para leer aparte {#salidas}
<!-- engine/report/plantilla.js (informe_<slug>_<fecha>.html, autocontenido); engine/export.js (csvLargo, jsonCorrida: historia + eventos + linaje + meta); src/lib/analizar/comparar/Barrido.svelte (_resumen.csv / _semillas.csv); src/lib/inspector/DisenadorOjos.svelte (eyes.txt); port/web/index.html (.gsave del original, solo la clásica; web2/PLAN.md decisión 5: la app lo reemplaza por el CSV) -->

- **Informe `.html`** ([[app/informes#archivo]]): un solo archivo
  autocontenido, con los gráficos y los datos embebidos; se abre sin conexión
  y se imprime en A4 desde el navegador.
- **Series · CSV** y **Todo · JSON** ([[app/informes#datos]]): las métricas de
  una corrida para tu planilla, o la historia, los eventos y el linaje
  completos. Los barridos de Comparar bajan sus propios CSV.
- **`eyes.txt`**: el gen que fija los ojos diseñados en el inspector, listo
  para pegar en un bot.
- **Imagen del mundo (PNG)**: el campo tal como se ve, desde Observar o el
  Panel de Analizar.
- **`.gsave`**: el volcado de texto de un gráfico del original. Solo existe en
  la clásica; la app lo reemplaza con el CSV.

## De dónde vienen estos nombres {#origenes}
<!-- 60-FORMATOS §1 (sidecar .mrate), §2 (registro binario de bot), §3 (.dbo de organismo); Darwinbots2/Master.bas:472 (el autosave del original era .sim); wasm dbcore_api.cpp (db_sim_save_organism/db_sim_load_organism: el .dbo es lo que viaja por Internet Mode, no una descarga; «el sidecar .mrate no se exporta») -->

:::nota
El original hablaba de `.sim` para la simulación (el port usa el mismo
formato con otro nombre, `.dbsim`) y de `.dbo` para un _organismo_: un bot o un
grupo atado que se manda entero de una simulación a otra. En el port el `.dbo`
existe, pero no es un archivo que bajes: es lo que viaja por el teleporter de
Internet Mode de la clásica. Dentro del `.dbsim` y del `.dbo` va el registro
binario de bot, que nunca fue un archivo aparte. Y las tasas de mutación de
cada especie, que el original guardaba en un `.mrate` al lado del bot, acá
viajan dentro del propio `.dbsim`: el port no usa ese archivo.
:::

## Qué respaldar {#respaldo}
<!-- engine/corridas.js (MAX_CORRIDAS = 20: se conservan las últimas 20 corridas y las marcadas); app/tus-datos -->

La regla práctica: exportá seguido lo que es barato de exportar y caro de
perder.

- **Tus bots** (el `.json` de la biblioteca) y **tus torneos**: son chicos y
  valen años de trabajo.
- **Las corridas que te importen**, con **Descargar .dbsim** antes de que la
  política de 20 las empuje afuera.
- **Tus escenarios** y los **informes** que quieras conservar.

Todo lo demás se vuelve a generar. Cómo hacerlo, y qué hace perder los datos
del navegador, está en [[app/tus-datos]].
