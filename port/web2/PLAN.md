# Frontend nuevo (web2): plan

Rediseño completo de la interfaz web del port. Solo se exige compatibilidad
con la lógica: el motor (`core/` compilado a `dbcore.wasm`) no cambia de
comportamiento. La interfaz actual (`port/web/`) queda congelada y se sigue
publicando en `/classic/`.

Bocetos navegables de las pantallas (Inicio, Observar, Bot seleccionado,
Experimentar, Analizar, Informe, Bots, Competir): lienzo de diseño privado del
autor. Los datos de los bocetos son de ejemplo, salvo los nombres de bots, los
sysvars y el ADN de Zebedee V2.1.

Este plan no forma parte de `spec/`: es un añadido fuera de etapa.

## Decisiones

| # | Tema | Decisión |
|---|------|----------|
| 1 | Frontera | `dbcore.wasm` intocable. La orquestación de `worker.js` y la lógica de torneos (`league.js`, `tournament.js`, `contest.js`) se extraen a `engine/`, sin DOM y con smokes. La interfaz es 100 % nueva. |
| 2 | Público | Principal: el experimentador. Inicio = panel del mundo + estadísticas vivas; modos básico/avanzado; herramientas de veterano en el inspector; galería de escenarios. |
| 3 | Stack | Vite + Svelte 5 + Biome, **sin TypeScript**: JS con JSDoc y `// @ts-check` (`jsconfig` con `checkJs`, solo en el editor). Tests con `node:test`. Salida `dist/` estática, `base: './'`, rutas por hash, sin SharedArrayBuffer. |
| 4 | Idioma | i18n propio (`t()` sin dependencias): `es.json` como fuente y `en.json`. Los sysvars, opcodes y nombres de bots no se traducen. |
| 5 | Paridad | La interfaz clásica queda congelada en `/classic/` y comparte el build del wasm. Quedan afuera a propósito: monitor RGB, skins (DrawRobSkin), imagen de fondo, ventanas de gráfico posicionadas y `.gsave` (reemplazado por export CSV). |
| 6 | API wasm | Se permiten exports de **solo lectura** en `port/wasm/dbcore_api.cpp` (p. ej. `db_sim_dump_lineage`, `db_sim_species_stats`). Garantía: un test comprueba que un `.dbsim` sale idéntico byte a byte con los exports usados y sin usar. Los 143 casos dorados de `core/` no se tocan. |
| 7 | Métricas | Seis grupos desde la primera versión: Población, Evolución, Genética (con histogramas), Comportamiento (disparos por tipo, reproducciones, lazos, defensas por especie; amplía lo que ya detecta `db_sim_vis_observe`), Energía y Entorno. |
| 8 | Historia | Muestra cada 100 ciclos (configurable), hasta ~2.000 puntos por serie. Al llenarse, los puntos viejos se funden de a dos y guardan media, mínimo y máximo (2–5 MB por corrida). Eventos y linaje se guardan aparte, sin reducir. Se conservan las últimas 20 corridas y las marcadas. |
| 9 | Genealogía | Árbol de especies completo (el motor ya autoespecia: `(5001)Nombre`), más individuos podados a los ancestros de los vivos. Foto periódica del ADN dominante de cada especie, para compararlo gen por gen con el fundador. |
| 10 | Comparar | Dos corridas superpuestas, con sus diferencias de configuración. Réplicas con N semillas: sin dibujar, a máxima velocidad y en varios workers, con media, banda p10–p90 y tabla de medias y desvíos. Cola de trabajos que sobrevive a una recarga y avisa al terminar. El barrido de parámetros queda para el nivel 4. |
| 11 | Informes | Un solo `.html` autocontenido (SVG + datos embebidos), imprimible a PDF con CSS de impresión, sin jsPDF. Plantillas: Corrida, Comparación, Réplicas y Torneo. Resumen escrito por reglas (sin IA ni servidor): cada frase enlaza a su figura y, si un detector no encuentra nada, no escribe. Export CSV/JSON/PNG. |
| 12 | Escenario | La unidad de configuración es el *escenario* JSON: opciones (base + cambios), especies (bot, hash del ADN, cantidad, color, vegetal), objetos (obstáculos, teleporters), nombre, descripción y etiquetas. Los de fábrica son de solo lectura; los propios van en IndexedDB y se exportan e importan como `.json`. La semilla va aparte. Corrida = escenario + semilla + cambios en caliente. |
| 13 | En caliente | Experimentar edita un borrador; «Aplicar a la actual» manda solo el diff. Cada parámetro indica si se aplica en vivo o si requiere simulación nueva (solo el tamaño del campo y la siembra inicial). Cada cambio aplicado queda como evento y las réplicas lo repiten en el mismo ciclo. |
| 14 | Parámetros | Básico: ~10 controles, algunos compuestos (Costos F1 / sin costos / personalizados escribe los 71; intensidad = `MutCurrMult`). Avanzado: todos los parámetros por grupo, con buscador, nombre de variable, marca de «cambiado» y vuelta a la base. Catálogo declarativo `engine/opciones.js` con un test que verifica que cubre todos los ids del wasm. |
| 15 | Objetos y modos | Obstáculos, laberintos y teleporters se editan sobre el mundo (barra «Mundo» en Observar); Experimentar muestra un resumen. El contest F1 manual pasa a Competir (single). Player Bot Mode va al inspector (nivel 4). |
| 16 | Internet Mode | Tarjeta «Conexión» en Experimentar, más un indicador en la barra superior mientras está activo (abre los censos de los pares). Pasa a E13 (ver C22). |
| 17 | Datos del usuario | IndexedDB propia `darwinbots2` (bots propios, escenarios, corridas, informes, torneos, trabajos). La primera vez que arranca **copia** `darwinbots-inventario` y `darwinbots-ligas` de la clásica (mismo origen en Pages) y avisa qué importó; la clásica no se toca. Los imports aceptan los JSON viejos (inventario, torneos v1 y v2). |
| 18 | Editor de ADN | Propio y sin dependencias: `textarea` con capa de resaltado y autocompletado de sysvars; `db_dna_lint` en el worker con debounce; vista por genes (plegar, apagar = comentar); versiones con diff gen por gen; «Probar» = N copias × X ciclos sin dibujar (la maquinaria de las réplicas), con supervivencia, hijos y energía contra la versión anterior. Los bots del foro son de solo lectura: se editan duplicándolos. |
| 19 | Laboratorio | Es un panel «Genes» del mismo editor: busca en `genes.json` por capacidad o por bot. Los avisos de la clásica (memoria leída de otro gen, direcciones compartidas → remapeo 971-990, `.delgene`/`.mkvirus` literales) son avisos del editor con arreglo en un clic. Cada gen guarda su bot de origen. |
| 20 | Ficha del bot | Pestañas Resumen (descripción, capacidades, qué lee y escribe, notas, etiquetas), ADN (editor + laboratorio) e Historial (corridas, torneos y pruebas, cruzados por hash del ADN, con enlaces). La biblioteca mantiene agrupar, selecciones con nombre y siembra en lote. |
| 21 | Torneos: modelo | Se conserva «todo es un torneo» (lógica de `engine/league.js`, sin cambios de resultados). Las reglas del mundo son un escenario (decisión 12, sin especies) más los valores del partido, bloqueados desde el primer partido. Partido rápido sin guardar, con «Guardar como torneo». |
| 22 | Torneos: pantallas | Nuevo torneo = asistente de 3 pasos (formato con esquema, participantes desde la Biblioteca con el ADN congelado, reglas). Vistas: Tabla, estructura según el formato (Rondas en el suizo, Grupos y cuadro en el mundial, Peleas y coronas en la colina, Escalera, Calendario), Partidos (↻ repetir; «Repetir y analizar» lo vuelve a correr con su semilla y lo abre en Analizar) y Reglas. Salón de la fama global. Plantilla de informe de Torneo. |
| 23 | Torneos: jugar | «Jugar y mirar» un partido en Observar; «en segundo plano» la ronda entera corre sin dibujar en varios workers (la cola de la decisión 10). Test: el resultado de cada partido es idéntico al que da jugándolo en secuencia, porque cada partido lleva su semilla. Avance automático (juega la temporada entera, con cortinillas, y sigue con otra edición) en dos presentaciones que se alternan sin cortarlo: modo TV = Observar a pantalla completa con rótulos (`#/observar/tv`), y con paneles = Observar con el panel lateral y la barra (`#/observar/torneo`; bloquea Sembrar, Mundo y Corridas). Se detiene al salir de Observar. |

