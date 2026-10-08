# Plan: herramientas del editor de ADN

Plan de ejecución de cuatro piezas nuevas sobre el editor de ADN de la app
(`port/web2`) y el inspector de Observar. Decididas con el autor el
2026-10-07. Complementa la decisión 18 (editor), 19 (laboratorio) y 20
(ficha) de [`PLAN.md`](PLAN.md); no cambia ninguna.

| Etapa | Pieza | Depende de |
|---|---|---|
| E1 | Visor de pila en el editor | — |
| E2 | Trazador en el inspector (ADN en vivo) | E1 (gancho de traza y `PanelPila`) |
| E3 | Modo «Fichas» del editor | E1 (para el hover con la pila) |
| E4 | Evolución asistida | E1 no; reusa «Probar» |

Descartado con el autor: un **árbol de expresiones** (dibujar cada condición
como árbol). Motivo: los operadores de pila (`dup`, `swap`, `over`) no tienen
forma de árbol y la vista por pasos de E1 ya explica esos genes.

## Cómo usar este plan

Está escrito para que lo ejecute un agente de código sin tener que tomar
decisiones de diseño. Reglas de ejecución:

1. Las etapas se hacen **en orden** (E1, E2, E3, E4) y cada etapa en el orden
   de sus pasos. Cada paso termina con sus tests en verde antes de seguir.
2. Un commit por paso (o por grupo de pasos chicos del mismo archivo), en
   español, título corto, cuerpo con el porqué. **Nunca `git push`.**
3. Antes de tocar `port/core/` o `port/wasm/` leé
   `.agents/skills/cambiar-motor/SKILL.md`. Antes de dar una etapa por
   terminada, corré lo que dice `.agents/skills/verificar-cambios/SKILL.md`.
   Al tocar el manual, `.agents/skills/escribir-manual/SKILL.md`.
4. Si el código real contradice algo de este plan (un nombre, una firma, un
   número de línea), **manda el código**: adaptá el paso, y anotá la
   diferencia en el mensaje de commit. Los números de línea son orientativos
   (del 2026-10-07): buscá el símbolo, no la línea.
5. Lo que no está en el plan no se hace: nada de refactors de paso, nada de
   dependencias nuevas (`package.json` no cambia), nada de TypeScript.
6. Todo archivo nuevo en LF. En Windows, no uses Python en modo texto para
   escribir archivos del repo. Comprobá con `git diff --stat` que el tamaño
   del diff es razonable.
7. Español rioplatense (voseo) en código, comentarios, textos y commits.
   Sysvars, operadores y nombres de bots no se traducen.
8. **Ninguna etapa está terminada sin su paso de documentación**, que
   siempre incluye el manual en **español y en inglés**
   (`port/sitio/manual/es/…` **y** `port/sitio/manual/en/…`, mismas anclas,
   mismos bloques `adn`, mismos `:::parametro`), los textos de la app en
   `src/i18n/es/*.json` **y** `src/i18n/en/*.json` con las mismas claves,
   y `README.md` **y** `README.en.md`. `node port/sitio/generar.mjs --lint`
   y `test/claves.test.js` tienen que quedar en verde. Si una etapa se
   corta a la mitad, el último commit igual deja los dos idiomas parejos.

Reglas duras del repo que estas etapas rozan:

- **El texto del ADN es la fuente de verdad.** Toda vista (pila, fichas,
  trazador) se deriva del texto; toda edición es un reemplazo de rango en el
  texto. Nunca se regenera el texto desde una estructura.
- **La capa JS no evalúa ADN.** Los valores de la pila los calcula el motor y
  el JS solo los presenta. `engine/pila.js` parsea y alinea; no interpreta
  operadores.
- **Exports wasm nuevos de solo lectura** sobre la sim del usuario. Los que
  escriben (`db_sim_bot_mutate`, E4) solo se llaman sobre una sim
  descartable que el worker crea y destruye para eso.
- Cambios en `vm.hpp` y `master.hpp` (rutinas ya revisadas contra VB6) deben
  dejar la suite C++ idéntica en verde y no cambiar ningún resultado con el
  gancho apagado. Al cerrar E1.1 y E2.1, avisale al autor en el mensaje de
  cierre que esas rutinas cambiaron (la revisión de `spec/REVISION-PORT.md`
  tendría que volver a verlas).

## Formato de traza (común a E1 y E2)

Una traza es el registro de un ciclo de `ExecuteDNA` sobre un bot: una
entrada por token del ADN tokenizado (`bot.dna[1..]`, sin el fantasma 0 y
hasta el `end`). Se transporta como texto TSV, una línea por token, columnas
en este orden:

| # | Columna | Qué es |
|---|---|---|
| 0 | `idx` | Índice en `bot.dna` (empieza en 1). |
| 1 | `tipo` | `Block.tipo` numérico (`tok::NUMBER`, `DEREF`, …). |
| 2 | `valor` | `Block.value`. |
| 3 | `ejec` | `1` si el token se ejecutó, `0` si no (flujo `CLEAR`, o un `store` con la condición falsa). Los tokens de flujo (`cond`, `start`, `else`, `stop`) siempre `1`. |
| 4 | `flujo` | Estado de flujo **después** del token: `0` CLEAR, `1` COND, `2` BODY, `3` ELSEBODY. |
| 5 | `gen` | `currgene` después del token (numeración de `CountGenes`, empieza en 1). |
| 6 | `nInts` | Tamaño de la pila de enteros después del token. |
| 7 | `ints` | Hasta 8 entradas superiores de la pila de enteros, de abajo hacia arriba, separadas por coma. Vacío si no hay. |
| 8 | `nBools` | Tamaño de la pila de booleanos. |
| 9 | `bools` | Hasta 8 entradas superiores de la pila de booleanos (`-1` verdadero, `0` falso), de abajo hacia arriba, separadas por coma. |
| 10 | `dir` | Si el token fue un store que escribió: la dirección normalizada (1..1000). Si no, `0`. |
| 11 | `val` | Si `dir` ≠ 0: `bot.mem[dir]` después del store. Si no, `0`. |

En E2 la traza de un bot vivo lleva una **primera línea de cabecera**:
`#\tciclo\tn\tgenenum` (el ciclo de la sim, el índice del bot y su cantidad
de genes). En E1 (`db_dna_trace`) no hay cabecera.

Alineación con el texto: el JS no recibe la palabra de cada token. La
reconstruye con `tokensEjecutables(texto)` (E1.4): los tokens de
`tokensTexto` (`engine/lab.js`) que no están en una línea `def`
(`esLineaDef` de `resaltado.js`), hasta el primer `end` inclusive. El token
`k` (base 0) de esa lista corresponde a la línea de traza con `idx = k + 1`.
Un test sobre los 684 bots del Bestiario garantiza que las cuentas
coinciden.

---

## E1 · Visor de pila en el editor

Con el cursor en una línea del editor, un panel lateral muestra el gen que la
contiene ejecutado paso a paso: por cada token, las pilas y, para los stores,
qué dirección escribieron y con qué valor. Los valores de los sysvars que el
gen lee se toman de una «memoria de ejemplo» editable, guardada por bot.

### E1.1 · Gancho de traza en el motor (`port/core`)

**Archivos:** `port/core/include/dbcore/stacks.hpp`,
`port/core/include/dbcore/vm.hpp`, `port/tests/test_trace.cpp` (nuevo),
`port/CMakeLists.txt`.

1. En `stacks.hpp`, agregá a `IntStack` y a `BoolStack` un método de solo
   lectura:
   ```cpp
   // i = 0 es el tope; fuera de rango devuelve 0 (no cambia la pila).
   vb_long peek(int i) const { return (i < 0 || i >= pos_) ? 0 : val_[pos_ - 1 - i]; }
   ```
   (en `BoolStack` devuelve `int`). No toques `push`/`pop`.
