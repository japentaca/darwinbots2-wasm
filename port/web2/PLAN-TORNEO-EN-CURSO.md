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

### TC4 · Bloqueos contextuales (T8, T10)

- Observar, Competir, Inicio y Experimentar según T8, con un solo helper
  (`hayTorneoEnCurso()` y el texto del aviso) para no repetir la regla.
- **Cierre:** con un torneo en curso no hay forma de reemplazar la corrida
  ni de cambiar el torneo desde la UI; cada bloqueo explica por qué y lleva
  a la franja.

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
