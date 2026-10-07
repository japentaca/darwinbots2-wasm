# Torneo en curso: plan

Rediseño de cómo se juega y se mira un torneo en la app nueva. Reemplaza la
parte de «avance automático» de la decisión 23 de `PLAN.md` y agrega la
decisión 25. Es un añadido fuera de etapa: no va en `spec/`.

## Por qué

Hoy un torneo se juega con cinco acciones parecidas: «Jugar y mirar»,
«Ronda en segundo plano», «⏩ Avanzar solo», «📺 Modo TV» (las dos en
`src/lib/competir/PanelJuego.svelte`) y «Seguir el torneo» en Observar. Dos
de ellas («Avanzar solo» y «Modo TV») son el mismo avance automático con
otra presentación, y se leen como «pasar a pantalla completa». Además, el
avance vive atado a dos rutas (`#/observar/tv` y `#/observar/torneo`):
`Observar.svelte` llama a `iniciarTv()` al entrar y a `detenerTv()` al
salir, así que cambiar de pantalla corta el torneo.

El problema de fondo es que la app no tiene un estado «hay un torneo en
curso»: el torneo depende de la pantalla en la que estás, cuando debería ser
al revés. La pantalla tiene que acompañar al estado del sistema.

## Principios

1. **Un torneo en curso es un estado de la app, no una ruta.** Navegar no
   lo altera; solo lo detienen los controles del torneo.
2. **Mientras hay torneo, solo se permiten acciones sobre el torneo** y las
   que no tocan la simulación principal. Lo que no se puede usar se oculta
   o se explica, no queda como botón muerto.
3. **El campo de juego está siempre a la vista** en Observar. Lo que cambia
   es cuánto lugar ocupan los datos a su alrededor.
4. **Qué se juega y cómo se ve son dos cosas separadas.** La pantalla
   completa es una forma de ver, disponible siempre, y no un modo de juego.

## Decisiones