2. En `vm.hpp`, antes de `struct VmContext`, definí:
   ```cpp
   // Traza de un ciclo de ExecuteDNA (herramientas del editor, PLAN-EDITOR.md).
   // Solo observa: con `trace == nullptr` ExecuteDNA es byte a byte la misma.
   struct TraceStep {
     vb_long idx = 0; unsigned char tipo = 0; vb_long value = 0;
     bool ejec = false; unsigned char flow = 0; vb_long gen = 0;
     int nInts = 0; std::array<vb_long, 8> ints{};
     int nBools = 0; std::array<int, 8> bools{};
     vb_long storeAddr = 0; vb_long storeVal = 0;
   };
   struct TraceSink { std::vector<TraceStep> steps; };
   ```
   y en `VmContext` el campo `TraceSink* trace = nullptr;`.
3. En `ExecuteDNA`: al principio, `if (vm.trace) vm.trace->steps.clear();`.
   Dentro del `for`, declará `bool ejec = false;` antes del `switch` y
   ponela en `true` en cada rama **en el punto donde el comando realmente
   corre** (dentro del `if (f.flow != CLEAR)`; en `tok::STORE`, dentro del
   `if (CondStateIsTrue)`; en la rama de flujo, siempre). Para `tok::STORE`,
   antes de llamar a `ExecuteStores`, calculá
   `const vb_long dir = vm.ints.peek(0) == 0 ? 0 : detail::normaddr(vm.ints.peek(0));`
   (para todos los stores, incluidos `inc`/`dec`, el tope es la dirección).
   Al final de la iteración, después del `switch`:
   ```cpp
   if (vm.trace) detail::RecordTrace(vm, bot, f, a, t, ejec, dir);
   ```
   con `dir = 0` cuando el token no fue un store ejecutado. `RecordTrace`
   (en `namespace detail`) llena un `TraceStep` con el formato de la tabla
   de arriba (`ints`: `peek(nInts-1-j)`… de modo que queden de abajo hacia
   arriba; `storeVal = bot.mem[dir]` si `dir != 0`) y hace `push_back`.
   Ninguna otra línea de `ExecuteDNA` cambia.
4. `port/tests/test_trace.cpp` (agregalo a la lista `add_executable(dbtests
   …)` de `port/CMakeLists.txt`). Usá la fixture mínima de
   `port/tests/test_vm.cpp:14-28` (copiala, no la importes). Casos:
   - «Con trace nulo no cambia nada»: cargá
     `cond *50 1 > start 7 100 store else 9 200 store stop`, `mem[50]=5`,
     corré dos veces desde el mismo estado (una con `vm.trace = nullptr`,
     otra con un `TraceSink`) y `CHECK` que `mem`, `ga` y las pilas quedan
     iguales.
   - «Pasos del gen»: con el mismo ADN y `mem[50]=5`, la traza tiene tantos
     pasos como tokens en `bot.dna` menos el fantasma y el `end`. Comprobá:
     el paso de `*50` tiene `nInts=1, ints[0]=5`; el de `1` tiene
     `ints = {5,1}`; el de `>` tiene `nInts=0, nBools=1, bools[0]=-1`; el de
     `start` tiene `flow=2` (BODY) y `gen=1`; el de `7` tiene `ejec=true`;
     el de `store` tiene `storeAddr=100, storeVal=7`; los tokens de la rama
     `else` (`9`, `200`, `store`) tienen `ejec=false`.
   - «Condición falsa»: con `mem[50]=0`, el `start` tiene `flow=0` y el
     primer `store` `ejec=false`, `storeAddr=0`; la rama `else` tiene
     `ejec=true` y `storeAddr=200, storeVal=9`.
   - «Pila recortada»: un ADN que apila 12 números seguidos
     (`cond start 1 2 3 4 5 6 7 8 9 10 11 12 stop`): el último paso tiene
     `nInts=12` e `ints = {5,…,12}`.
5. Build y suite completa en nativo y wasm (comandos en `AGENTS.md`). Todo
   lo que estaba verde sigue verde, con la misma cantidad de aserciones más
   las nuevas.

**Cierre:** suite C++ verde en ambos modos; `git diff Darwinbots2/` vacío.

### E1.2 · Export `db_dna_trace` (`port/wasm`)

**Archivos:** `port/wasm/dbcore_api.cpp`, `port/tests/test_host.cpp`.

1. Junto a `db_dna_lint` (busca `DB_EXPORT char* db_dna_lint`), agregá:
   ```cpp
   // PLAN-EDITOR.md E1 — traza un ciclo de ExecuteDNA sobre un bot descartable
   // (sin sim: ni RNG ni estado del usuario). mem: 1001 enteros (índice =
   // dirección 1..1000; el 0 se ignora) o nullptr = todo cero. Devuelve el
   // TSV del formato de traza (malloc; liberar con db_free) o "" si el
   // cargador rechaza el ADN.
   DB_EXPORT char* db_dna_trace(const char* text, const int* mem, int memLen, int seed);
   ```
   Implementación: `db::VbRng rng; rng.randomize(seed / 100.0);`
   `db::VmContext vm; vm.rndy = &rng; vm.gaTrack = true;`
   `auto bot = std::make_unique<db::Bot>();`
   `if (!db::RobScriptLoadText(text ? text : "", *bot, db::DefaultSysvarTable())) return cadena vacía;`
   copiar `mem[1..min(memLen,1001)-1]` a `bot->mem`; `db::TraceSink sink;
   vm.trace = &sink; db::ExecuteDNA(vm, *bot);` y serializar `sink.steps`
   con el formato de la tabla. Atrapá `VbError` como hace el lint. La
   memoria de salida con el mismo `malloc`+`memcpy` que `db_dna_lint`.
2. En `port/tests/test_host.cpp` agregá un `TEST_CASE("db_dna_trace")` que
   llame al export con el ADN de E1.1, un `mem` con `mem[50]=5`, y
   compruebe: la salida tiene N líneas (misma cuenta que en E1.1), la línea
   del `store` termina en `\t100\t7`, y con `text = "cond *50 >"` (ADN que
   el cargador rechaza por lo que corresponda; si lo acepta, usá un `def`
   malformado como `def x`) devuelve `""`.

**Cierre:** `dbtests` verde nativo y wasm; `node build-wasm/dbtests.js` verde.

### E1.3 · Mensaje `trace-dna` en el worker (`port/web2/engine`)

**Archivos:** `engine/sim.js`, `engine/worker.js`.

1. En `bindApi()` de `sim.js` agregá
   `traceDna: C('db_dna_trace', n, [s, n, n, n]),` al lado de `lint`.
2. Agregá la función `traceSteps(dna, mem, seed)`: reserva un búfer con
   `ensure(scratch.traceMem, 1001)` (agregá `traceMem` a `scratch` igual que
   los demás), escribe `mem` (arreglo JS de 1001 enteros o `null`) en
   `M.HEAP32` desde `scratch.traceMem.p / 4`, llama a `api.traceDna(dna,
   mem ? scratch.traceMem.p : 0, mem ? 1001 : 0, seed | 0)`, pasa el
   resultado por `takeStr` y devuelve el **texto TSV tal cual** (el parseo
   lo hace `engine/pila.js` del lado de la página, para poder testearlo sin
   worker).
3. Handler en el `switch` de `handle(msg)`, al lado de `'lint-dna'`:
   ```js
   case 'trace-dna':
     postMessage({ t: 'trace-dna', ...correlacion(msg),
       tsv: traceSteps(String(msg.dna ?? ''), Array.isArray(msg.mem) ? msg.mem : null, msg.seed | 0) });
     break;
   ```
   Anda sin sim, como `lint-dna`.
4. Documentá el mensaje en el bloque de protocolo de `worker.js`, con el
   mismo formato de dos columnas que `lint-dna`:
   `{t:'trace-dna', dna, mem?, seed?, req?, id?}` → `{t:'trace-dna', req?, id?, tsv}`.

**Cierre:** `npm test` verde (los tests nuevos llegan en E1.4).

### E1.4 · `engine/pila.js` (puro) y sus tests

**Archivos:** `engine/pila.js` (nuevo), `test/editor_pila.test.js` (nuevo).

`engine/pila.js` no toca el DOM ni evalúa nada. Exports, con JSDoc y
`// @ts-check` como el resto de `engine/`:

- `tokensEjecutables(texto)` → `Token[]` (el `Token` de `lab.js`): los de
  `tokensTexto(texto).tokens` cuya línea no es `def` (usá `esLineaDef` de
  `src/lib/bots/editor/resaltado.js`; si importar desde `engine/` a `src/`
  rompe la regla «engine sin DOM», copiá la expresión regular de
  `esLineaDef` a `pila.js` con un comentario que diga de dónde sale), hasta
  el primer token `end` (inclusive, minúsculas; el cargador corta ahí).
- `parsearTraza(tsv)` → `Paso[]`, con
  `Paso = {idx, tipo, valor, ejec: boolean, flujo, gen, ints: number[], nInts, bools: number[], nBools, dir, val}`.
  Una línea que empieza con `#` es la cabecera (E2): devolvela aparte como
  `parsearTraza(tsv).cabecera = {ciclo, n, genenum} | null`; el resto en
  `.pasos`. Líneas vacías se ignoran.
- `alinear(tokens, pasos)` → `PasoAlineado[]` =
  `{...paso, palabra, linea, ini, fin}` emparejando por posición; si las
  cuentas no coinciden devuelve `[]` (la UI muestra «sin datos» y no una
  traza corrida).
- `pasosDeGen(alineados, genes, i)` → los pasos cuyo token cae entre `t0` y
  `t1` del `GenTexto` `i` de `genesTexto(texto)` (ojo: `t0`/`t1` son índices
  de `tokensTexto` completo, que incluye líneas `def`; convertí con un mapa
  índice completo → índice ejecutable).
- `sysvarsLeidos(tokens)` → nombres únicos (sin `*`) de los tokens que
  empiezan con `*.`, en orden de aparición. Es lo que la UI ofrece como
  memoria de ejemplo.
- `memoriaDe(valores, direccionDe)` → `Int32Array`/arreglo de 1001 con
  `mem[direccionDe(nombre)] = valor` para cada entrada de `valores`
  (`Map<string, number>`); nombres sin dirección se ignoran.
- `resumenPaso(paso)` → un objeto `{tipo: 'lee'|'apila'|'opera'|'compara'|'flujo'|'escribe'|'nada', ...}`
  solo para elegir el texto i18n; sin calcular valores.

Tests (`test/editor_pila.test.js`, `node:test`):

1. `parsearTraza` sobre un TSV escrito a mano de 4 líneas (incluida una con
   `ints` vacío) devuelve los números correctos y `ejec` booleano.
2. `tokensEjecutables` sobre un ADN inline con una línea `def`, un
   comentario con `'` y un `end` seguido de basura: cuenta exacta.
3. Con wasm (`SIN_WASM` lo saltea; usá `workerEngine()` de
   `test/util/arnes-worker.js` y `ClienteSim`): para cada uno de los 684
   bots de `port/web/bots/bots.json`, pedí `trace-dna` y comprobá
   `parsearTraza(tsv).pasos.length === tokensEjecutables(texto).length`
   **o** `tsv === ''` (ADN que el cargador rechaza; anotá cuántos son en un
   `console.log` y comprobá que el lint los marca con `error`). Ningún bot
   tira excepción.
4. Con wasm: el ADN de E1.1 con `mem[50]=5` → alineado, `pasosDeGen(…, 0)`
   tiene 11 pasos, el del `store` tiene `dir=100, val=7`.

**Cierre:** `npm test` verde con y sin wasm; `npm run check` limpio.

### E1.5 · UI: `PanelPila.svelte`, cursor en `AreaAdn`, botón «Pila»

**Archivos:** `src/lib/bots/editor/PanelPila.svelte` (nuevo),
`src/lib/bots/editor/ejemplos.js` (nuevo), `AreaAdn.svelte`,
`VistaGenes.svelte`, `linter.js`, `Editor.svelte`,
`src/i18n/es/editor.json`, `src/i18n/en/editor.json`.

1. **`AreaAdn.svelte`**: nueva prop opcional `oncursor?: (linea: number) => void`
   (línea base 1). Llamala desde los handlers `onclick`, `onkeyup` y
   `oninput` ya existentes, calculando la línea como la cantidad de `\n` en
   `valor.slice(0, ta.selectionStart)` más 1. Solo avisá si cambió respecto
   de la última avisada. Sin selección múltiple especial.
2. **`VistaGenes.svelte`**: nueva prop opcional `onabrir?: (n: number) => void`
   que se llama con el índice del gen (`b.n`) cuando un bloque de tipo
   `'gen'` se despliega (en `alternar`, solo al abrir).
3. **`ejemplos.js`**: igual a `borrador.js` en estructura.
   `crearEjemplos({mapa?, almacen?})` devuelve `{leer(clave): Map<string,number>, guardar(clave, Map), borrar(clave)}`
   sobre `localStorage` con prefijo `'dbw2.editor.pila:'`, JSON de pares
   `[nombre, valor]`. Export `ejemplos = crearEjemplos()`. Test en
   `test/editor_pila.test.js` con un `mapa` inyectado (sin localStorage).
4. **`linter.js`**: el objeto de `crearLinter()` suma `trazar(texto, mem, seed): Promise<string>`
   que manda `{t:'trace-dna', dna, mem, seed, req}` por el mismo worker y
   aplica la misma regla «solo la respuesta al último pedido; corta a
   `PLAZO_MS`». Tests en `test/editor_prueba_worker.test.js` o un archivo
   nuevo `test/editor_linter.test.js`: dos pedidos seguidos → solo el
   segundo resuelve con datos (el primero resuelve `null`).
5. **`PanelPila.svelte`**. Props:
   `{pasos: PasoAlineado[], gen: number | -1, nombreGen: string, valores: Map<string,number>, sysvars: string[], soloLectura?: boolean, onvalor?: (nombre, valor) => void, estado: 'sinGen'|'sinDatos'|'cargando'|'ok', modo?: 'editor'|'trazador'}`.
   Markup:
   - Cabecera: «Gen N · nombre» y, al final del gen, un chip
     «condición verdadera / falsa» (deducido del paso del `start`: `flujo`
     2 = verdadera; si hay `else`, mostrar también cuál rama corrió).
   - Si `modo === 'editor'`: la lista de `sysvars` con un `<input
     type="number" class="sel">` por cada uno, valor de `valores` o 0,
     `onchange` → `onvalor(nombre, Number(valor))`. Título
     `t('editor.pila.ejemplo')`, ayuda `t('editor.pila.ejemploAyuda')`.
   - Tabla con una fila por paso: la palabra (clase de color de
     `claseDe(palabra)` de `resaltado.js`, mismas clases `.r-*`), la pila de
     enteros como chips `mono` (de abajo hacia arriba, y si `nInts > 8` un
     chip «…+k»), la pila de bools como `✓`/`✗`, y una nota corta según
     `resumenPaso`: para `dir ≠ 0`, `t('editor.pila.escribe', {dir, nombre, val})`
     donde `nombre` sale del vocabulario (`SYSVARS` de `vocabulario.js`,
     dirección → nombre; si no hay, el número). Filas con `ejec=false` en
     gris (`class="omitido"`) y nota `t('editor.pila.noCorre')` solo en la
     primera fila omitida de cada bloque.
   - Estados: `sinGen` → `t('editor.pila.sinGen')`; `sinDatos` →
     `t('editor.pila.sinDatos')` (el ADN no carga o la cuenta no coincide);
     `cargando` → `t('editor.cargando')`.
   - Hover sobre una palabra: reusá la tarjeta del manual exactamente como
     `AreaAdn` (`palabraBajo`/`entradaDe` de `hover.js`, `vocabularioManual`
     y `urlManual` de `src/lib/manual.js`). Si copiar el bloque del tooltip
     supera ~40 líneas, extraelo a `TarjetaManual.svelte` y usala en los
     dos lugares (único refactor permitido en esta etapa).
