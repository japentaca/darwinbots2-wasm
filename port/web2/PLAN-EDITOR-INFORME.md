# Informe: ejecución de PLAN-EDITOR.md

Corrida sin atender de [`PLAN-EDITOR.md`](PLAN-EDITOR.md) con la receta de
[`PLAN-EDITOR-ORQUESTADOR.md`](PLAN-EDITOR-ORQUESTADOR.md): un orquestador
(Opus 5.5) que lanza un subagente por paso (`desarrollador` o
`desarrollador-motor`), verifica por su cuenta y commitea. Del 2026-10-07 al
2026-10-08, en varias sesiones. Las cuatro etapas quedaron completas, en 21
commits sobre `main` (de `463acb6` a `158dfa2`), **sin push**.

Es un registro: no se actualiza.

## Cifras

| | Antes de la corrida | Al terminar |
|---|---|---|
| Suite C++ (`dbtests`), g++ nativo | 273 casos, 4153 aserciones | 302 casos, 4755 aserciones |
| Suite C++, clang nativo | 273 / 4153 | 302 / 4755 |
| Suite C++, wasm bajo node | 273 / 4153 | 302 / 4755 |
| `tests/wasm/solo_lectura.mjs` | 37 ok | 37 ok |
| `npm test` (port/web2) | 795 | 886, todos en verde, ninguno salteado |
| `npm run check` (Biome) | limpio | limpio (401 archivos) |
| `generar.mjs --lint` | — | 441 páginas y 532 bloques `adn` por idioma, 0 pendientes |

Las tres suites C++ dan lo mismo en los tres modos de build. Al cerrar cada
etapa pasaron también `npx vite build`, `test/claves.test.js`, los smokes de
`test/smokes/`, `armar-sitio.sh` en modo local y
`git diff 02b20d7 -- Darwinbots2/` vacío.

## Rutinas del core que cambiaron

Estas rutinas ya estaban revisadas contra VB6: la revisión de
[`spec/REVISION-PORT.md`](../../spec/REVISION-PORT.md) tendría que volver a
verlas. Con el gancho de traza apagado (`trace` y `traceSink` nulos), la sim
es la misma: la suite entera sigue en verde y hay tests que comprueban que el
`.dbsim` y el LCG quedan iguales con la traza encendida.

| Rutina | Archivo | Paso | Qué cambió |
|---|---|---|---|
| `ExecuteDNA` | `core/include/dbcore/vm.hpp` | E1.1 (`463acb6`) | `VmContext` suma un `TraceSink` opcional, y con él cada token anota pilas, flujo, gen y store. Los `if` de una línea de BASIC, ADVANCED, BITWISE, CONDITION y LOGIC ganan llaves para marcar `ejec`; la semántica es la misma. |
| `IntStack::peek`, `BoolStack::peek` | `core/include/dbcore/stacks.hpp` | E1.1 | Nuevos, de solo lectura. |
| `ExecRobs` | `core/include/dbcore/master.hpp` | E2.1 (`23c21d5`) | Dos asignaciones: apunta `vm.trace` al `traceSink` de la sim solo para `robfocus`. |
| Campo `traceSink` | `core/include/dbcore/sim.hpp` | E2.1 | Nuevo, del host; no va al `.dbsim`. |

E1.2, E2.1 (exports) y E4.1 solo tocaron la capa host (`wasm/dbcore_api.cpp`
y `tests/`). `db_sim_bot_mutate` (E4.1) **escribe** sobre la sim: solo lo
llama el worker sobre sims descartables que crea y destruye para eso.

## Desvíos del plan, por paso

El detalle de cada uno está en el cuerpo de su commit.

### E1 · Visor de pila

- **E1.1** (`463acb6`): `dir` se calcula solo con la traza activa y un store
  de valor 1..14, para no anotar una escritura que `ExecuteStores` no hace.
  `RESERVED` y `MASTER` quedan con `ejec=false`. Hay llaves nuevas en los `if`
  de una línea, con la misma semántica.
- **E1.2** (`72e53b6`): cada línea del TSV termina en `\n`, la última
  incluida. La memoria que se pasa pisa `.dnalen` y `.genes`, y los valores se
  acotan a [-32768, 32767]. El test de rechazo usa `def x`.
- **E1.3** (`9e1abb1`): el búfer de memoria se pone en cero antes de copiar, y
  `mem` se recorta a 1001.
- **E1.4** (`225fb44`): `tokensEjecutables` excluye el `end` y aplica la
  corrección del cero inicial del cargador (A2-2). `pasosDeGen` recibe el
  texto, no `genesTexto`. El `else` abre gen propio en `genesTexto`.
- **E1.5** (`8c51857`): `linter.js` lleva un pedido pendiente por clase.
  `direccionDe` usa solo `SYSVARS`. La tarjeta del manual se extrajo a
  `TarjetaManual.svelte`, y `PanelPila` no recibe `soloLectura`.