| # | Tema | Decisión |
|---|------|----------|
| T1 | Estado global | Un módulo `src/lib/competir/en-curso.svelte.js` (o la evolución de `src/lib/observar/tv/tv.svelte.js`) es el dueño del avance: torneo, temporada, pelea actual, «al terminar» y pausa. Lo arrancan y lo paran solo sus acciones; ningún `$effect` de pantalla lo inicia ni lo detiene. El worker sigue corriendo aunque Observar no esté montado; Observar solo dibuja. La máquina pura `maquina.js` no cambia de lógica. |
| T2 | Un solo «Jugar» | En Competir, «▶ Jugar» con un selector **Al terminar la pelea**: *parar* · *seguir con la próxima* (hasta el fin de la temporada) · *seguir con nuevas ediciones* (lo que hoy hace el TV). Reemplaza a «Jugar y mirar», «Avanzar solo», «Modo TV» y «Seguir el torneo». El selector se puede cambiar durante el torneo, desde la franja o la pestaña Torneo. «Ronda en segundo plano» queda aparte, porque es otra cosa: no dibuja y usa varios workers. |
| T3 | Franja del torneo | Mientras hay torneo, la barra superior muestra en todas las pantallas una franja: `🏆 nombre · temporada n · pelea k/N · EN VIVO` (o «cortinilla 5 s», «edición completa»), con **Ver** (va a Observar), **Al terminar…** y **Detener**. Sigue el patrón del chip de trabajos de `BarraSuperior.svelte`. |
| T4 | Detener sin ambigüedad | Dos acciones explícitas: **Parar al terminar esta pelea** (la pelea sigue y se registra; es lo de hoy) y **Abandonar la pelea** (se corta y no se registra; usa `abandonar` de `torneos.svelte.js`, con confirmación). |
| T5 | Pantalla completa | Botón ⛶ en la barra de Observar y tecla **F**, con o sin torneo. Esc sale de la pantalla completa (lo hace el navegador) y no toca el torneo. Desaparecen las rutas `#/observar/tv` y `#/observar/torneo`; las viejas redirigen a `#/observar` (enlaces guardados). |
| T6 | Disposiciones de Observar | Control segmentado `▣ Campo · ◧ Mixta · ▤ Datos`, independiente de la pantalla completa. *Campo*: el mundo solo, con los rótulos del torneo encima (lo que hoy es el modo TV, pero sin exigir pantalla completa). *Mixta* (por defecto): el mundo y el panel lateral. *Datos*: el panel se agranda (tablas completas, gráficos grandes) y el mundo queda como miniatura viva en una esquina, nunca oculto. La elección se recuerda en localStorage. |
| T7 | Pestañas del panel lateral | `En vivo · Torneo · Bot`. *En vivo*: lo de `PanelVivo` hoy. *Torneo* (solo con torneo en curso, y es la pestaña por defecto entonces): pelea actual y próxima, tabla de la temporada, últimos resultados, el cuadro si es copa, «Al terminar…» y la cortinilla. *Bot*: el inspector; seleccionar un bot salta a esta pestaña (hoy el inspector reemplaza al panel entero). |
| T8 | Bloqueos con torneo | **Observar**: Sembrar, Mundo, Corridas, Guardar como… y el Player Bot no se muestran; en su lugar, los controles del torneo. Velocidad, pausa del dibujo, lentes, zoom e instantánea siguen. **Competir**: el torneo en curso queda de solo lectura (participantes, reglas, sorteos, Vaciar, Borrar), con un aviso que remite a la franja; los otros torneos se pueden mirar y editar, pero no jugar. **Inicio y Experimentar**: lo que reemplaza la corrida (`corrida().iniciar`, `cargar`, abrir archivo, «Probar en Observar») se deshabilita con «Hay un torneo en curso: detenelo para usar la simulación» y un botón que lleva a la franja. Bots y Analizar quedan libres; «Inscribir en torneo» no ofrece el torneo en curso. |
| T9 | Recarga | El torneo en curso no se reanuda solo al recargar: se guarda su id en `sessionStorage` y la franja ofrece «Reanudar» (la pelea cortada por la recarga no se registró, como hoy). |
| T10 | Ronda en segundo plano | Sigue igual y sigue excluyendo al torneo en curso del mismo torneo (hoy `round-running`). Una ronda de otro torneo puede convivir. |

Alternativa descartada para T8: correr Experimentar e Inicio en un segundo
worker para que convivan con el torneo. Duplica la memoria del wasm y la
corrida «actual» deja de ser una sola; se puede retomar más adelante.

## Bocetos

Mixta, con torneo en curso:

```
┌ DarwinBots ─ Inicio Observar Experimentar Analizar Bots Competir ───────────┐
│ 🏆 Liga Zebedee · temp. 2 · pelea 5/28 · EN VIVO  [Ver] [Al terminar ▾] [⏹] │
├──────────────────────────────────────────────┬──────────────────────────────┤
│                                              │ En vivo │[Torneo]│ Bot       │
│                                              │ Pelea 5: Zebedee vs Animal   │
│                 MUNDO                        │ Próxima: Seasnake vs Hunter  │
│        ┌───────────────────────┐             │ ─ Tabla ──────────────────── │
│        │ Zebedee vs Animal     │  (rótulo)   │ 1 Zebedee      9 pts         │
│        └───────────────────────┘             │ 2 Seasnake     6 pts         │
│                                              │ ─ Últimos ────────────────── │
│                                              │ P4 Hunter gana               │
├──────────────────────────────────────────────┴──────────────────────────────┤
│ ⏯ velocidad ▾  lentes ▾  📷   ▣ ◧ ▤   ⛶                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

Datos:

```
├─────────────────────────────────────────────────────────────────────────────┤
│ En vivo │[Torneo]│ Bot                                                        │
│ Tabla completa de la temporada         │ Cuadro / rondas                     │
│ …                                      │ …                    ┌───────────┐ │
│ Últimos resultados con semillas        │ Elo                  │  mundo    │ │
│ …                                      │                      │ (mini)    │ │
│                                        │                      └───────────┘ │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⏯ velocidad ▾  📷   ▣ ◧ ▤   ⛶                                               │
```

Campo: el mundo ocupa todo, con el rótulo de la pelea (`RotuloTv`, plegable
con M) y la barra de controles mínima. Con ⛶, lo mismo a pantalla completa.

## Etapas

Cada etapa se cierra con la verificación del repo (skill
`verificar-cambios`) y con su documentación en los dos idiomas (skill
`actualizar-documentacion`). Una etapa, un commit (o dos: código y
documentación). Sin push.

### TC1 · Separar la pantalla completa y unificar «Jugar» (T2, T4, T5)

- `PanelJuego.svelte`: «▶ Jugar» con el selector «Al terminar la pelea»; se
  van «Jugar y mirar», «Avanzar solo» y «Modo TV». «Seguir el torneo» se va
  de Observar (lo cubre el selector).
- Observar: botón ⛶ y tecla F; el `RotuloTv` aparece cuando hay torneo, con
  o sin pantalla completa; Esc ya no cambia de modo.
- «Parar al terminar esta pelea» y «Abandonar la pelea».
- Las rutas `tv` y `torneo` redirigen a `#/observar`. En esta etapa el
  avance todavía se detiene al salir de Observar (lo resuelve TC2).
- **Cierre:** un torneo se juega con un solo botón; la pantalla completa
  entra y sale sin tocar el torneo; tests de `maquina.js` intactos y los de
  la UI tocada actualizados.

**Hecho (2026-10-06).** Cómo quedó, y lo que se decidió al construirla:

- «▶ Jugar» pasa siempre por el avance (`entrarTv`), también con *parar*:
  una pelea con su cortinilla y se apaga. Cuándo para lo resuelve
  `tv.svelte.js` (`debeParar`), sin tocar `maquina.js`: en la cortinilla de
  la pelea siguiente (*parar*, o «Parar» pedido) y al terminar el rótulo
  del campeón (salvo *ediciones*). *Temporada* es el valor por defecto; la
  elección va en localStorage (`darwinbots2.tv-al-terminar`).
- **No volver a sortear.** El avance de la clásica (`tvEdition`) vuelve a
  sortear la temporada abierta si no tiene partidos, aunque sea de lista
  fija; el manual lo avisaba. Como «▶ Jugar» reemplaza a «Jugar y mirar»,
  eso pisaba la lista elegida a mano. `lgEdition(L, {sortear: false})` la
  juega como está; la temporada nueva tras el campeón se sortea igual. Sin
  la opción, `lgEdition` hace lo de la clásica (test en
  `observar_tv.test.js`).
- «Mirar en Observar», con una pelea del torneo en juego, también enciende
  el avance (toma la pelea en juego); con una repetición sigue siendo un
  enlace.
- La pantalla completa es la del modo TV de antes (el campo solo, el resto
  de la app inerte), pero con o sin torneo. Que conserve la disposición
  elegida (T5/T6) queda para TC3.
- El marcador flotante se oculta en Observar mientras el avance está
  encendido (`flotanteVisible(hash, hayPartido, avance)`), ya no por ruta.

### TC2 · Torneo en curso global y franja (T1, T3, T9)

- Sacar el ciclo de vida de los `$effect` de `Observar.svelte`; el módulo
  del torneo en curso arranca el reloj y vigila el partido sin importar la
  pantalla.
- Franja en `BarraSuperior.svelte` con Ver, Al terminar y Detener.
- Recarga: «Reanudar» desde `sessionStorage`.
- **Cierre:** se puede ir a Bots, Analizar y Competir y volver con el torneo
  avanzando, y las peleas se registran igual que mirándolas (mismo
  resultado por semilla: el test de la decisión 23 sigue en verde). Test
  nuevo con `node:test` sobre el módulo, sin DOM.