6. **`Editor.svelte`**:
   - Estado `pila = $state(false)` guardado en `localStorage`
     `'dbw2.editor.pila'` (`'1'`/`'0'`, en `try/catch`), botón «Pila» en la
     barra al lado de «Laboratorio» (mismo markup `class:on`,
     `aria-pressed`). Con `pila` encendido el lateral muestra `PanelPila`
     arriba de Probar/Versiones (no reemplaza el Laboratorio: si `lab` está
     encendido, el Laboratorio gana y la pila no se muestra).
   - `lineaCursor = $state(1)` alimentado por `oncursor` de `AreaAdn`;
     `genCursor = $derived(modo === 'texto' ? genDeLinea(lineaCursor) : genAbierto)`
     donde `genAbierto` lo fija `onabrir` de `VistaGenes` (inicial −1).
   - `valoresEjemplo = $state(new Map())`: se leen de `ejemplos.leer(bot.clave)`
     en `cargar()` y se guardan en cada `onvalor`. `sysvarsLeidos` se
     calcula sobre `tokensEjecutables(estable)`.
   - Pedido de traza: un `$effect` sobre `[estable, valoresEjemplo, pila]`
     que, si `pila` está encendido, llama a
     `linter.trazar(estable, memoriaDe(valoresEjemplo, direccionDe), 1234)`
     (`direccionDe`: nombre → dirección con `SYSVARS` de `vocabulario.js` y
     los `def` del texto con `defsDe` de `resaltado.js`). El resultado se
     parsea y alinea con `engine/pila.js`; `pasosGen = pasosDeGen(alineados, genesEstables, genCursor)`.
     Con la lista vacía y cuentas distintas → `estado = 'sinDatos'`.
   - La semilla fija `1234` se documenta en un comentario: `rnd` en un gen
     da siempre lo mismo en el visor, a propósito.
7. **i18n**: claves nuevas en `es/editor.json` y `en/editor.json` (mismas
   claves, mismos `{marcadores}`): `editor.pila` («Pila»), `editor.pila.titulo`,
   `editor.pila.ejemplo`, `editor.pila.ejemploAyuda`, `editor.pila.condVerdadera`,
   `editor.pila.condFalsa`, `editor.pila.ramaElse`, `editor.pila.escribe`
   («escribe {nombre} ({dir}) ← {val}»), `editor.pila.noCorre`,
   `editor.pila.sinGen`, `editor.pila.sinDatos`, `editor.pila.mas` («+{n}»),
   `editor.pila.semillaFija`. `test/claves.test.js` tiene que seguir verde.
8. `test/editor_componentes.test.js` compila el `.svelte` nuevo sin avisos
   (ya recorre la carpeta: no hay que registrarlo).

**Cierre:** `npm test`, `npm run check`, `npx vite build` verdes; probado a
mano en `npm run dev`: abrir un bot propio, encender «Pila», mover el cursor
por dos genes, cambiar un valor de ejemplo y ver que la condición cambia.

### E1.6 · Documentación de E1