- **d2bdeba** (fuera de paso): los valores de ejemplo se filtran a sysvars con
  dirección.
- **E1.6** (`c16c9c7`): ninguna página de `tecnico/` lista los exports wasm, y
  se suma la subsección `{#valores}`.

### E2 · Trazador

- **E2.1** (`23c21d5`): se reusa `trace_detail::Tsv`. `SimHandle` suma
  `trazaBot` y `trazaEncender()`. `db_sim_tick` descarta la traza vieja y solo
  la da por válida si hubo pasos y el foco no se movió. `db_sim_load` conserva
  el interruptor, y un handle nuevo arranca con la traza apagada.
- **E2.2** (`647b241`): el worker reaplica el último `trace-on` en cada handle
  nuevo. `traceBot` y `memDump` son pedidos con respuesta.
- **E2.3** (`ab0fa86`): los genes van en base 0 (`db_sim_bot_ga` escribe el gen
  1 en `out[0]`). `hashAdn` es síncrono. `pendientePila` vive en
  `src/lib/inspector/adn.js`. Se definió qué es un gen «evaluado».
- **E2.4** (`3d69b4e`): sin lista de exports en `tecnico/`.

### E3 · Fichas

- **E3.1** (`335a650`):
  - `claseDe` necesita el vocabulario, así que `vocabulario.js` pasó a
    `engine/` y `defsDe` a `engine/resaltado.js`; `src/` re-exporta los dos.
  - `sugerenciasFicha` vive en `autocompletar.js`.
  - `borrarFicha` quita un espacio solo si queda una palabra al lado. Con la
    regla del plan, la ida y vuelta fallaba en 15 de 398.900 fichas.
  - `insertarEn` no pone espacio antes de `'`.
  - `huecos` también da un hueco en las líneas vacías.
- **E3.2** (`19b39ff`): el historial usa el modelo «foto después del cambio»:
  `anotar` va después de cada acción, no antes.
- **E3.3** (`5bf54b4`): `alMarcar` se suma como callback. `alSoltar(dato,
  null)` se llama al soltar fuera de un hueco, y `alSoltar(ev)` devuelve si
  consumió el gesto. También se suman `alCancelar` y `estado()`.
- **E3.4** (`fb8a571`):
  - Un solo `crearArrastre` en `Editor.svelte`, compartido por Fichas y
    Paleta, que suman props.
  - `pasos` recibe la traza alineada entera, y en Fichas la traza se pide
    aunque el visor de pila esté apagado.
  - No hay «gen del cursor»: la paleta inserta en el último hueco tocado.
  - El modo táctil «seleccionar y tocar» no tiene UI.
  - El orquestador movió `touch-action: none` de los contenedores a cada ficha
    y palabra; si no, la lista no se desplazaba con el dedo.
- **E3.5** (`ca76cc3`): con el Laboratorio tampoco se ve Versiones; ahora está
  documentado.

### E4 · Evolución asistida

- **E4.1** (`4e70086`):
  - Un fundador suelto nace sin tasas, así que se parte de
    `SetDefaultMutationRates`.
  - Las tasas en cero siguen en cero.
  - El modo en vida adelanta `age` hasta `PointMutCycle`; si no, las
    puntuales no disparan. La agenda se restaura.
  - `DeltaUP` queda en 0 durante la corrida.
  - `sunbelt` no se fuerza: Point2, Copy Error 2, Translocation y
    Amplification no corren.
- **E4.2** (`2fb28e4`):
  - Las variantes vuelven **injertadas** sobre el ADN del usuario, con
    `injertar(original, variante, referencia)`. El decompilado del motor
    reescribe el 47% de los genes del Bestiario (alias, sysvars por valor).
  - `distintas(original, textos)`.
  - Los bindings `insertFounder` y `botMutate` son nuevos.
  - El test usa factor 4 en vez de 1000.
- **E4.3** (`8341083`): una unidad es un texto, con una prueba por semilla.
  El modo de mutación se llama `mutaciones`, porque `modo` ya era el de la
  prueba. Se suman `ErrorEvolucion`, `POR_DEFECTO_EVOLUCION` y
  `LIMITES_EVOLUCION`.
- **E4.4** (`73addd3`):
  - El panel recibe el linter del editor y va dentro de `{#key bot.clave}`.
  - `DiffGenes` suma `etiquetaA` y `etiquetaB`.
  - Las variantes se numeran desde 1 en pantalla.
  - Ver diff y Adoptar comparan contra el texto actual del editor, así que
    tras «Otra ronda» se ven los cambios acumulados.
  - Escenario, reglas y semillas son los de Probar por defecto.