## Estructura

```
port/
  web/                 interfaz clásica, congelada (se publica en /classic/)
  web2/
    PLAN.md
    package.json       vite, svelte, @sveltejs/vite-plugin-svelte, @biomejs/biome
    vite.config.js     base './', salida dist/
    jsconfig.json      checkJs
    engine/            sin DOM: sim en worker, protocolo, torneos, historia, informes
      worker.js        orquestación extraída de web/worker.js
      league.js …      torneos extraídos (swiss, cup, koth, rr, ladder, single)
      opciones.js      catálogo declarativo de parámetros (id, grupo, es/en, rango, vivo, nivel)
      escenarios/      escenarios de fábrica (.json) y validación del formato
      history.js       muestreo con presupuesto y fusión media/mín/máx
      lineage.js       árbol de especies y poda de individuos
      detectors.js     reglas del resumen automático
      report/          plantillas de informe (string → .html)
    src/               Svelte: rutas, pantallas, componentes, i18n
      i18n/es.json, en.json
    test/              node:test (engine/ y detectores)
```

`engine/` no importa nada de `src/`. La interfaz solo habla con el motor a
través de su API (mensajes al worker y funciones puras).

## Etapas

Cada etapa se cierra cuando se cumple su criterio. Mientras tanto, los 143
casos dorados y los smokes existentes siguen en verde.

