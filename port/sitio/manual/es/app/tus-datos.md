---
titulo: Tus datos
resumen: "Dónde guarda la app tus bots, corridas, escenarios, torneos y ajustes, cómo exportarlos y volver a importarlos, cómo borrarlos y qué los hace perder."
etiquetas: [datos, respaldo, exportar, importar, navegador]
estado: revisada
---
La app no tiene cuentas ni servidor: **todo lo tuyo se guarda en tu
navegador**, en la computadora que estás usando. Es cómodo, porque no hay que
registrarse, pero tiene una consecuencia: si ese navegador pierde los datos,
la app también. Esta página explica qué se guarda, cómo sacar una copia y
cómo traerla de vuelta.

<!-- web2/engine/almacen.js (base darwinbots2, STORES); PLAN.md decisión 17; inicio.nota -->

## Qué se guarda y dónde {#que-se-guarda}
<!-- engine/almacen.js STORES: bots, escenarios, corridas, corridas-datos, informes, torneos, partidos, trabajos, ajustes; engine/bots.js (selecciones en ajustes); engine/corridas.js (política de 20); lib/trabajos/ejecutores.js (replicas, barrido, ronda, prueba); claves de localStorage darwinbots2.tema, .idioma, .experimentar.modo, .trabajos.tope, .pb.teclas, .analizar.panel, cortinilla en tv.svelte.js KV_PAUSA -->