1. `port/sitio/manual/es/app/editor.md`: sección nueva
   `## La pila paso a paso {#pila}` después de `## Autocompletar`
   (`{#autocompletar}`) y antes de `{#resumen}`. Contenido: qué muestra, el
   botón «Pila», la memoria de ejemplo (y que se guarda por bot), por qué
   las filas en gris no tienen valores («el motor no ejecuta ese cuerpo; para
   verlo, cambiá los valores de ejemplo hasta que la condición dé
   verdadera»), que `rnd` usa una semilla fija, y un bloque ```` ```adn ````
   con el ejemplo `cond *.eye5 50 > start 50 .up store stop` y una tabla de
   tres filas de pila. Enlazá `[[adn/pila]]` o la página del capítulo del
   lenguaje que explique la pila (buscá en `manual/es/adn/` el archivo que
   hable de «pila» o «RPN» y enlazá ese).
2. `port/sitio/manual/en/app/editor.md`: la misma sección, misma ancla
   `{#pila}`, mismo número de bloques `adn`.
3. Actualizá el `resumen:` del front matter de las dos páginas para nombrar
   la pila.
4. Si alguna página de `manual/*/tecnico/` lista los exports wasm (buscá
   `db_dna_lint` en `port/sitio/manual/`), agregá `db_dna_trace` ahí, en los
   dos idiomas.
5. `node port/sitio/generar.mjs --lint` sin errores ni avisos.
6. `README.md` y `README.en.md`: en la frase de la app que dice «se escriben
   bots con un editor de ADN», agregá «con la pila paso a paso». Cifras de
   tests (casos/aserciones C++) actualizadas con los números reales de
   `dbtests`. `port/README.md`: la misma cifra en «Estado».

**Cierre de E1:** verificación completa de `verificar-cambios`; commit.

---

## E2 · Trazador en el inspector (ADN en vivo)

La pestaña **ADN** del inspector de Observar pasa a mostrar el ADN del bot
seleccionado con los genes que dispararon en el ciclo, la pila con los
valores reales al hacer clic en un gen, controles de paso, una línea de
tiempo de genes y un botón para llevar el ADN y la memoria al editor.

### E2.1 · Traza del bot con foco y volcado de memoria (`port/core`, `port/wasm`)

**Archivos:** `port/core/include/dbcore/sim.hpp`,
`port/core/include/dbcore/master.hpp`, `port/wasm/dbcore_api.cpp`,
`port/tests/test_host.cpp`.

1. `sim.hpp`: en `struct Sim`, junto a `robfocus`, el campo
   `TraceSink* traceSink = nullptr;  // PLAN-EDITOR.md E2: traza del bot con foco`.
   (`TraceSink` está en `vm.hpp`, que `sim.hpp` ya incluye vía `vm`; si no,
   incluí `vm.hpp`.)
2. `master.hpp`, en `ExecRobs`, justo después de la línea que fija
   `sim.vm.gaTrack`:
   ```cpp
   sim.vm.trace = (t == sim.robfocus) ? sim.traceSink : nullptr;
   ```
   y al salir del bucle, junto a `sim.vm.gaTrack = false;`, `sim.vm.trace = nullptr;`.
   Nada más cambia. Con `traceSink == nullptr` el comportamiento es
   idéntico.
3. `dbcore_api.cpp`: en `SimHandle` un miembro `db::TraceSink traza;` y un
   `int trazaCiclo = -1;`. Exports nuevos, al lado de `db_sim_bot_ga`:
   ```cpp
   DB_EXPORT void db_sim_trace_on(void* h, int on);   // S(h).traceSink = on ? &H(h).traza : nullptr
   DB_EXPORT char* db_sim_bot_trace(void* h, int n);  // TSV con cabecera; "" si n != robfocus o sin traza
   DB_EXPORT int db_sim_bot_mem_dump(void* h, int n, int* out, int max); // copia mem[1..min(max,1000)] en out[0..]; devuelve la cantidad; 0 si el bot no existe
   ```
   La cabecera de `db_sim_bot_trace` es `#\t<ciclo>\t<n>\t<genenum>`; el
   ciclo es el contador de la sim (busca cómo lo lee `db_sim_dump_focus` o
   `db_sim_stats`; usá el mismo). La serialización de los pasos es la
   misma función que en `db_dna_trace`: extraela a
   `static std::string TraceToTsv(const db::TraceSink&)` en el namespace
   anónimo y usala en los dos.
4. Tests en `test_host.cpp`: crear sim, `db_sim_start(h, 1234)`, sembrar una
   especie con el ADN de E1.1 (`db_sim_add_species` + `db_sim_seed_species`
   de 1), `db_sim_set_focus(h, 1)`, `db_sim_trace_on(h, 1)`, avanzar un
   ciclo con el export que usa el worker para `step` (busca `case 'step'`
   en `sim.js` para saber cuál es), y comprobar que `db_sim_bot_trace(h, 1)`
   empieza con `#\t` y tiene al menos 11 líneas más. Con `trace_on(h, 0)` y
   otro ciclo, `db_sim_bot_trace` devuelve `""`. `db_sim_bot_mem_dump` con
   `max = 1000` devuelve 1000 y `out[49] == mem[50]` del bot (poné el valor
   con `db_sim_bot_set_mem(h, 1, 50, 5)` antes).
5. Suite completa nativo y wasm.

**Cierre:** verde; `git diff Darwinbots2/` vacío; avisar al autor de que
`master.hpp` cambió.

### E2.2 · Worker y conexión

**Archivos:** `engine/sim.js`, `engine/worker.js`,
`src/lib/sim/conexion.js`, `test/conexion.test.js`,
`test/muestreo_worker.test.js` (o un `test/trazador_worker.test.js` nuevo).

1. `sim.js`, `bindApi()`: `traceOn: C('db_sim_trace_on', null, [n, n])`,
   `botTrace: C('db_sim_bot_trace', n, [n, n])`,
   `botMemDump: C('db_sim_bot_mem_dump', n, [n, n, n, n])`.
2. Handlers:
   - `case 'trace-on': if (sim) api.traceOn(sim, msg.on ? 1 : 0); break;`
   - `case 'trace-bot'`: `postMessage({t:'trace', n, ...correlacion(msg), tsv: sim ? takeStr(api.botTrace(sim, n)) : ''})`.
   - `case 'mem-dump'`: `ensure(scratch.mem, 1000)`; `c = api.botMemDump(sim, n, scratch.mem.p, 1000)`; `postMessage({t:'mem', n, ...correlacion(msg), mem: Array.from(new Int32Array(M.HEAP32.buffer, scratch.mem.p, c))})`
     (`mem[i]` es la dirección `i+1`).
   - Comprobá que `case 'select'` fija el foco con `api.setFocus`; si no lo
     hace (y el foco lo fija otro mensaje), usá ese mismo camino: el bot
     trazado es siempre `robfocus`.
3. Protocolo en `worker.js`: documentá los tres mensajes y sus respuestas.
4. `conexion.js`: `traceOn(on)`, `traceBot(n)`, `memDump(n)` que envían
   esos mensajes. Tests en `test/conexion.test.js` iguales al de `activ`
   (`{ t: 'trace-on', on: true }`, etc.).
5. Test con worker real (saltea sin wasm): sembrar un bot con el ADN de
   E1.1, `select` 1, `trace-on`, un `step`, `trace-bot` → `tsv` con
   cabecera y `parsearTraza(tsv).cabecera.n === 1`; `mem-dump` → 1000
   valores.

**Cierre:** `npm test` verde.

### E2.3 · Pestaña ADN rehecha

**Archivos:** `src/lib/inspector/Adn.svelte` (reescritura),
`src/lib/inspector/LineaTiempoGenes.svelte` (nuevo),
`src/lib/inspector/Inspector.svelte`, `src/lib/inspector/adn.js`,
`src/i18n/es/inspector.json`, `src/i18n/en/inspector.json`,
`test/inspector.test.js`.

1. **`Inspector.svelte`**:
   - El `$effect` que enciende `activ` cuando `pestana === 'resumen'` pasa
     a hacerlo también con `'adn'`. Agregá otro `$effect` para `'adn'`:
     `sesion.c.traceOn(true)` al entrar y `traceOn(false)` al salir, y un
     `setInterval` de 500 ms que, mientras `vivo` y la sim corre
     (`sesion.corriendo`), pide `sesion.c.traceBot(bot)`. Cuando la sim
     está en pausa se pide una vez por cada paso (ver controles).
   - Recepción: `c.on('trace', m => { if ((m.n|0) === bot) traza = m.tsv; })`
     y `c.on('mem', m => { if ((m.n|0) === bot) memoria = m.mem; })`.
   - Historial de `ga`: `historialGa = $state.raw([])`, anillo de hasta 200
     arreglos; en el handler de `'genes'` existente, además de `genes = m.ga`,
     `historialGa = [...historialGa.slice(-199), m.ga]`. Se vacía al cambiar
     de bot.
   - Props nuevas a `<Adn>`: `genes`, `historialGa`, `traza`, `corriendo={sesion.corriendo}`,
     `onPausar={() => sesion.correr(false)}`, `onPaso={(k) => { sesion.correr(false); for (let i=0;i<k;i++) sesion.c.step(); pedirTraza(); }}`,
     `onAbrirEditor`.
2. **`Adn.svelte`** (reescritura; mantené Copiar y Releer):
   - Arriba: barra con «Pausar» (si `corriendo`), «1 ciclo», «10 ciclos»,
     el contador `t('inspector.genes.cuenta', {on, total})` (misma clave que
     Resumen), Copiar, Releer, y «Abrir en el editor»
     (`t('inspector.adn.abrirEditor')`).
   - El texto: por cada bloque de `bloquesAdn(texto)` (de `engine/lab.js`;
     el texto de `bot-text` trae al final el gen epigenético y los
     metadatos que escribe `SalvarobText` en `formats.hpp` ~352-380: leé
     esa función y, si ese bloque hace que `tokensEjecutables(texto).length`
     no coincida con la traza, cortá el texto en el marcador que esa función
     escribe, en una función `sinColaDeGuardado(texto)` en
     `src/lib/inspector/adn.js` con test), las líneas del gen con el
     resaltado que ya usa `resaltarAdn`, y el fondo del gen según `genes[i]`
     (`ga` usa índices 1..genenum: el gen `n` de `bloquesAdn` es `ga[n+1]`):
     clase `.disparo` si `1`, `.evaluado` si hay pasos del gen con `ejec`
     en la condición pero el `start` quedó en `flujo = 0`, nada si no.
   - Clic en un gen → se despliega debajo `PanelPila` con
     `modo="trazador"`, `pasos = pasosDeGen(alinear(tokensEjecutables(texto), parsearTraza(traza).pasos), genesTexto(texto), i)`
     y sin memoria de ejemplo. Solo un gen abierto a la vez.
   - Debajo del texto, `<LineaTiempoGenes {historialGa} {bloques} />`.
3. **`LineaTiempoGenes.svelte`**: una fila por gen (`b.n + 1` y
   `b.nombre`), 200 celdas de 3 px (un `div` con `display:grid;
   grid-template-columns: repeat(200, 3px)`; en móvil se recorta con
   `overflow:auto`), celda encendida si `historialGa[k][n+1]`. Sin SVG.
   Título `t('inspector.adn.lineaTiempo')`, ayuda
   `t('inspector.adn.lineaTiempoAyuda')` («los últimos 200 ciclos; un punto
   por ciclo en que el gen disparó»).
4. **«Abrir en el editor con esta memoria»**: `onAbrirEditor` en
   `Inspector.svelte` hace `sesion.c.memDump(bot)`, espera `mem`, y guarda
   en `sessionStorage` la clave `'dbw2.editor.pila:pendiente'` con JSON
   `{hash: hashAdn(textoSinCola), valores: [[nombre, valor], …]}` donde los
   nombres son los sysvars de `sysvarsLeidos(tokensEjecutables(texto))` y
   los valores salen de `mem[direccion-1]`. Después navega a
   `#/bots/nuevo?adn=<encodeURIComponent(textoSinCola)>` (ruta existente).
   En `Editor.svelte`, en `cargar()`, si existe esa clave y su `hash` es
   igual a `hashAdn(texto)`, se adopta como `valoresEjemplo`, se enciende
   `pila` y se borra la clave. `hashAdn` está en `engine/adn.js` (es
   asíncrono: respetá eso).
5. i18n `inspector.json` (es y en): `inspector.adn.pausar`,
   `inspector.adn.unCiclo`, `inspector.adn.diezCiclos`,
   `inspector.adn.abrirEditor`, `inspector.adn.disparo`,
   `inspector.adn.evaluado`, `inspector.adn.lineaTiempo`,
   `inspector.adn.lineaTiempoAyuda`, `inspector.adn.sinTraza`.
6. `test/inspector.test.js`: los mensajes que manda la pestaña ADN
   (`trace-on`, `trace-bot`, `step` ×10 en «10 ciclos», `mem-dump` en
   «Abrir en el editor»). Test puro para `sinColaDeGuardado`.

**Cierre:** `npm test`, `npm run check`, build; a mano: seleccionar un bot,
pestaña ADN, pausar, avanzar de a uno y ver cambiar los genes; abrir en el
editor y ver los valores cargados en la pila.

### E2.4 · Documentación de E2

1. `manual/es/app/inspector.md`: reescribí la parte de la pestaña ADN
   (buscá su encabezado; conservá el ancla existente) describiendo genes
   disparados, clic en un gen, controles de paso, línea de tiempo y «Abrir
   en el editor». `manual/en/app/inspector.md` igual, mismas anclas.
2. `manual/es/app/editor.md` y `en`: en `{#pila}`, un párrafo «desde el
   inspector, [[app/inspector]] puede abrir el editor con la memoria real
   del bot como valores de ejemplo».
3. `manual/*/tecnico/`: los tres exports nuevos donde se listan.
4. `generar.mjs --lint` limpio; READMEs: cifras y la frase de la app («se
   inspecciona cada bot, incluido su ADN en vivo»).

**Cierre de E2:** `verificar-cambios`; commit; avisar al autor de
`master.hpp`.

---

## E3 · Modo «Fichas» del editor

Un tercer modo del editor (junto a «Texto» y «Genes») donde cada token es
una ficha coloreada dentro de la tarjeta de su gen, con autocompletado al
hacer clic, inserción con «+», arrastre dentro del gen, una paleta de
sysvars y operadores en el lateral, y la pila de E1 al pasar el cursor. El
texto sigue siendo la fuente: cada acción es un reemplazo de rango.

### E3.1 · `engine/fichas.js` (puro) y tests

**Archivos:** `engine/fichas.js` (nuevo), `test/editor_fichas.test.js` (nuevo).

Exports:

- `modeloFichas(texto)` → `LineaFichas[]`, una por línea del texto:
  `{n (base 0), tipo: 'codigo'|'comentario'|'def'|'vacia'|'meta', texto, gen: number|-1, zona: 'cond'|'cuerpo'|'else'|'fuera', fichas: Ficha[]}`
  con `Ficha = {w, ini, fin, clase}` (`ini`/`fin` offsets en el texto
  completo, como `Token` de `lab.js`; `clase` la de `claseDe` de
  `resaltado.js` — si importar desde `src/` es un problema, mové `claseDe`
  y `esLineaDef` a `engine/resaltado.js` y re-exportalas desde
  `src/lib/bots/editor/resaltado.js` sin cambiar ningún import existente).
  `gen` y `zona` salen de recorrer los tokens con la misma regla de
  `genesTexto`: `cond` abre zona `cond`, `start` abre `cuerpo`, `else`
  abre `else`, `stop` cierra.
- `reemplazarFicha(texto, ficha, palabra)` → `{texto, cursor}`: reemplaza
  `texto.slice(ini, fin)` por `palabra`; `cursor = ini + palabra.length`.
- `insertarEn(texto, pos, palabra)` → `{texto, cursor}`: inserta `palabra`
  en `pos` con un espacio antes si el carácter anterior no es espacio ni
  salto ni inicio, y uno después si el siguiente no es espacio ni salto ni
  fin.
- `borrarFicha(texto, ficha)` → `{texto, cursor}`: quita el token y **un**
  espacio adyacente (el de después si existe, si no el de antes). Si la
  línea queda vacía, la deja vacía (no la borra).
- `moverFicha(texto, ficha, pos)` → `{texto, cursor}`: `borrarFicha` y
  luego `insertarEn` en `pos` ajustada por el corrimiento del borrado.
- `nuevaLineaTras(texto, n)` → `{texto, cursor}`: inserta `\n` al final de
  la línea `n` (conservando la sangría de esa línea).
- `huecos(linea: LineaFichas)` → `number[]`: posiciones donde se puede
  insertar en una línea de código: antes de la primera ficha, entre
  fichas y después de la última (offsets en el texto).
- `sugerenciasFicha(prefijo, defs)` → la unión de `sugerencias(prefijo)` de
  `autocompletar.js` (sysvars y `*`), los comandos de `COMANDOS` de
  `vocabulario.js` que empiecen con el prefijo, y los `defs`; máximo
  `MAX_SUGERENCIAS`. Si `autocompletar.js` no se puede importar desde
  `engine/` (depende de algo de `src/`), implementá la unión en
  `src/lib/bots/editor/autocompletar.js` como `sugerenciasFicha` y dejá
  `fichas.js` sin esa función.

Tests:

1. `modeloFichas` sobre un ADN inline con comentario, `def`, línea vacía,
   un gen con `else` y una línea `'#meta`: tipos, zonas y `gen` correctos.
2. Ida y vuelta: para cada uno de los 684 bots del Bestiario, para la
   primera ficha de cada gen: `borrarFicha` seguido de `insertarEn` en el
   mismo `ini` con la misma palabra devuelve **exactamente** el texto
   original. Y `reemplazarFicha(t, f, f.w)` es identidad.
3. `insertarEn` en medio de dos fichas sin espacio (`"1 2"` en pos 1 →
   `"1 x 2"`), al inicio de línea y al final.
4. `moverFicha` de `a b c` llevando `c` al hueco antes de `a` → `c a b`.
5. Ningún bot del Bestiario tira excepción en `modeloFichas`, y la cantidad
   de fichas de código es igual a `tokensTexto(texto).tokens.length`.

### E3.2 · Historial de deshacer para el modo fichas

**Archivos:** `src/lib/bots/editor/historial.js` (nuevo), tests en
`test/editor_fichas.test.js`.

`crearHistorial(tope = 100)` → `{anotar(texto), deshacer(): string|null, rehacer(): string|null, limpiar()}`.
`anotar` descarta la rama de rehacer. El modo texto sigue con el deshacer
del navegador; este historial se usa solo en Fichas (y se limpia al cambiar
de modo o de bot).

### E3.3 · Arrastre sin dependencias

**Archivos:** `src/lib/bots/editor/arrastre.js` (nuevo), test puro.

`crearArrastre({umbral = 6, alSoltar})` devuelve handlers
`{alEmpezar(ev, dato), alMover(ev), alSoltar(ev)}` sobre eventos de puntero:
empieza a arrastrar cuando el puntero se mueve más de `umbral` px desde
`pointerdown`; durante el arrastre marca el hueco más cercano (el elemento
con `data-hueco` bajo `document.elementFromPoint`); al soltar llama a
`alSoltar(dato, hueco)`. Sin movimiento (tap) no arrastra: dispara el clic
normal. Modo táctil: `seleccionar(dato)` guarda una ficha seleccionada y el
siguiente tap en un `data-hueco` la suelta ahí (`alSoltar`). Test: la
máquina de estados con eventos simulados (objetos con `clientX/Y` y
`pointerId`), sin DOM: inyectá `elementoEn(x, y)` como dependencia.

### E3.4 · `Fichas.svelte` y `Paleta.svelte`

**Archivos:** `src/lib/bots/editor/Fichas.svelte` (nuevo),
`src/lib/bots/editor/Paleta.svelte` (nuevo), `Editor.svelte`,
`src/i18n/*/editor.json`.

1. **`Fichas.svelte`**. Props:
   `{texto: string, soloLectura?: boolean, marcadas: Set<string>, lineasMarcadas: Set<number>, pasos?: PasoAlineado[], onaplicar: (nuevo: string, cursor: number) => void, onhueco: (pos: number) => void}`.
   - Una tarjeta por bloque de `bloquesAdn(texto)` (mismo aspecto que
     `VistaGenes`: cabecera con número, nombre, origen; gen apagado
     atenuado) y, dentro, las líneas de `modeloFichas` del rango `l0..l1`.
     Las líneas fuera de todo gen van en una tarjeta «fuera de genes».
   - Línea de código: fichas `<button class="ficha {clase}">` separadas por
     huecos `<span class="hueco" data-hueco={pos}>+</span>` (visibles al
     pasar el cursor por la línea). Las zonas `cond`/`cuerpo`/`else` llevan
     un rótulo a la izquierda (`t('editor.fichas.zona.cond')`, …).
   - Línea `comentario`, `def` o `meta`: texto plano con clase `.r-com` /
     `.r-def`; clic abre un `<input class="sel">` en línea para editarla
     entera (`reemplazar` la línea completa con `onaplicar`).
   - Clic en una ficha: se vuelve un `<input>` con el valor actual y debajo
     la lista de `sugerenciasFicha`; Enter/Tab aplica
     `reemplazarFicha`; Esc cancela; Supr con el input vacío → `borrarFicha`.
   - Clic en un hueco: `<input>` vacío en ese lugar; Enter aplica
     `insertarEn`. Enter en la última ficha de una línea → `nuevaLineaTras`
     y foco en el hueco de la línea nueva.
   - Arrastre con `arrastre.js`: soltar una ficha en un hueco →
     `moverFicha`. Un gen entero no se arrastra en esta etapa (queda la
     vista Genes para apagar; reordenar genes queda fuera).
   - Fichas con `marcadas.has(w)` o su línea en `lineasMarcadas` → clase
     `.err` (mismo color que el modo texto).
   - Si `pasos` viene, al pasar el cursor por una ficha se muestra un
     `div.tip` con las pilas después de ese token (busca el paso con
     `ini === ficha.ini`): `t('editor.fichas.pilaTras')` y los chips como en
     `PanelPila`.
   - Teclado: Ctrl+Z / Ctrl+Y llaman a `ondeshacer`/`onrehacer` (props
     opcionales).
2. **`Paleta.svelte`**. Props: `{defs: string[], oninsertar: (palabra: string) => void, onarrastrar?: ...}`.
   - Buscador arriba (`t('editor.paleta.buscar')`).
   - Grupos plegables: los de `GRUPOS_MEMORIA` de
     `src/lib/inspector/memoria.js` (importarlo desde el editor está
     permitido; no lo dupliques), cada sysvar dos veces (`.x` y `*.x`);
     luego «Operadores» agrupados por `claseDe` (flujo, aritmética y
     comparación, lógica, pila, stores) a partir de `COMANDOS` de
     `vocabulario.js`; luego «Tus def» con `defs`.
   - Cada entrada: botón con la palabra; clic → `oninsertar(palabra)`;
     `pointerdown` → inicia arrastre con `arrastre.js`. Hover: tarjeta del
     manual (misma que E1.5).
3. **`Editor.svelte`**:
   - `modo` admite `'fichas'`; tercer botón en el `fieldset.seg`
     (`t('editor.modoFichas')`).
   - Con `modo === 'fichas'`, el lateral muestra `Paleta` (gana sobre Pila y
     Probar; el Laboratorio sigue ganando sobre todo, como hoy).
   - `posicionActiva = $state(-1)`: la fija `onhueco`; `oninsertar` de la
     paleta inserta ahí, o al final de la última línea del gen del cursor,
     o al final del texto.
   - Todas las acciones de Fichas pasan por `aplicarTexto(nuevo)` (que en
     este modo asigna `texto = nuevo`) y por `historial.anotar(texto)`
     antes del cambio. `deshacer`/`rehacer` aplican el texto devuelto.
   - `defs` para la paleta: `defsDe(texto)` de `resaltado.js`.
4. i18n: `editor.modoFichas`, `editor.fichas.zona.cond|cuerpo|else|fuera`,
   `editor.fichas.fueraDeGenes`, `editor.fichas.insertar`,
   `editor.fichas.pilaTras`, `editor.fichas.soltarAqui`,
   `editor.fichas.seleccionada`, `editor.paleta.titulo`,
   `editor.paleta.buscar`, `editor.paleta.operadores`,
   `editor.paleta.tusDef`, `editor.paleta.sinResultados`.
5. `editor_componentes.test.js` compila sin avisos. Test de integración
   puro (`test/editor_fichas.test.js`): secuencia de acciones sobre un ADN
   (reemplazar, insertar, mover, borrar, deshacer dos veces) y el texto
   final esperado.

**Cierre:** `npm test`, `npm run check`, build; a mano: en un bot propio,
modo Fichas, cambiar un número, insertar `.up` desde la paleta, arrastrar
una ficha, Ctrl+Z, volver a Texto y ver el mismo texto.

### E3.5 · Documentación de E3

1. `manual/es/app/editor.md`: sección `## Las fichas {#fichas}` después de
   `{#genes}`: qué es el modo, clic/«+»/arrastrar/Supr, la paleta, el
   deshacer propio del modo, la pila al pasar el cursor, y la nota «el texto
   es la fuente: comentarios y sangría no se tocan». Actualizá la sección
   `{#barra}` (tres modos). `en` con mismas anclas.
2. `generar.mjs --lint`; READMEs (frase de la app: «editor de ADN con texto,
   genes y fichas»).

**Cierre de E3:** `verificar-cambios`; commit.

---

## E4 · Evolución asistida

Desde el editor: generar K variantes del ADN con las mutaciones reales del
motor, probar cada una con la maquinaria de «Probar» (mismas semillas) y
mostrar cuál anduvo mejor; adoptar una (injertando solo los genes que
cambiaron, para conservar comentarios) o lanzar otra ronda desde ella.

### E4.1 · Export `db_sim_bot_mutate` (`port/wasm`)

**Archivos:** `port/wasm/dbcore_api.cpp`, `port/tests/test_host.cpp`.

1. Export, junto a `db_sim_bot_set_nrg`:
   ```cpp
   // PLAN-EDITOR.md E4 — aplica `db::mutate` al bot n `veces` veces.
   // modo 0 = en vida (puntuales), 1 = en reproducción (copia, inserción,
   // inversión, borrados…), 2 = ambos. factor >= 1 divide las tasas
   // (en el original son «1 cada N»: dividir intensifica). Pensado para una
   // sim descartable del worker; devuelve cuántas mutaciones hubo
   // (LastMut después − antes). 0 si el bot no existe.
   DB_EXPORT int db_sim_bot_mutate(void* h, int n, int modo, int veces, int factor);
   ```
   Implementación: validar `n`; guardar `b.Mutables` entero, `b.Mutables.Mutations`,
   `sim.opts.DisableMutations` y `sim.opts.EnableAutoSpeciation`; poner
   `Mutations = true`, `DisableMutations = false`, `EnableAutoSpeciation = false`,
   `mutarray[i] = max(1, mutarray[i] / factor)` para todo `i`; luego por
   cada vez: `if (modo != 1) db::mutate(sim, n, false); if (modo != 0) db::mutate(sim, n, true);`.
   Restaurar todo lo guardado (menos el ADN mutado, `DnaLen`, `genenum`,
   `LastMut`, `Mutations` del bot, que son el resultado). Si `mutate` exige
   `sim.sunbelt` para algunos operadores, dejalo como esté (no lo fuerces) y
   documentalo en el comentario. Antes de escribir, leé `mutate` en
   `mutations.hpp:911-1040` entero para confirmar qué estado toca.
2. Test en `test_host.cpp`: sim nueva, `db_sim_start(h, 7)`,
   `db_sim_insert_founder` con un ADN de 3 genes (tomá uno del propio
   archivo de tests o escribilo inline), `db_sim_bot_text` antes; llamar
   `db_sim_bot_mutate(h, n, 2, 20, 1000)`; comprobar que devuelve > 0 y que
   `db_sim_bot_text` después difiere. Con `factor = 1` y `veces = 1` sobre
   el mismo ADN, no exigir cambio (puede no mutar). Comprobar que
   `DisableMutations` y `EnableAutoSpeciation` quedan como estaban.

### E4.2 · Worker: `variantes`

**Archivos:** `engine/sim.js`, `engine/worker.js`, `engine/variantes.js`
(nuevo), `test/editor_variantes.test.js` (nuevo).

1. `engine/variantes.js` (puro):
   - `sinColaDeGuardado(texto)`: la misma función de E2.3 si quedó en
     `src/lib/inspector/adn.js`: movela acá y re-exportala desde allá.
   - `injertar(original, variante)` → `string`: con
     `diffGenes(original, variante)` de `engine/lineage.js`, construye el
     texto resultado sobre `original`: genes `igual` quedan tal cual (con
     sus comentarios); `cambiado` → las líneas del gen en `original` se
     reemplazan por las palabras del gen de `variante` (una línea por
     bloque `cond`/`start`/`else`/`stop`, con sangría de dos espacios para
     el contenido, como escribe `insertarGen` de `lab.js`); `agregado` →
     se inserta después del gen anterior con `insertarGenEn`; `quitado` →
     se quitan sus líneas. Leé primero `diffGenes` y `insertarGenEn` para
     respetar sus estructuras.
   - `distintas(textos)` → filtra variantes iguales entre sí o al original
     comparando `canonico` (`engine/adn.js`).
2. `sim.js`: `botMutate: C('db_sim_bot_mutate', n, [n, n, n, n, n])`.
   Handler `case 'variantes'` con `{adn, k, modo, factor, semilla, req}`:
   para `i` en `0..k*3` (tope para reponer repetidas) hasta juntar `k`
   distintas: `const h = api.create(); api.start(h, semilla + i);`
   `const nb = api.insertFounder(h, adn, 'variante', 0, 0, 1000);`
   si `nb < 0` → responder error `{t:'variantes', req, error:'adn'}`;
   `api.botMutate(h, nb, modo, 1, factor)`; `texto = sinColaDeGuardado(takeStr(api.botText(h, nb)))`;
   `api.destroy(h)`. Responder `{t:'variantes', req, textos: [...]}` (solo
   las distintas; puede ser menos de `k`). Nunca toca `sim` (la del
   usuario). Nombres reales de `create`/`start`/`insertFounder`/`destroy`
   en `bindApi()`: usá los que estén.
3. Protocolo en `worker.js`.
4. Tests: `injertar` con casos construidos (gen cambiado conserva el
   comentario del gen vecino; gen agregado; gen quitado; variante idéntica →
   texto idéntico). Con wasm: `variantes` con `k=4, modo=2, factor=1000`
   sobre un bot del Bestiario devuelve entre 1 y 4 textos distintos del
   original, y cada uno pasa `lint-dna` sin `error`.

### E4.3 · Trabajo «evolución»

**Archivos:** `src/lib/trabajos/evolucion.js` (nuevo),
`src/lib/trabajos/ejecutores.js`, `engine/biblioteca.js` (`historialBot`),
`test/trabajos_evolucion.test.js` (nuevo).

1. `evolucion.js`, calcado de `prueba.js`: `TIPO_EVOLUCION = 'evolucion'`,
   `crearParamsEvolucion({clave, nombre, vegetal, adn, textos, k, modo, factor, semilla, base, copias, ciclos})`
   (reusa `crearParamsPrueba` para las semillas de réplica, que son las
   mismas para la base y para cada variante), `unidadesEvolucion(p)` → una
   unidad por texto: la base (`variante = -1`) y cada variante
   (`variante = i`), cada una con `correrPrueba` sobre su texto;
   `resumenEvolucion(p, datos)` → `{base: ResumenVersion, variantes: [{i, texto, resumen: ResumenVersion, genesCambiados}]}`
   ordenado por `sobreviven` desc, luego `hijosPorCopia` desc;
   `genesCambiados` = `cambiados + agregados + quitados` de `diffGenes`.
   `ejecutorEvolucion(d)` con `unidad`, `final` y `vista` como en
   `ejecutorPrueba`. Registrar en `ejecutores.js`.
2. `historialBot` en `engine/biblioteca.js`: incluir `tipo === 'evolucion'`
   con la misma clave (`p.clave`), para que la ficha lo liste en Historial
   (`src/lib/bots/Historial.svelte`: si distingue por tipo, agregá el rótulo
   `t('bots.historial.evolucion')`).
3. Tests: `unidadesEvolucion` genera k+1 unidades con las mismas semillas;
   `resumenEvolucion` ordena bien con datos armados a mano.

### E4.4 · `PanelEvolucionar.svelte`

**Archivos:** `src/lib/bots/editor/PanelEvolucionar.svelte` (nuevo),
`Editor.svelte`, `src/i18n/*/editor.json`.

1. Props: `{clave, nombre, vegetal, texto, soloLectura, onadoptar: (texto: string, nota: string) => void}`.
   Solo se monta para bots propios (`esPropio && !soloLectura`), debajo de
   `PanelProbar` en el lateral.
2. Campos: variantes (`<input type=number>` 1..16, por defecto 8),
   intensidad (`<select>` 1× / 4× / 16× → `factor` 1, 4, 16), tipo
   (`<select>` ambos / en vida / en reproducción → `modo` 2, 0, 1), y los
   mismos copias × ciclos que `PanelProbar` (leé de ahí cómo los guarda:
   `POR_DEFECTO`/`LIMITES` de `prueba.js`). Semilla: aleatoria por ronda,
   mostrada.
3. Botón «Generar y probar»: manda `variantes` al worker del editor
   (`linter.js`: agregá `variantes(params)` con la misma mecánica de
   «último pedido»); con los textos, encola un trabajo `TIPO_EVOLUCION` con
   `iniciarTrabajos().encolar({tipo, params, unidades, titulo})` como hace
   `PanelProbar`. Mientras corre, muestra el progreso de la cola (como
   Probar).
4. Resultado (del último trabajo de este tipo y esta clave en
   `estadoTrabajos.lista`, como lee Probar): tabla con la base resaltada y
   una fila por variante: `#`, genes cambiados, sobreviven, hijos/copia,
   energía media; botones **Ver diff** (abre `DiffGenes` con
   `diffGenes(original, variante)`; `DiffGenes` recibe hoy un diff de
   versiones: comprobá su prop `diff` y adaptá con un adaptador puro si la
   forma difiere), **Adoptar** (`onadoptar(injertar(texto, variante), t('editor.evolucion.notaAdoptada', {i, semilla, factor}))`),
   **Otra ronda desde esta** (vuelve a generar con `adn = injertar(...)`
   sin adoptar; el resultado de la nueva ronda muestra «base: variante i de
   la ronda anterior»).
5. `Editor.svelte`: `onadoptar` → `aplicarTexto(nuevo)` y `nota = notaSugerida`
   (el usuario guarda cuando quiere; queda como cambio sin guardar y en el
   deshacer del modo texto).
6. i18n: `editor.evolucion.titulo`, `.variantes`, `.intensidad`, `.tipo`,
   `.tipo.ambos|vida|reproduccion`, `.generar`, `.generando`, `.base`,
   `.variante` («Variante {i}»), `.genesCambiados`, `.verDiff`,
   `.adoptar`, `.otraRonda`, `.notaAdoptada`, `.sinVariantes` («el motor no
   produjo variantes distintas; subí la intensidad»), `.errorAdn`,
   `.semilla`. Y `bots.historial.evolucion` en `bots.json` si E4.3 lo pide.

**Cierre:** `npm test`, `npm run check`, build; a mano: bot propio, 4
variantes, 4×, generar, ver tabla, ver diff, adoptar, guardar versión;
comprobar en Historial que aparece la ronda.

### E4.5 · Documentación de E4

1. `manual/es/app/editor.md`: sección `## Evolucionar {#evolucionar}`
   después de `{#probar}`: qué hace, qué es cada campo, cómo leer la tabla,
   que «Adoptar» injerta solo los genes cambiados y no guarda versión, que
   las variantes no adoptadas no se guardan, y que las mutaciones son las
   del motor (enlazá la página del manual que describa las mutaciones:
   buscá «mutaci» en `manual/es/simulacion/` o `manual/es/spec/`). `en`
   igual.
2. `manual/*/tecnico/`: `db_sim_bot_mutate` donde se listan los exports,
   con la nota «solo sobre sims descartables del worker».
3. `generar.mjs --lint`; READMEs (frase de la app: «…y evoluciona bots
   con las mutaciones del motor»); cifras.

**Cierre de E4:** `verificar-cambios`; commit.

---

## Al terminar las cuatro etapas

1. En `PLAN.md`, la decisión 26 ya nombra las cuatro piezas; si algo de lo
   construido se apartó de ella, corregí esa fila. En `DOCUMENTACION.md`
   este plan ya figura como `vivo`: pasalo a `histórico` y movelo a
   `port/web2/historial/` solo si el autor lo pide.
2. `port/README.md`: una línea en la sección de la app que nombre las cuatro
   herramientas.
3. Mensaje de cierre al autor con: cifras finales de tests, qué rutinas del
   core cambiaron (`vm.hpp`, `master.hpp`, `stacks.hpp`), qué quedó fuera
   (reordenar genes arrastrando, cruzar bots, rondas automáticas) y
   cualquier punto donde el código obligó a apartarse del plan.