- **E4.5** (`158dfa2`): `db_sim_bot_mutate` no figura en `tecnico/`, porque no
  hay lista de exports; la nota de las sims descartables va en
  `tecnico/semillas.md`.

### Al terminar las cuatro etapas

La fila de la decisión 26 de `PLAN.md` ya describe lo construido y no se
tocó. `port/README.md` suma la línea con las cuatro herramientas, y
`DOCUMENTACION.md` suma este informe. `PLAN-EDITOR.md` sigue como `vivo` en
`DOCUMENTACION.md`: pasarlo a histórico queda para cuando lo pida el autor.

## Incidentes de la corrida

- **Los agentes del repo no cargaban en la primera sesión.** Los de
  `.claude/agents/` no aparecían como `subagent_type` hasta reiniciar Claude
  Code, así que E1.1 se relanzó tras el reinicio.
- **Un test intermitente, previo a la corrida y ajeno al plan.**
  «sustitución: cientos de especies efímeras no la vuelven lenta», de
  `test/detectores_n4.test.js`, falla a veces por su tope de tiempo cuando la
  suite corre en paralelo (se lo vio en 563 ms). Se repitió `npm test` y no
  se tocó. En E3 y E4 no falló ninguna vez. Una vez se vio también un fallo
  suelto en `editor_prueba_worker.test.js`, que no se repitió.
- **Un falso CRLF.** En Git Bash, `grep -c $'\r'` cuenta todas las líneas y
  hace creer que hay CRLF. Un subagente de E1 se lo creyó y dejó archivos en
  CRLF. Desde entonces se comprobó con
  `tr -cd '\r' < archivo | wc -c`, y todos los archivos tocados quedaron en LF.

## Lo que tiene que probar el autor a mano

`node:test` no monta componentes, así que nada de esto tiene test automático.
Hay que probarlo en `npm run dev`, en los dos idiomas:

1. **E1.5, visor de pila**: encender **Pila**, mover el cursor por los genes,
   cambiar un valor de ejemplo y ver que la tabla se recalcula.
2. **E2.3, pestaña ADN del inspector**: genes disparados y evaluados, clic en
   un gen y su pila con los valores reales, Pausar, 1 y 10 ciclos, la línea de
   tiempo y «Abrir en el editor». Los mensajes `trace-on`, `trace-bot`, `step`
   y `mem-dump` no tienen test.
3. **E3.4, Fichas**, en un bot propio:
   - cambiar un número;
   - insertar `.up` desde la paleta, con clic y arrastrando;
   - arrastrar una ficha a un «+», y que el clic siguiente no abra la edición;
   - Ctrl+Z y Ctrl+Y;
   - Enter en la última ficha de una línea;
   - Supr con el campo vacío;
   - la pila al pasar el cursor;
   - volver a Texto y ver el mismo texto;
   - un bot del foro en solo lectura;
   - en un teléfono, arrastrar fichas y desplazar la lista.
4. **E4.4, Evolucionar**, en un bot propio:
   - 4 variantes con 4×, generar y ver la tabla;
   - Ver diff;
   - Adoptar, ver la nota sugerida, Ctrl+Z y guardar versión;
   - Otra ronda desde esta;
   - cambiar de bot con una ronda corriendo;
   - 1× con un ADN chico y el aviso «sin variantes»;
   - la ronda en el Historial de la ficha.
5. Las páginas del manual nuevas o cambiadas, en el navegador:
   `app/editor` (`#pila`, `#fichas`, `#evolucionar`), `app/inspector` (`#adn`)
   y `app/bots` (`#historial`).

## Lo que quedó fuera

- Lo que el plan dejó fuera: reordenar genes enteros arrastrando, cruzar
  bots y las rondas automáticas de evolución.
- **El modo táctil «seleccionar y tocar un hueco» de las fichas.**
  `arrastre.seleccionar` existe y tiene tests, pero ningún componente lo
  llama, y el manual dice que ese modo no existe. La clave
  `editor.fichas.seleccionada` no se creó. `editor.fichas.zona.fuera` existe
  pero no se usa.
- **`db_sim_bot_mutate` en `tecnico/`.** No hay página que liste los exports
  wasm, y tampoco figuran `db_dna_trace`, `db_sim_trace_on`,
  `db_sim_bot_trace` ni `db_sim_bot_mem_dump`.
- **Limpiezas posibles, fuera del plan:**
  - `engine/pila.js` sigue con su copia de la regex de `esLineaDef`, que
    ahora se podría importar de `engine/resaltado.js`.
  - «Base: variante n de la ronda anterior» vive en el estado del panel y se
    pierde al recargar.
- **Límite conocido de `injertar`.** En 11 de 2736 variantes (684 bots × 4),
  una mutación deja un gen sin `stop` y el texto que sigue queda enganchado
  al gen nuevo. Los comentarios dentro de un gen cambiado se pierden.