**Hecho (2026-10-06).** Cómo quedó, y lo que se decidió al construirla:

- **T1 sin módulo nuevo.** Se eligió la evolución de `tv.svelte.js`: la
  lógica del avance (la máquina, el tic, la vigilancia del partido y
  `debeParar`) pasó a `src/lib/observar/tv/avance.js`, un controlador sin
  runes ni DOM con el motor, el reloj y el almacenamiento inyectados
  (`crearAvance`). `tv.svelte.js` queda como el estado reactivo y el
  cableado con la página. Así el test (`test/torneo_en_curso.test.js`)
  juega temporadas enteras contra `engine/torneos.js` con un reloj falso.
- **El worker no depende de Observar.** `conexion.js` ya devolvía el frame
  sin dibujarlo cuando no hay dibujante, y el registro de partidos escucha
  los frames a nivel de página (`torneos.svelte.js`). Bastó con quitar el
  `$effect` de `Observar.svelte` que apagaba el avance.
- **Ciclo de imports.** `torneos → Marcador → tv → torneos` dejó de ser
  inocuo: `tv.svelte.js` arma el avance al cargarse. Las dependencias de
  `torneos.svelte.js` se le pasan en funciones (se leen tarde) y la
  revisión de «Reanudar» espera a que carguen los módulos.
- **Franja.** `FranjaTorneo.svelte`, debajo de la barra (no dentro: la
  barra es una sola fila con scroll horizontal), cargada con import
  dinámico como la cola de trabajos. En vez de «pelea k/N» muestra el
  progreso de la temporada de Competir (`textoProgreso(lgProgress)`): la
  escalera, el suizo y la colina no tienen un N fijo. «Ver» no aparece en
  Observar. Con un error, «Cerrar». No anuncia las fases: la región viva es
  la del rótulo de Observar.
- **Recarga.** El id va en `sessionStorage`
  (`darwinbots2.torneo-en-curso`) mientras el avance está encendido; lo
  borra `detener`. Tras recargar, la franja ofrece «Reanudar» (sigue sin
  cambiar de pantalla) y «Descartar»; si el torneo ya no existe, la oferta
  se descarta sola.
- **Pendiente para TC4.** Abrir otro torneo en Competir todavía apaga el
  avance con el error «Se abrió otro torneo» (el motor juega el torneo
  abierto), y el «Abandonar» del panel de Competir corta la pelea con
  «otra cosa tomó la simulación». Los bloqueos de TC4 los resuelven.
- **Pestaña en segundo plano.** Con la pestaña oculta el navegador frena
  `requestAnimationFrame` y los temporizadores: el avance y la sim (salvo
  a velocidad máxima) van lentos. Pasaba igual antes; no se cambia.

### TC3 · Pestañas y disposiciones de Observar (T6, T7)

- Panel lateral con pestañas En vivo / Torneo / Bot; el inspector pasa a la
  pestaña Bot.
- Control ▣ ◧ ▤ con la miniatura del mundo en Datos (el mismo canvas
  redimensionado, no una segunda sim).
- **Cierre:** el mundo nunca queda oculto; ancho de teléfono sin scroll
  horizontal; la disposición se recuerda.

**Hecho (2026-10-06).** Cómo quedó, y lo que se decidió al construirla:

- **Lógica pura aparte.** `src/lib/observar/disposicion.js` tiene las
  disposiciones (localStorage `darwinbots2.observar-disposicion`, Mixta por
  defecto) y a qué pestaña se salta (`pestañaTras`): empieza el torneo →
  Torneo; se elige un bot → Bot; se suelta el bot → Torneo o En vivo;
  termina el torneo → En vivo (salvo mirando un bot). Test en
  `test/observar_disposicion.test.js`.