### E0 · Andamiaje

- `port/web2/` con Vite + Svelte 5 + Biome, `jsconfig` con `checkJs` y
  `node:test`.
- `t()` con `es.json`/`en.json`, selector ES/EN y router por hash.
- `pages.yml`: compila el wasm una vez y publica la nueva interfaz en la raíz
  y la clásica en `/classic/`, con el mismo `build-wasm/`. Se mantiene el
  versionado de scripts (cache busting) en las dos.
- Desde E0 la raíz es la nueva, con un aviso visible («en construcción») y un
  enlace a `/classic/` hasta cerrar el nivel 3. Cerrado el nivel 3, el aviso
  se retiró (2026-10-01); la clásica sigue enlazada desde la barra superior.

**Cierre:** el CI publica en la raíz una cáscara con la navegación de 6
secciones y el aviso, y `/classic/` funciona igual que hoy.

### E1 · Extraer `engine/`

- Mover la orquestación de `web/worker.js` a `engine/worker.js` sin tocar el
  protocolo del wasm.
- Extraer la lógica de torneos de `league.js`, `tournament.js` y `contest.js`,
  separada de sus ventanas.
- Adaptar `tools/swiss/smoke_suizo.mjs` y `tools/e12/smoke_copa.mjs` (o
  duplicarlos) para que corran contra `engine/`.

**Cierre:** los smokes de suizo y copa pasan contra `engine/` con los mismos
cruces y resultados que contra `web/`, y una corrida con semilla fija da el
mismo `.dbsim` desde las dos orquestaciones.

### E2 · API wasm de solo lectura

- `db_sim_dump_lineage` (AbsNum, parent, especie, generación, mutaciones,
  BirthCycle, DnaLen) y `db_sim_species_stats`.
- Todo lo que falte para los 6 grupos de métricas, siempre de solo lectura.

**Cierre:** el test byte a byte del `.dbsim` (con los exports y sin ellos) pasa
en CI y los 143 dorados siguen iguales.

### Nivel 1 · Base

Inicio (escenarios, última corrida, corridas guardadas, bots recientes);
Observar (mundo, controles, feed de eventos, estadísticas vivas); inspector del
bot, que reemplaza al panel de estadísticas; Experimentar en modo básico
con escenarios (de fábrica y propios) y cambios en caliente registrados;
guardar y cargar `.dbsim`; corridas guardadas en IndexedDB.

**Cierre:** alguien sin experiencia elige un escenario, lo corre, inspecciona
un bot, guarda la corrida y la retoma, todo en español e inglés.

### Nivel 2 · Análisis

