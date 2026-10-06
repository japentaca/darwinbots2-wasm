---
titulo: La interfaz clásica
resumen: "La primera página web del port, en /classic/: qué es, qué tiene que la app nueva no (Internet Mode, skins, monitor RGB, gráficos del original), cómo sembrar, guardar y armar torneos, y cómo pasar tus datos a la app."
etiquetas: [clásica, interfaz, internet mode, inventario, laboratorio]
estado: revisada
---
La **interfaz clásica** es la primera página web que tuvo el port, antes de
la app actual. Está en `/classic/` y se abre desde el enlace **Interfaz
clásica** de la barra superior de la app. Corre el mismo motor, así que la
simulación es idéntica. Lo que cambia es la forma de usarla: una sola página
con el mundo, una barra de botones y un panel lateral largo, cerca de cómo
era el programa original.

<!-- PLAN.md decisión 5 (congelada en /classic/, comparte el wasm); web2/src/lib/BarraSuperior.svelte (app.clasica.enlace); port/README.md «Página web» -->

Dos cosas a saber antes de abrirla:

- **Está en inglés**, como el programa original. Esta página nombra cada
  control con su texto en inglés y explica qué hace.
- **Está congelada.** No recibe funciones nuevas: lo nuevo va a la app. Queda
  para quien prefiere la forma del original y para lo que la app todavía no
  tiene.

<!-- README: «La interfaz de la página está en inglés desde el 2026-09-26» -->

## Qué tiene que la app no {#solo-clasica}
<!-- PLAN.md decisión 5 (excluidos a propósito: monitor RGB, skins, imagen de fondo, ventanas de gráfico posicionadas y .gsave), C22 (Internet Mode → E13); web/index.html view-toggles, Graphs, View menu (extras), im-panel -->

| Función | Dónde está en la clásica |
|---|---|
| **Internet Mode**: mandar y recibir organismos entre simulaciones | Panel **Internet** → **Internet Mode** |
| **Skins**: la silueta que el ADN le da a cada bot | Casilla **skins** de la barra |
| **Monitor RGB**: colorea a cada bot según tres posiciones de su memoria | Casilla **RGB monitor** y **Settings for RGB Memory Monitor...** |
| **Imagen de fondo** propia detrás del campo | **Import Background Picture** / **Remove Background Picture** |
| Las **18 series de gráficos del original**, en ventanas flotantes, con tres consultas personalizables y el volcado `.gsave` | **Recording and analysis** → **Graphs (18 series)** |

Internet Mode va a llegar a la app cuando el sitio tenga un servidor para
conectar las simulaciones. El resto quedó afuera a propósito: la app tiene
sus propios gráficos, con exportación a CSV (ver [[app/analizar]]).

Todo lo demás también existe en la app, con otra forma: el inventario es la
[[app/bots|Biblioteca]], el laboratorio de híbridos es un panel del
[[app/editor|editor de ADN]], los torneos están en [[app/competir]] y el diseñador de ojos,
la consola del bot y el modo jugador están en el [[app/inspector|inspector]].

## La barra de arriba {#barra}
<!-- web/index.html <header>: btn-run, btn-step, btn-reset, btn-tournaments, btn-tv, speed, seed, view-toggles, view-mode, lens, btn-cam, btn-save, btn-load, btn-teleporter, stats; btn-fs -->

