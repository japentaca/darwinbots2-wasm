---
titulo: "Bots: biblioteca y ficha"
resumen: "La sección Bots: la biblioteca con los bots del foro y los tuyos, cómo buscarlos, marcarlos y sembrarlos, y la ficha de cada bot con su resumen, su ADN y su historial."
etiquetas: [bots, biblioteca, bestiario, ficha, sembrar, etiquetas]
estado: revisada
---
La sección **Bots** de la barra superior es tu colección de bots. A la
izquierda está la **Biblioteca**, con todos los bots que podés usar; a la
derecha, la ficha del bot que elegiste. Desde acá se crean bots nuevos, se
copian los del foro para modificarlos, se siembran en una simulación y se
inscriben en torneos.

Si todavía no elegiste ninguno, la parte derecha te invita a hacerlo: «Elegí
un bot de la biblioteca para ver su resumen, su ADN y dónde participó».

## Dos clases de bots {#clases}
<!-- web2/src/lib/bots/Biblioteca.svelte (meta: bots.fila.foro / bots.fila.propio); engine/biblioteca.js; port/web/bots/bots.json (684 bots, campo board); PLAN.md decisión 18 -->

La biblioteca junta dos clases de bots:

| | Del foro (el Bestiario) | Propios |
|---|---|---|
| De dónde salen | Los 684 bots publicados en el foro y el wiki de DarwinBots, que vienen con la app | Los que creás, duplicás o importás vos |
| Se pueden editar | No: son de solo lectura | Sí, y cada cambio guardado es una versión nueva |
| En la lista dice | El foro de origen y los genes (`F1 bots · 6 genes`) | `propio`, la versión y los genes (`propio · v3 · 4 genes`) |
| Perfil de capacidades | Sí, calculado de antemano | No |
| Dónde se guardan | Vienen con la app | En este navegador |