Historia con presupuesto (decisión 8), los 6 grupos de métricas, Analizar con
Panel (4 gráficos de un catálogo), Especies, Filogenia, Genética, Eventos
(clic → marca el ciclo en los gráficos), Comparar (dos corridas + réplicas con
cola) e Informes (Corrida, Comparación y Réplicas). Detectores iniciales:
dominio, colapso, extinción y crecimiento del ADN.

**Cierre:** en una corrida de 50.000 ciclos, la historia ocupa ≤ 5 MB, el
informe se abre sin conexión y se imprime bien, y los detectores tienen tests
con series armadas a mano (incluido el caso en que no escriben nada).

### Nivel 3 · Gestión

Bots (biblioteca, ficha con historial, editor de ADN con «Probar» y
versiones, laboratorio, migración de los datos de la clásica,
import/export), Competir (single, koth, rr, ladder, cup y suizo con
Buchholz; Elo; asistente; rondas en segundo plano; TV),
plantilla de informe de Torneo, Experimentar en modo avanzado (todos los
parámetros), barra «Mundo» en Observar (obstáculos, laberintos,
teleporters).

**Cierre:** todo lo que hace la clásica en estas áreas se puede hacer en la
nueva, salvo lo excluido en la decisión 5 e Internet Mode, que pasa a E13
(C22).

### Nivel 4 · Veterano

Herramientas avanzadas del inspector, barrido de parámetros, más detectores
(sustitución de especie, oscilaciones…) y lo que surja del uso.

**Cierre:** lo define la lista de pedidos al terminar el nivel 3.

## Pendiente de decidir

- Nada de pantallas: Inicio, Observar, Experimentar, Analizar, Bots y
  Competir tienen sus decisiones y su boceto. Lo que surja al construir se
  agrega a esta tabla.

## Decisiones tomadas durante la construcción

Tomadas por el orquestador de la construcción cuando el plan no las resolvía
(la opción más simple y coherente con las 23 decisiones).