| Qué | Dónde lo creás | Detalle |
|---|---|---|
| **Bots propios** | [[app/bots]], [[app/editor]] | Cada bot con todas sus versiones. |
| **Marcas** | [[app/bots#marcas]] | Favoritos, etiquetas y notas, también de los bots del foro, y las selecciones con nombre. |
| **Escenarios propios** | [[app/experimentar]] | Los que guardaste con **Guardar como escenario**. |
| **Corridas guardadas** | [[app/observar]] | El mundo, su escenario, su semilla, sus eventos, la historia de métricas y el linaje. Se conservan las últimas 20. |
| **Informes** | [[app/informes]] | Los informes generados. |
| **Torneos** | [[app/competir]] | Reglas, participantes con su ADN, temporadas y todos los partidos. |
| **Trabajos** | [[app/informes#trabajos]] | Réplicas, barridos, rondas de torneo y pruebas del editor en segundo plano, con sus resultados. |
| **Preferencias** | toda la app | Tema, idioma, modo básico o avanzado, el tope de workers, la cortinilla y el «Al terminar la pelea» de los torneos y otras elecciones de la interfaz. |
| **Borradores del editor** | [[app/editor]] | Los cambios sin guardar de un ADN, para que sobrevivan a una recarga. |

Los bots del foro (el Bestiario) **no** son tuyos: vienen del sitio y se
cargan cada vez. Lo único tuyo de ellos son tus marcas.

La política de corridas es esta: al guardar una, si hay más de 20, se borran
las más viejas. Si una corrida te importa, descargala (ver abajo).

## De qué depende {#dominio}
<!-- PLAN-SITIO.md S3 (los datos dependen del dominio); S1 (/app/ y /classic/ en el mismo dominio); engine/migracion.js (mismo origen) -->

El navegador guarda los datos **por sitio**: lo que guardaste en
`darwinbots-wasm.org` solo lo ve la app abierta desde esa misma dirección, en
ese mismo navegador y con ese mismo perfil de usuario. Por eso:

- **Otro navegador u otra computadora** empiezan vacíos. Chrome no ve lo de
  Firefox, ni tu notebook lo de tu PC.
- **Otra dirección** también empieza vacía. Usá siempre la misma.
- **Una ventana privada o de incógnito** guarda mientras está abierta y lo
  borra al cerrarla. En algunos navegadores no deja guardar nada, y la app
  avisa que no puede guardar datos.
- **Borrar los datos de navegación** (cookies y datos de sitios) del sitio, o
  de todos, borra todo lo tuyo. No se puede deshacer.

La [[app/clasica|interfaz clásica]], en `/classic/`, está en el mismo sitio y
guarda en su propio espacio. La app copia esos datos la primera vez que
arranca (ver [[app/tus-datos#clasica|más abajo]]).

:::cuidado
Si usaste la app desde otra dirección (por ejemplo, la versión anterior
publicada en `github.io`), lo que guardaste allá no pasa solo a
`darwinbots-wasm.org`. Solo se puede traer si lo exportaste desde allá.
:::

## Exportar: sacar una copia {#exportar}
<!-- bots.menu.exportar (Biblioteca.svelte ⋯); experimentar.exportar (Experimentar.svelte exportar(): el borrador); observar.guardar.descargar; informes.descargar; competir.lista.exportar -->

No hay un botón para respaldar todo junto: cada cosa se exporta desde su
pantalla.

| Qué | Cómo | Archivo |
|---|---|---|
| Bots propios y marcas | En **Bots**, el botón **⋯** → **Exportar mis bots y marcas (.json)** | `.json` con todos tus bots (con sus versiones), favoritos, etiquetas, notas y selecciones |
| Un escenario | En **Experimentar**, con el escenario abierto, **Exportar** | `.json` del escenario que estás editando |
| Una corrida | En **Observar**, **Guardar** → **Descargar .dbsim** | `.dbsim` con el mundo en ese ciclo |
| Un informe | En Analizar → Informes, **Descargar .html** | `.html` autocontenido, se abre sin conexión |
| Un torneo | En **Competir**, con el torneo abierto, **Exportar** | `.json` con reglas, participantes y partidos |

Algunas cosas que conviene saber:

- **El escenario lleva el ADN de tus bots**: una especie que sale de un bot
  propio viaja con su ADN dentro del archivo. Las del foro van por nombre y se
  buscan en el Bestiario.
- **El `.dbsim` es el mundo, no la corrida entera.** Guarda los bots, su ADN
  y el estado de la simulación, en el mismo formato que la interfaz clásica.
  La historia de métricas, los eventos y el escenario de una corrida guardada
  quedan en el navegador. Para bajar una corrida que ya guardaste, retomala y
  descargala desde **Guardar**.
- **El torneo lleva el ADN de los participantes** tal como quedó congelado al
  inscribirse, así que se puede importar en otro navegador sin tener esos bots.
- El partido rápido de Competir no se guarda ni se exporta: guardalo antes
  como torneo.

Formatos de cada archivo: [[tecnico/formatos]].

## Importar: traer una copia {#importar}
<!-- bots.menu.importar (acepta darwinbots2-biblioteca y darwinbots-inventario); experimentar.importar (importarEscenario: id ocupado → id nuevo); inicio.corridas.importar, observar.corridas.abrir; competir.lista.importar (nombre «(importado)») -->

1. Abrí la app en el navegador donde querés los datos.
2. Importá cada archivo desde su pantalla:
   - **Bots**: **⋯** → **Importar biblioteca (.json)…**. Suma sin borrar: los
     bots nuevos se agregan, los que ya estaban reciben las versiones nuevas y
     un nombre que choca se cambia. Acepta también el inventario exportado de
     la clásica. Detalles en [[app/bots#importar]].
   - **Escenarios**: **Experimentar** → **Importar .json**. Si ya tenés uno
     con el mismo identificador, el importado entra como escenario nuevo, sin
     pisar el tuyo.
   - **Corridas**: **Importar .dbsim** en [[app/inicio]], o **Corridas** →
     **Abrir un archivo .dbsim…** en Observar. Se carga el mundo; para que
     quede en la lista, guardalo con **Guardar**.
   - **Torneos**: **Competir** → **Importar .json**. Entra como un torneo
     nuevo, con «(importado)» si el nombre ya existía.
3. Mirá el aviso que deja cada importación: dice qué entró, qué ya estaba y
   qué no se pudo leer.

## Los datos de la interfaz clásica {#clasica}
<!-- PLAN.md decisión 17; engine/migracion.js; bots.migracion.*; competir.migracion.*; competir.hofViejo.*; bots.menu.clasica -->

La primera vez que abrís la app, **copia** lo que tengas en la interfaz
clásica del mismo navegador: el inventario (favoritos, etiquetas, notas y
selecciones), los híbridos del laboratorio, que pasan a ser bots propios, y
los torneos. La clásica no se toca: sigue con sus datos y lo que hagas en una
no aparece en la otra.

Si después seguiste usando la clásica, **Importar desde la clásica** (en
Bots, botón **⋯**) vuelve a copiar el inventario y los híbridos sin duplicar
lo que ya estaba. Los torneos nuevos de la clásica se traen exportándolos
allá (**⬇**) e importándolos en Competir.

El Salón de la fama del viejo canal F1 de la clásica no tiene historial de
partidos y no se puede sumar a un torneo. Si la app lo encuentra, ofrece
**Bajarlo** como archivo o **Descartarlo**.

## Borrar {#borrar}
<!-- bots.confirmar.borrarBot; experimentar.borrar.*; observar.corridas.borrar; informes.borrar; competir.torneo.borrar; comparar.trabajos.borrar -->

Cada cosa se borra desde su pantalla y la app pide confirmación:

- un bot propio, desde su ficha (**Borrar**), con todas sus versiones;
- un escenario propio, en Experimentar (**Borrar**); los de fábrica no se
  pueden borrar;
- una corrida, en la lista de corridas de Observar (**Borrar**);
- un informe, en Analizar → Informes (**Borrar**);
- un torneo, con sus partidos, en Competir (**Borrar**);
- un trabajo y sus resultados, en Comparar (**Borrar**).

Ninguna de estas acciones se puede deshacer. Para empezar de cero del todo,
borrá los datos del sitio desde la configuración de tu navegador; antes,
exportá lo que quieras conservar.

## Cuando algo falla {#problemas}
<!-- competir.almacen.*, experimentar.error.cuota, *.sin-indexeddb -->

- **«Otra pestaña abrió una versión más nueva de la base de datos»** o
  **«Otra pestaña con una versión vieja bloquea la base de datos»**: la app
  se actualizó y quedó una pestaña vieja abierta. Cerrala o recargá todas.
- **«Este navegador no permite guardar datos»**: estás en una ventana privada
  o el navegador bloquea el almacenamiento del sitio. La app funciona, pero
  no guarda nada.
- **«No queda espacio para guardar datos en este navegador»**: borrá corridas
  o informes que no uses. Las corridas largas son lo que más ocupa.

:::nota
Un hábito sano: cada tanto, exportá tus bots y tus torneos y guardá los
archivos fuera del navegador. Ocupan poco y te salvan de un borrado
accidental.
:::