| Control | Qué hace |
|---|---|
| **▶ Start** / **⏸ Pause** | Corre o pausa la simulación. |
| **Step** | Avanza un ciclo. |
| **Reset** | Empieza una simulación nueva con las opciones del panel y la semilla de **Seed**. |
| **🏆 Tournaments** / **📺 TV** | La ventana de torneos (ver [[app/clasica#torneos|más abajo]]). |
| **Speed** | Ciclos por cuadro: de 1 a 32, o **max** (lo más rápido posible). |
| **Seed** | La semilla de la simulación nueva. |
| **impacts**, **vision**, **vectors**, **gauges** | Qué se dibuja sobre el campo: impactos, visión, vectores e indicadores. |
| **skins**, **RGB monitor** | Ver la tabla de arriba. |
| **Player Bot** | El bot con foco apunta al puntero; flechas = empuje (la clásica lo rotula «motor»), espacio = disparar. |
| **View** | **Classic** (el dibujo del original) o **Enriched** (forma, color y anillos de acción), con **Color by** para elegir qué colorea. |
| **⤢** | Vuelve la cámara a zoom 1, sin desplazamiento. La rueda acerca y arrastrar desplaza. |
| **Save sim** / **Load sim** | Descarga la simulación como `.dbsim` o carga una. |
| **+ Local teleporter** | Agrega un teleporter al mundo. |

A la derecha, la barra muestra ciclos por segundo, cuadros por segundo y el
tiempo de dibujo. El botón **⛶** sobre el campo lo pone a pantalla completa;
**Esc** sale. Un clic sobre un bot lo selecciona y lo muestra en **Bot
inspector**, con su ADN y la casilla **follow** para que la cámara lo siga.

## El mundo al abrir {#al-abrir}
<!-- web/index.html onReady → newSim (alga de arranque PRESETS.alga, qty 15); OPT_GROUPS (Costs def 0); o-fw/o-fh 32000; seed 1234 -->

Al abrirse, la clásica arranca un mundo de 32000 × 32000 con la semilla 1234 y
15 algas (Alga Minimalis) como vegetales. No hay animales: los sembrás vos.

:::cuidado
En la clásica **los costos arrancan en 0**: los bots no gastan energía al
moverse, disparar o ejecutar su ADN. Para un mundo con costos, cargá los de
liga con **F1 settings** o ponelos a mano en el grupo **Costs**. Qué es cada
costo: [[simulacion/energia]].
:::

## Sembrar una especie {#sembrar}
<!-- web/index.html «Seed species»: preset, dna, sp-name, sp-color, sp-veg, sp-qty, sp-nrg, btn-seed, seed-lint; showSeedLint -->

El panel **Seed species**, al final de la columna derecha:

1. En la lista, elegí **Animal Minimalis**, **Alga Minimalis (veg)** o
   **— Custom DNA —**. Con el último, pegá tu ADN en el cuadro de texto.
2. Completá **Name** y el color.
3. Marcá **vegetable** si es un vegetal, y poné la cantidad en **qty** y la
   energía inicial en **nrg** (5 y 3000 por defecto).
4. Tocá **Seed**. Los bots aparecen en el mundo en curso, sin reiniciarlo.

Si el ADN tiene palabras que el motor no reconoce, la clásica lo siembra
igual y muestra los avisos debajo del botón. Es el mismo análisis que el
[[app/editor|editor de ADN]] de la app; los avisos más comunes están en
[[adn/errores]].

Para sembrar bots del Bestiario, usá **📚 Inventory…** (ver abajo).

## Guardar y cargar {#guardar}
<!-- btn-save → worker save → darwinbots-cycle<N>.dbsim; btn-load accept .dbsim,.sim -->

**Save sim** descarga la simulación como `darwinbots-cycleN.dbsim`, donde
_N_ es el ciclo. **Load sim** carga un `.dbsim`. Es el mismo formato que usa
la app: un archivo de una se abre en la otra (ver [[tecnico/formatos]]).

La clásica no tiene corridas guardadas en el navegador: para conservar un
mundo, descargalo.

## Opciones de la simulación {#opciones}
<!-- web/index.html buildOptsPanel (Field and shape), OPT_GROUPS; applyF1Settings (F1_COSTS, F1_OPTS, F1_KEYS); README «Ajustes F1» -->

**Sim options** agrupa los parámetros en secciones plegables: **Field and
shape**, **Physics**, **Light and day/night**, **Death and decay**, **Energy
and vegetables**, **Game modes (F1 / rounds)**, **Costs**, **Dynamic costs**,
**Restrictions** y **Shapes (vision and drift)**. Son los mismos parámetros
que la app muestra en [[app/experimentar-avanzado]], donde están explicados.

La mayoría se aplica en vivo. El tamaño del campo, la economía de los
vegetales y las mutaciones se aplican al tocar **Reset**.

**F1 settings (league costs and field)**, en **Game modes**, carga los
ajustes de liga F1 del original: costos de liga, física, luz, vegetales,
mutaciones apagadas y un campo de 9237 × 6928 toroidal. Los costos cambian
enseguida; el campo, los vegetales y las mutaciones, con el próximo
**Reset**.

**Objects** agrega formas (**Shapes**), laberintos (**Mazes**) y maneja los
teleporters (**Teleporters**).

## Inventario y laboratorio {#inventario}
<!-- web/inventory.js (Bot inventory, filtros, group by, ficha: To the form / Seed / 🧬 Lab, Seed selection, Export/Import; IndexedDB darwinbots-inventario; invExport sin híbridos); web/lab.js (Hybrid lab: Available genes, by capability / from one bot, self-contained only, remap memory, Save, To the form, Seed) -->

**📚 Inventory…** abre la ventana **Bot inventory** con los bots del
Bestiario. Podés buscarlos y filtrarlos por foro, arquetipo, tamaño y
capacidades (un clic exige la capacidad, otro la excluye), agruparlos con
**group by** y ordenarlos. La ficha de cada bot muestra su perfil genético y
tiene **To the form** (lo pasa a **Seed species**), **Seed** y **🧬 Lab**.
También podés marcar favoritos (★), poner etiquetas y notas y guardar
selecciones con nombre. **Seed selection** siembra todos los marcados a la
vez, con un color por especie.

**🧬** abre el **Hybrid lab**, que arma un ADN nuevo con genes de distintos
bots. Los genes se buscan por capacidad en todo el Bestiario (**by
capability**) o se recorren los de un bot (**from one bot**). Se ordenan con
↑ y ↓, y el resultado se puede guardar (**Save**), pasar al formulario
(**To the form**) o sembrar (**Seed**). Con **remap memory**, si dos bots
usan la misma dirección de memoria propia, la del segundo se mueve a una
libre. Para entender por qué hace falta, ver [[adn/memoria]].

## Torneos {#torneos}
<!-- web/tournament.js (ventana 🏆 Tournaments: ⚡ Scratch, ＋ New, 💾 Save as tournament, 🗑, ⬇, ⬆; ⚙ Setup / ▶ Play; World rules: Load into the panel, Save the panel as rules, F1 preset, No-cost preset; Entrants; tn-drawmode; ▶ Play next, ✕ Abandon, 📅 New season, 📺 TV mode, Pause between fights); README «Torneos» -->

**🏆 Tournaments** abre una ventana con los mismos torneos que
[[app/competir]]: los mismos seis formatos, temporadas, Elo y Hall of Fame. La
forma cambia:

- Arriba eligís el torneo o el **⚡ Scratch** (el partido rápido, que no se
  guarda). **＋ New** crea uno, **💾 Save as tournament** guarda el Scratch,
  **⬇** exporta y **⬆** importa.
- **⚙ Setup** tiene el formato y los valores del partido, las reglas del
  mundo y los participantes. En **World rules**: **F1 preset**, **No-cost
  preset**, **Save the panel as rules** (toma el panel **Sim options** tal
  como está) y **Load into the panel** (al revés).
- **▶ Play** juega: **▶ Play next**, **✕ Abandon**, **📅 New season** y el
  **📺 TV mode**, con **Pause between fights** en segundos.

La clásica no tiene rondas en segundo plano ni «Repetir y analizar»: eso es de la app.

## Internet Mode {#internet}
<!-- web/index.html im-panel (Nickname, Transport: Tabs of this browser / WebSocket relay, Relay, Room public, Connect/Disconnect Internet Mode, im-status, im-peers); worker.js imEnable (crea el puerto); README «Internet Mode (etapa E7)» -->

En el original, Internet Mode mandaba organismos de una simulación a otras
por un teleporter especial. En la clásica funciona así:

1. Abrí **Internet** → **Internet Mode**.
2. Escribí un **Nickname**. Viaja como último dueño de cada organismo que
   sale; vacío, se sortea uno «Newbie N».
3. Elegí el **Transport**:
   - **Tabs of this browser** conecta pestañas del mismo navegador. No
     necesita servidor.
   - **WebSocket relay** conecta con otras computadoras a través de un
     servidor de relay, cuya dirección va en **Relay**. El sitio todavía no
     ofrece uno público.
4. Elegí la **Room** (`public` por defecto): se ven entre sí las
   simulaciones de la misma sala.
5. Tocá **Connect Internet Mode**.

Al conectarte, la simulación gana un teleporter de Internet y aparece el
rótulo «Internet Mode» sobre el campo. Lo que entra en ese teleporter viaja a
otra simulación de la sala, sorteada entre las que están conectadas, y los
organismos que llegan salen por él. El panel muestra el estado, los pares y
las especies de cada uno. **Disconnect Internet Mode** corta la conexión.

Para probarlo sin otra computadora, abrí la clásica en dos pestañas,
conectá las dos con **Tabs of this browser** en la misma sala y sembrá bots
que se muevan. Los teleporters se explican en [[simulacion/mundo#teleporters]].

## Tus datos en la clásica {#datos}
<!-- inventory.js IndexedDB darwinbots-inventario (bots, sets, hybrids); league.js darwinbots-ligas; PLAN.md decisión 17 (la app copia, la clásica no se toca) -->

La clásica guarda el inventario (favoritos, etiquetas, notas y selecciones),
los híbridos del laboratorio y los torneos en el navegador, separados de los
de la app. **Export** e **Import** del inventario respaldan las marcas y las
selecciones, pero **no los híbridos**: esos viven solo en el navegador.

La app copia todo eso la primera vez que se abre, híbridos incluidos, y
después ya no se sincronizan. Cómo traer lo que hiciste en la clásica más
tarde, y cómo respaldar todo, está en [[app/tus-datos]].