- **La pestaña Bot está siempre**, también sin bot elegido (dice cómo
  elegir uno), para que las pestañas no cambien de lugar al hacer clic.
- **Un solo canvas.** La disposición solo cambia clases: en Datos el
  `.lienzo` pasa a `position: absolute` en una esquina (240 px de alto) y
  `Mundo.svelte` se redimensiona con su `ResizeObserver`; nunca se
  desmonta. En el teléfono (≤ 900 px) la miniatura va arriba, en la
  columna, con 30vh. El zoom de la cámara se conserva al cambiar de tamaño.
- **Pestaña Torneo** (`tv/PanelTorneo.svelte`): el torneo y el progreso, la
  pelea (`PeleaTv`) o, entre peleas, lo que diría el rótulo (la próxima en
  la cortinilla, el campeón, el error), la tabla y los últimos resultados.
  En Mixta, una tabla corta (#, bot, Pts en el suizo, PJ, G, %) y 5
  resultados; en Datos, la `Tabla` de Competir, 15 resultados y la
  `Estructura` del formato (para todos los formatos, no solo la copa), con
  ↻ deshabilitado: repetir un partido tomaría la sim del torneo.
- **Sin «próxima pelea» fuera de la cortinilla.** El motor decide la pelea
  siguiente al lanzarla (`lgEdition`/`lgTvNext`), así que solo se conoce en
  la cortinilla. «Al terminar…» y la cortinilla no se duplican en la
  pestaña: siguen en el rótulo del campo y en la franja.
- **Datos y el rótulo.** Con el mundo en miniatura, `RotuloTv` no dibuja
  nada (`mini`) salvo su región viva; la pelea se sigue en la pestaña y los
  controles en la franja. La tarjeta oscura de la pelea va sobre el campo
  solo en Campo (`campo`), con o sin pantalla completa.
- **Pantalla completa.** Conserva la disposición: Campo es el campo solo
  (como en TC1); Mixta y Datos llevan el panel. La barra de abajo se oculta
  siempre; el botón «Salir de pantalla completa» va en la sección (sin
  torneo, o en Datos).
- **En vivo en Datos** pasa a dos columnas (tarjetas y eventos a la
  izquierda, el gráfico a la derecha): a lo ancho, el gráfico crecía con el
  ancho y ocupaba toda la pantalla.
- **Scroll horizontal en el teléfono.** Venía de antes: las leyendas ocultas
  («Idioma», «Tema») de `BarraSuperior.svelte` son absolutas y escapaban
  del scroll de la barra. `.nav` con `position: relative` las contiene.

### TC4 · Bloqueos contextuales (T8, T10)

- Observar, Competir, Inicio y Experimentar según T8, con un solo helper
  (`hayTorneoEnCurso()` y el texto del aviso) para no repetir la regla.
- **Cierre:** con un torneo en curso no hay forma de reemplazar la corrida
  ni de cambiar el torneo desde la UI; cada bloqueo explica por qué y lleva
  a la franja.

**Hecho (2026-10-06).** Cómo quedó, y lo que se decidió al construirla:

- **El helper.** `tv.svelte.js` exporta `hayTorneoEnCurso()` (el avance
  activo: encendido y sin error; con el error que lo paró ya no hay
  torneo), `torneoEnCurso()` (su id), la clave del aviso
  (`AVISO_EN_CURSO`, «Hay un torneo en curso: detenelo para usar la
  simulación») e `irAFranja()`, que lleva el foco a la franja y la ilumina
  un momento. `AvisoTorneo.svelte` es el aviso con su botón **Controles del
  torneo**; solo se ve con un torneo en curso.
- **Competir: el cambio de torneo se bloquea** (decisión del usuario, se
  aparta de T8). El motor juega y edita el torneo abierto (`lg.cur` en
  decenas de funciones de `engine/torneos.js`): mirar otro sin abrirlo
  pedía separar en el motor el torneo que se juega del que se mira. Con un
  torneo en curso, los demás aparecen tenues en la lista y no se abren;
  una ruta a otro avisa y vuelve al que se juega. **Nuevo torneo** e
  **Importar .json** se apagan (los dos abren el nuevo). Resuelve los dos
  pendientes de TC2: ya no se puede abrir otro torneo, y **Abandonar**
  (del panel y del marcador flotante, que tenía el mismo problema) pasa por
  `abandonarPelea`, con confirmación.
- **Dos capas.** La interfaz apaga los botones y explica; además las
  acciones de `torneos.svelte.js` que cambian el torneo abierto o toman la
  sim (crear, importar, guardar el Scratch, borrar, renombrar,
  participantes, sorteos, formato, reglas, temporada nueva, ↻, «Repetir y
  analizar», ronda) no corren con un torneo en curso (`enCursoBloquea`, con
  aviso). `abrir(id, forzar)`: el avance abre el suyo con `forzar`.
- **El torneo en curso, de solo lectura.** También el nombre, ↻ y la
  temporada nueva. Participantes recibe `ronda` (el candado que ya tenía
  para la ronda en segundo plano); Reglas, el motivo
  `competir.torneo.enCurso`. En el panel de juego, «▶ Jugar» y la ronda
  se reemplazan por el aviso entre peleas.
- **Inscribir en torneo** no ofrece el torneo en curso e inscribe en los
  otros sin abrirlos (`inscribirSinAbrir`: `lgAddEntrant` sobre la
  temporada y `lgSave`). Para ver si la temporada ya tiene partidos sin
  abrir el torneo, `temporadaConPartidos(id)` lee el almacén; la ficha ya
  no abre el torneo antes de inscribir.
- **Observar.** Sembrar, Mundo, Guardar y Corridas no se muestran (y sus
  diálogos se cierran si el torneo empieza con uno abierto); en su lugar,
  **🏆 Controles del torneo**, que lleva a la franja. Los controles mismos
  no se repiten en la barra: ya están en el rótulo y en la franja. El
  Player Bot no aparece en el inspector.
- **Inicio, Experimentar y Bots.** Inicio apaga Retomar, los «Iniciar»,
  «Elegir archivo» e «Importar .dbsim»; Experimentar, **Nueva simulación**
  y **Aplicar a la actual** (cambiaría la pelea, que la vigía abandonaría).
  En Bots, **Sembrar en la corrida actual** también se apaga, por la misma
  razón. El borrador de Experimentar se edita y se guarda igual.
- **T10.** Sin cambios: no se pide una ronda del torneo en curso, y una
  ronda de otro torneo pedida antes sigue en la cola.
- **Fuera de alcance.** El diseñador de ojos y la consola del inspector
  siguen disponibles durante el torneo, como antes de TC4 (T8 no los
  nombra); se pueden sumar al bloqueo más adelante. Las claves i18n viejas del plan ya no estaban;
  se borró `observar.auto.bloqueado`.

## Documentación que toca

- Manual, es y en: `app/observar.md` (disposiciones, pestañas, ⛶, F),
  `app/competir.md` (Jugar, Al terminar, Detener, bloqueos), `app/inicio.md`
  y `app/experimentar.md` (bloqueo con torneo), `app/inspector.md` (pestaña
  Bot) y los tutoriales que digan «Modo TV», «Avanzar solo» o «Jugar y
  mirar» (buscarlos con grep en `port/sitio/manual/`).
- i18n: `src/i18n/es/*.json` y `en/*.json` (claves nuevas; se borran las
  de `competir.jugar.auto`, `competir.jugar.tv`, `observar.seguirTorneo` y
  `observar.tv.paneles/pantalla` que queden sin uso).
- `PLAN.md`: decisión 25 y la decisión 23 reescrita al cerrar TC2.
- `README.md`, `README.en.md` y portadas si nombran el modo TV.