Para cambiar un bot del foro hay que duplicarlo: la copia es tuya y la podés
editar sin tocar el original (ver [[app/bots#duplicar|Duplicar]]).

Los bots propios y todo lo que marcás (favoritos, etiquetas, notas,
selecciones) quedan guardados en este navegador. Para llevarlos a otro equipo
o tener un respaldo, exportalos (ver [[app/bots#importar|Importar y
exportar]] y [[app/tus-datos]]).

## Buscar y filtrar {#buscar}
<!-- web2/src/lib/bots/Biblioteca.svelte; i18n/es/bots.json bots.buscar*, bots.modo.*, bots.agrupar.*, bots.orden.*, bots.filtros.* -->

Arriba de la lista tenés, de arriba abajo:

- **El buscador** («Nombre, archivo, etiqueta o nota»). Filtra mientras
  escribís y busca también en tus etiquetas y en tus notas.
- **Todos / Favoritos / Propios**: un atajo para ver toda la biblioteca, solo
  tus favoritos o solo tus bots.
- **Agrupar**: arma la lista por **arquetipo** (el que viene por defecto),
  **foro**, **capacidad**, **etiqueta**, **tamaño**, **favoritos**, **foro o
  propios**, o **Sin agrupar**. Cada grupo se pliega con un clic en su título
  y tiene una casilla para elegir el grupo entero.
- **Filtros**: un desplegable con más controles. Cuando hay alguno puesto, el
  título lo cuenta («Filtros (2)»).

Dentro de **Filtros**:

| Control | Qué hace |
|---|---|
| **Foro** | Solo los bots de un foro (F1 bots, Veggies, Multi-Bots…). |
| **Arquetipo** | Multicelular, vegetal, depredador, defensivo o pasivo. |
| **Tamaño** | Chico (hasta 5 genes), mediano (6 a 20), grande (21 a 60) o enorme (más de 60). |
| **Etiqueta** | Una de tus etiquetas, o «(sin etiquetas)». |
| **Orden** | Por nombre, por cantidad de genes o por cantidad de capacidades. |
| **Solo los elegidos** | Deja en la lista solo los bots que marcaste. |
| **Capacidades** | Una ficha por capacidad, con cuántos bots la tienen. |

Las fichas de capacidad tienen tres estados. Un clic la **exige** (aparece
un `+`: solo quedan los bots que la tienen), otro la **excluye** (un `−`:
quedan los que no la tienen) y un tercero la saca del filtro. Así podés pedir,
por ejemplo, bots que se reproduzcan sexualmente y no usen veneno.

**Quitar los filtros** vuelve todo a cero.

Al pie de la lista se ve cuántos bots quedan («120 de 684 bots») y cuántos
tenés elegidos.

:::nota
El arquetipo, el tamaño y las capacidades salen del perfil del Bestiario, así
que esos filtros solo encuentran bots del foro. Tus bots no tienen perfil.
:::

Algunos archivos del foro tienen exactamente el mismo ADN. Cuando pasa, el
pie muestra un ⓘ que lo explica: esos archivos comparten favorito, etiquetas
y notas, y se eligen juntos.

## Favoritos, etiquetas y notas {#marcas}
<!-- Biblioteca.svelte (alternarFav, tagASeleccion, favASeleccion); Resumen.svelte (notas onblur, tags); i18n bots.sel.*, bots.resumen.notas*, bots.resumen.tag* -->

Hay tres formas de marcar un bot, para encontrarlo después. Sirven igual
para los del foro que para los tuyos:

- **Favorito**: la estrella ☆ al lado del nombre, en la lista o en la ficha.
  Un clic la enciende (★) y otro la apaga.
- **Etiquetas**: palabras libres (`#cazador`, `#probar`, `#torneo-mayo`).
  Se agregan en la ficha, con **+ etiqueta**, y se quitan con la × de cada
  una.
- **Notas**: un texto libre en la ficha. Se guarda solo cuando salís del
  campo.

## Elegir varios bots {#elegir}
<!-- Biblioteca.svelte pie (bots.sel.*), selecciones con nombre (bots.seleccion.*, bots.confirmar.pisarSeleccion) -->

Cada fila tiene una casilla. Los bots elegidos se pueden marcar, sembrar o
guardar juntos con los botones del pie de la biblioteca:

| Botón | Qué hace |
|---|---|
| **Elegir los visibles** | Elige todos los que deja ver el filtro actual. |
| **Ninguno** | Desmarca todo. |
| **★** | Marca los elegidos como favoritos. |
| **+ etiqueta** y **− etiqueta** | Agregan o quitan de todos los elegidos la etiqueta que escribas en el campo **Etiqueta…**. |
| **Sembrar en lote** | Abre el diálogo de siembra con todos los elegidos (ver [[app/bots#sembrar|Sembrar]]). |
| **Guardar selección** | Guarda los elegidos con un nombre. |

Las selecciones guardadas aparecen arriba, junto a **Selecciones:**, con su
nombre y cuántos bots tienen. Un clic en una vuelve a elegir esos bots; la ×
la borra (los bots no se tocan). Si guardás una con un nombre que ya existe,
la app te pregunta si querés reemplazarla.

Las selecciones son útiles para armar el plantel de un experimento o de un
torneo y volver a él con un clic.

## La ficha de un bot {#ficha}
<!-- web2/src/lib/bots/Ficha.svelte (cabecera, acciones, pestañas); ruta.js (#/bots/<nombre>/adn, …/historial) -->

Al elegir un bot en la lista se abre su ficha. Arriba están el nombre y una
línea de datos: si es propio y de dónde salió («copia de…», «importado»),
el foro, si es vegetal, el arquetipo, la cantidad de genes y de
instrucciones, la versión y, en los del foro, un enlace al **tema en el
foro** donde se publicó.

Al lado, los botones de la ficha:

| Botón | Qué hace |
|---|---|
| **Sembrar** | Lo pone en una simulación (ver [[app/bots#sembrar|Sembrar]]). |
| **Duplicar** (o **Duplicar para editar**, en los del foro) | Crea una copia propia. |
| **Inscribir en torneo** | Lo anota en el partido rápido o en un torneo (ver [[app/bots#torneo|abajo]]). |
| **Datos** | Solo en los propios: cambia el nombre, si es vegetal y la descripción. |
| **Borrar** | Solo en los propios: lo borra con todas sus versiones, después de preguntarte. No se puede deshacer. |
| ☆ | Favorito. |

Debajo hay tres pestañas: **Resumen**, **ADN** e **Historial**. El **?** de
al lado abre en el manual la página de la pestaña que estás viendo
([[app/bots]] o el [[app/editor|editor]]).

## Resumen {#resumen}
<!-- web2/src/lib/bots/Resumen.svelte; adn.js (descripcionAdn, leeYEscribe: lectura del texto sin compilar); etiquetas.js; profiles.json -->

El resumen te dice qué es el bot sin tener que leer el ADN:

- **Descripción.** La que escribiste en **Datos** o, si no hay, los
  comentarios con que empieza el ADN. Por eso conviene abrir tus bots con un
  par de líneas de comentario que expliquen qué hacen (ver [[adn/estructura]]).
- **Capacidades.** Para los bots del foro, el arquetipo y la lista de cosas
  que hace, agrupadas en Movimiento, Ataque, Defensa, Energía, Social,
  Reproducción, Multicelular, Sentidos y Genoma. Pasando el mouse por una
  capacidad ves qué significa. **Capacidades por gen** las desglosa gen por
  gen. Los bots propios no tienen este perfil.
- **Qué lee y qué escribe.** Las sysvars que el ADN lee (las escritas como
  `*.nombre`), las que escribe (`.nombre` seguido de `store`, `inc` o `dec`)
  y, si dispara, de qué tipo: «−1 roba energía», «−3 veneno», «−8 esperma» y
  los demás de [[.shoot]].
- **Notas** y **Etiquetas** (ver [[app/bots#marcas|arriba]]).
- **Versiones**, solo en los propios: la tabla con cada versión guardada, su
  fecha, su nota y su hash. **Volver a esta** recupera una versión vieja
  _guardándola como versión nueva_: no se pierde ninguna.
- **Datos**: el hash del ADN, el archivo (en los del foro), la cantidad de
  genes y, en los propios, cuándo se creó.

:::nota
«Qué lee y qué escribe» sale de leer el texto, no de correr el bot. Si el
ADN arma una dirección con una cuenta (por ejemplo, con [[op:*]] o con un
número en vez del nombre), esa lectura o escritura no aparece. Lo mismo con
los disparos: solo se listan los que están escritos como un número justo
antes de `.shoot store`.
:::

## ADN {#adn}
<!-- Ficha.svelte → editor/Editor.svelte -->

La pestaña **ADN** es el editor: el texto del bot con colores, los avisos de
lo que el motor va a leer distinto de lo que parece, la vista gen por gen, el
panel para **Probar** el bot y el **Laboratorio** para sumarle genes del
Bestiario. Todo eso está en [[app/editor]].

En los bots del foro el texto se puede leer y probar, pero no modificar.

## Historial {#historial}
<!-- web2/src/lib/bots/Historial.svelte; engine/biblioteca.js historialBot (cruce por el hash de TODAS las versiones del propio; los del foro también por nombre y archivo) -->

El historial junta todo lo que hiciste con el bot en este navegador, en tres
tablas:

- **Corridas**: las simulaciones guardadas donde participó, con la fecha y el
  nombre de la especie que tenía («Como»). **Analizar** abre esa corrida en
  [[app/analizar]].
- **Torneos**: cada torneo donde estuvo inscripto, con su resultado («5
  ganados de 8 partidos · 2 temporadas») o la marca de **partido rápido**.
  **Ver** lo abre en [[app/competir]].
- **Pruebas rápidas**: cada vez que usaste **Probar** en el editor, con su
  estado (pendiente, corriendo, terminada, falló o cancelada).

El bot se reconoce por el hash de su ADN, el de cualquiera de sus versiones.
Si en una corrida sembraste el mismo ADN con otro nombre, también aparece.

## Crear un bot nuevo {#nuevo}
<!-- Biblioteca.svelte crearNuevo; DialogoBot.svelte (modo nuevo); adn.js ADN_NUEVO = 'cond\nstart\nstop\nend\n'; i18n bots.datos.*, bots.error.nombre-*, bots.confirmar.nombreForo -->

1. En la biblioteca, hacé clic en **+ Nuevo bot**.
2. Escribí el **Nombre**. Marcá **Es vegetal (fotosintetiza)** si va a vivir
   de la luz (ver [[simulacion/cloroplastos]]).
3. Si querés, escribí una **Descripción**.
4. En **ADN** viene un gen vacío. Podés dejarlo así o pegar un ADN entero,
   por ejemplo el de un `.txt` que tengas.
5. Hacé clic en **Crear**. La app abre el bot en la pestaña ADN, lista para editar.

El gen vacío con el que arranca es este:

```adn
cond
start
stop
end
```

No puede haber dos bots propios con el mismo nombre. Si elegís el nombre de
un bot del foro, la app te avisa que en los escenarios y las corridas los dos
se van a distinguir solo por el origen, y te deja usarlo igual con **Usar ese
nombre igual**.

El botón **Abrir en la app** de los bloques de ADN de este manual usa el
mismo diálogo: abre la app en la dirección `#/bots/nuevo?adn=…` con ese ADN
ya cargado, y vos solo elegís el nombre.

## Duplicar {#duplicar}
<!-- Ficha.svelte duplicar (DialogoNombre: bots.duplicar.*); Editor.svelte duplicar (editor.duplicar.*) -->

**Duplicar** crea una copia propia del bot, con el mismo ADN. Es la manera
de modificar un bot del foro y también de probar una variante de uno tuyo
sin tocar el original.

1. En la ficha, hacé clic en **Duplicar** (en los del foro dice **Duplicar para
   editar**).
2. Escribí el **Nombre de la copia**, o dejalo vacío: la app usa el mismo
   nombre con un número.
3. Hacé clic en **Duplicar**. La copia se abre en la pestaña ADN.

La copia recuerda de dónde salió: en su ficha dice «copia de» y el nombre del
original.

## Sembrar {#sembrar}
<!-- DialogoLote.svelte; lote.js (LOTE_INICIAL cantidad 5, cantidadVeg 15, energia 3000; CANTIDAD_MAX 10000; CANTIDAD_AVISO 500; ENERGIA_MAX 32000) -->

**Sembrar** (en la ficha) y **Sembrar en lote** (con varios elegidos) abren
el mismo diálogo. Primero definís cómo entra cada especie:

- **Con un bot**: el **Nombre de la especie**, el **Color**, la **Cantidad
  de bots** (5 por defecto, 15 si es vegetal), la **Energía inicial** (3000)
  y si entra como **Vegetal (hace fotosíntesis)**.
- **Con varios**: la lista de elegidos, los **Bots por especie** (5), los
  **Bots por especie vegetal** (15) y la **Energía inicial**. Cada bot es una
  especie; si dos tienen el mismo nombre, la app renombra uno y te avisa.

Más de 500 bots por especie es mucho y la app te lo advierte, pero siembra
igual.

Después elegís adónde van:

| Opción | Qué hace |
|---|---|
| **Sembrar en la corrida actual** | Agrega las especies al mundo que está corriendo en [[app/observar]]. Cada siembra queda anotada como un evento de la corrida. Si no hay ninguna abierta, el botón está apagado y aparece **Ir a Observar**. |
| **Nuevo escenario con estos** | Crea un escenario propio con esas especies en el mundo por defecto, con el **Nombre del escenario** que elijas, y lo abre en [[app/experimentar]]. Desde ahí lo podés ajustar y largar. |

El escenario queda guardado entre tus escenarios (ver [[app/escenarios]]),
así que podés repetir el experimento cuando quieras.

## Inscribir en un torneo {#torneo}
<!-- Ficha.svelte abrirInscribir/inscribir; i18n bots.inscribir.* -->

**Inscribir en torneo** abre una lista con el partido rápido y tus torneos,
cada uno con su temporada y cuántos participantes tiene. Elegís uno y hacé clic ens
**Inscribir**; la app abre ese torneo en [[app/competir]].

Dos cosas a tener en cuenta:

- **El ADN queda congelado** al inscribirlo. Si después editás el bot, la
  temporada sigue usando el ADN que tenía al inscribirse.
- **Los vegetales no pelean en torneos**: en un bot vegetal el botón está
  apagado.

Si el torneo tiene una ronda corriendo, o su formato ya no admite
participantes nuevos, la app no lo inscribe y te dice por qué.

## Importar y exportar {#importar}
<!-- Biblioteca.svelte menú ⋯ (bots.menu.*): exportar → darwinbots2-biblioteca.json; importarTexto acepta la biblioteca nueva y el inventario de la clásica; migracion.svelte.js importarDesdeClasica; PLAN.md decisión 17; inicio.archivo.* (Desde un archivo, .txt) -->

El botón **⋯**, al lado de **+ Nuevo bot**, tiene tres acciones:

- **Exportar mis bots y marcas (.json)** descarga un archivo con tus bots
  propios (con todas sus versiones), tus favoritos, etiquetas, notas y
  selecciones.
- **Importar biblioteca (.json)…** lee un archivo así, o el inventario
  exportado desde la interfaz clásica. Suma lo que trae a lo que ya tenés:
  los bots nuevos se agregan, los que ya tenías reciben las versiones nuevas,
  y si un nombre choca, el bot que llega recibe otro. Las notas y las
  selecciones con el mismo nombre pueden quedar reemplazadas por las del
  archivo. Al terminar, la app te dice qué agregó, qué reemplazó y qué dejó
  como estaba.
- **Importar desde la clásica** copia lo que tengas en la biblioteca de la
  [[app/clasica|interfaz clásica]] de este mismo navegador: favoritos,
  etiquetas, notas, selecciones con nombre e híbridos. La primera vez que abrís la app lo hace sola y te avisa qué
  trajo; la clásica no se toca.

Los híbridos que armaste en el laboratorio de la clásica llegan como bots
propios, y su ficha dice «híbrido del laboratorio». En esta app el
laboratorio es parte del editor (ver [[app/editor#laboratorio]]).

Para los archivos `.txt` de un solo bot (ver [[adn/formato]]):

- **Para agregar uno a la biblioteca**, abrilo con un editor de texto, copiá
  el contenido y pegalo en el campo **ADN** de **+ Nuevo bot**.
- **Para sembrarlo directamente**, sin pasar por la biblioteca, usá **Desde
  un archivo** en [[app/inicio]].
- **Para sacar el ADN de un bot tuyo**, copiá el texto desde la pestaña ADN.

## Si algo falla {#problemas}
<!-- screens/Bots.svelte avisos (bots.almacen.*, bots.foro.fallo, bots.error.almacen.*) -->

- **«Otra pestaña con una versión anterior de la app impide abrir tus
  datos»**: hay otra pestaña de la app abierta con una versión vieja. Cerrala
  o recargala. Mientras tanto ves solo los bots del foro.
- **«Otra pestaña abrió una versión más nueva de la app»**: recargá esta.
- **«No se pudieron leer tus bots y marcas»** o **«No se pudo leer la lista
  de bots del foro»**: la biblioteca muestra solo la parte que sí pudo leer.
- **«No hay más espacio de almacenamiento en este navegador»**: borrá
  corridas o bots que no uses, o exportalos y liberá lugar (ver
  [[app/tus-datos]]).