| # | Qué | Por qué | Alternativa descartada |
|---|-----|---------|------------------------|
| C1 | Los datos del Bestiary (`bots.json`, `profiles.json`, `genes.json` y los `.txt`) se leen de `classic/bots/`, la carpeta que ya publica la clásica. | Evita duplicar 6,4 MB en el sitio y mantiene una sola fuente. | Copiarlos a `/bots/` en la raíz. |
| C2 | El wasm se pide a `./build-wasm/` (relativo a la raíz del sitio). En desarrollo y en `vite preview`, un plugin de `vite.config.js` sirve `/build-wasm/` desde `port/build-wasm/` y `/classic/` desde `port/web/`, así la prueba local replica el layout de Pages. | Mismo layout en local y en Pages, sin copiar archivos a `public/`. | Copiar el wasm a `public/` en cada build. |
| C3 | `engine/worker.js` es un worker clásico (Vite `worker.format: 'iife'`) que carga `dbcore.js` con `importScripts`; su primer mensaje es `{t:'init', base, v}` (URL base del wasm y versión). | `dbcore.js` es un script MODULARIZE clásico; un worker módulo no puede usar `importScripts`. El `init` desacopla la ruta del wasm del lugar donde Vite deja el worker. | Worker módulo con `fetch` + `eval` de `dbcore.js`. |
| C4 | Versionado de la nueva: Vite pone hash en sus assets; `dbcore.js` y `dbcore.wasm` se piden con `?v=<id>`, donde `<id>` es `DB_BUILD_ID` en el build (en Pages, el commit corto) y se inyecta como `__BUILD_ID__`. | Cumple el cache busting pedido en E0 sin tocar los nombres de los artefactos del wasm. | Renombrar los artefactos con hash. |
| C5 | `ci.yml` suma un job `web2` (`npm ci`, `npm test`, `biome check`, `vite build`). | El CI ya es el lugar de las reglas duras; la nueva también las tiene. | Solo verificar en `pages.yml`. |
| C6 | Los smokes contra `engine/` viven en `port/web2/test/smokes/` (copias adaptadas de los de `tools/`), y un test de `node:test` compara `web/` con `engine/` sobre los mismos casos. | La comparación directa es la prueba más fuerte de «mismos cruces y resultados»; `tools/` queda como está. | Parametrizar los smokes de `tools/` por carpeta. |
| C7 | La autoespeciación (`EnableAutoSpeciation` y sus parámetros) no se expone en la nueva: el core la tiene, pero `db_sim_set_opt` no la escribe y agregar ese setter no es de solo lectura (decisión 6). El árbol de especies (decisión 9) se arma con las especies que existan: sembradas, llegadas por teleporter y las autoespeciadas de un `.dbsim` cargado que la traiga encendida. | Respeta la decisión 6 sin reinterpretarla; queda para que el autor decida si amplía la API. | Agregar un setter en `dbcore_api.cpp`, o parchear los bytes de un `.dbsim` para encenderla. |
| C8 | Los volcados de E2 usan int32 donde hay identificadores (linaje: AbsNum, parent…) y float en el resto; el índice de especie es siempre el de la tabla de la vista (`db_sim_vis_species_*`). Se suman `db_sim_species_origin` y `db_sim_species_dominant` para la decisión 9. | En float, AbsNum pierde exactitud pasado 16,7 millones; un solo índice de especie evita cruces. | Todo en float, o un índice propio por export. |
| C9 | Las claves de i18n se reparten en un archivo por área (`src/i18n/es/<área>.json` y `src/i18n/en/<área>.json`: `app`, `observar`, `inspector`, `experimentar`, `inicio`, …) que `t()` junta al cargar; la clave lleva el área como prefijo (`observar.pausar`). El test de claves recorre todos los pares. | Varios pasos de interfaz corren en paralelo y un solo `es.json` sería un punto de choque constante. | Un único `es.json`/`en.json` con integración manual de cada paso. |
| C10 | La interfaz usa `engine/worker.js` con `init.base` absoluto (`new URL('./build-wasm/', document.baseURI)`) y `v = BUILD_ID`. | `importScripts` dentro del worker resuelve contra `assets/`, no contra la raíz. | Rutas relativas dentro del worker. |
| C11 | El control básico de mutaciones es «Mutaciones sí/no»; la intensidad (`MutCurrMult`) no se ofrece porque la API no la escribe y un setter no sería de solo lectura (decisión 6). | Igual que C7: no se amplía la API sin el autor. | Agregar el setter en `dbcore_api.cpp`. |
| C12 | Las opciones que la clásica solo aplica al reiniciar (energía solar, repoblación, tope y siembra de vegetales, mutaciones…) se aplican en vivo con un mensaje nuevo del worker (`setbase`) que llama a los exports que ya existen (`db_sim_set_minvegs`, `db_sim_set_repop`, …). Quedan como «requiere nueva» solo el tamaño del campo y la siembra inicial (decisión 13). | La decisión 13 lo pide así y no hace falta tocar la API: es orquestación. | Marcarlas como «requiere nueva». |
| C13 | Los objetos del escenario son órdenes al motor (1 forma al azar, 10 al azar, laberinto de tipo X, teleporter), no posiciones: el worker no acepta coordenadas y las ubica el motor con la semilla. Cambiar objetos requiere sim nueva. | Es lo que expone el protocolo sin ampliar la API. | Guardar coordenadas (exigiría un export de escritura). |
| C14 | Las corridas guardan el `.dbsim` en un store aparte (`corridas-datos`) y los metadatos en `corridas`; la base «Sin costos» es la opción del control Costos, no una base propia. | Listar corridas no debe leer varios MB por corrida. | Un solo store. |
| C15 | Reproducibilidad: «escenario + semilla» debe dar la misma corrida en cualquier worker. El `reset` acepta un indicador de orquestación `limpio: true` que no arrastra estado de la sim anterior (lo que hoy arrastra `db_sim_startnew_carry`, el registro de formas, etc.), y los colores de las formas nuevas salen de un generador sembrado con la semilla de la corrida en vez de `Math.random`. La clásica sigue igual (el indicador es opcional). | Las réplicas, «Repetir y analizar» y las corridas guardadas dependen de eso; se logra sin tocar la API. | Un worker nuevo por corrida (más lento y no cubre las formas). |
| C16 | Las pruebas en navegador de cada pantalla las hace el orquestador al integrar; los agentes en paralelo verifican con tests y build. | Varios agentes compartiendo la ventana de Chrome se ocultaban y cerraban las pestañas, y con la pestaña oculta el rAF no corre. | Que cada agente pruebe en su pestaña. |
| C17 | Retomar una corrida guardada continúa desde el `.dbsim`, que al cargarse vuelve a sembrar el azar (como la clásica): el futuro de una corrida retomada es válido pero no idéntico al que habría tenido sin guardar. Lo que sí se garantiza: la misma corrida cargada en cualquier worker sigue igual (el ADN faltante se repone con `dna-missing` y se reescriben los ajustes que el `.dbsim` no guarda: `StartChlr` y opciones 92–101). | Es comportamiento del core y la decisión 6 no permite cambiarlo. | Guardar además el estado del RNG (exigiría escribir en la API). |
| C18 | «Costos F1» (control compuesto de la decisión 14) escribe los 36 costos del catálogo, no los 71 índices: el resto vale 0 en toda sim nueva y el resultado es idéntico (verificado contra el motor en 371 casos). | Solo se escriben ids con nombre y significado en el core. | Escribir los 71 índices a ciegas. |
| C19 | Semillas: el motor usa solo 16 bits del estado derivado de la semilla (`Randomize(seed/100)`, `rng.hpp`), así que hay 65.536 mundos distintos. Las réplicas descartan semillas cuyo estado equivalente ya salió (se calcula en JS con la misma mezcla) y la primera réplica es la semilla de la corrida. | Dos réplicas con el mismo mundo achican la banda y el desvío sin aviso. | Confiar en semillas distintas (3,5 % de trabajos de 64 réplicas repetían un mundo). |
| C20 | La cola de trabajos corre en una sola pestaña (`navigator.locks`); las demás la ven por `BroadcastChannel` y no ejecutan. Se reanuda al arrancar la app, no al abrir Comparar. | Evita trabajos duplicados o resucitados entre pestañas; cumple «sobrevive a una recarga» (decisión 10). | Un lease en IndexedDB. |
| C21 | Historia: manda el tope de 5 MB por corrida (decisión 8, «2–5 MB») sobre el de ~2.000 puntos por serie. Con 20 especies y los 6 grupos, 50.000 ciclos dan 501 puntos (2,2 MB) y 400.000 ciclos 869 puntos (4,6 MB); con 100 especies, unos 180. Los puntos viejos guardan media en float32 y mín/máx cuantizados a 8 bits por columna (la banda guardada contiene a la real, error ≤ 1/255); el último punto es siempre la última muestra sin fundir; la resolución queda pareja en el tiempo. | Llegar a 2.000 puntos con 20 especies exigiría < 2 B por valor (cuantizar también las medias). | Cuantizar las medias, o subir el tope de 5 MB. |
| C22 | Internet Mode (decisión 16) queda fuera por ahora, por pedido del autor (2026-09-30). El borrador parcial `src/lib/internet/` se retiró del árbol; está en el commit `4b05e1c` para retomarlo. El protocolo IM del worker y sus smokes siguen intactos. Actualización (2026-10-01): sale del nivel 3 y va con E13 (`spec/PLAN-EXTENSIONES.md`), cuyo servidor ya prevé el relay en `/im`. Sin servidor solo hay BroadcastChannel, que conecta pestañas del mismo navegador y no es Internet; WebRTC tampoco lo evita (necesita señalización y, tras muchos NAT, TURN). | Pedido explícito del autor; Internet Mode necesita un servidor. | Terminarlo en el Nivel 3 solo con BroadcastChannel, o con WebRTC. |
| C23 | Rangos de los parámetros: el límite duro es el del tipo con que el core guarda cada valor (i16, i32, f32, f64, u8); el rango razonable anterior queda como `sugerido` y fuera de él solo hay un aviso. Excepciones: el tamaño del campo conserva su tope (un campo enorme agota la memoria del motor) y los enteros siguen exigiendo número entero. Los opt que el core satura (36, 38, 52, 56, 99) se guardan en su tope con aviso. | Paridad con la clásica, que acepta valores sin límites (Nivel 3: «todo lo que hace la clásica»), sin permitir valores que el core corrompe. | Mantener rangos estrictos. |
