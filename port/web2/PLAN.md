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
| 16 | Internet Mode | Tarjeta «Conexión» en Experimentar, más un indicador en la barra superior mientras está activo (abre los censos de los pares). Nivel 3. |
| 17 | Datos del usuario | IndexedDB propia `darwinbots2` (bots propios, escenarios, corridas, informes, torneos, trabajos). La primera vez que arranca **copia** `darwinbots-inventario` y `darwinbots-ligas` de la clásica (mismo origen en Pages) y avisa qué importó; la clásica no se toca. Los imports aceptan los JSON viejos (inventario, torneos v1 y v2). |
| 18 | Editor de ADN | Propio y sin dependencias: `textarea` con capa de resaltado y autocompletado de sysvars; `db_dna_lint` en el worker con debounce; vista por genes (plegar, apagar = comentar); versiones con diff gen por gen; «Probar» = N copias × X ciclos sin dibujar (la maquinaria de las réplicas), con supervivencia, hijos y energía contra la versión anterior. Los bots del foro son de solo lectura: se editan duplicándolos. |
| 19 | Laboratorio | Es un panel «Genes» del mismo editor: busca en `genes.json` por capacidad o por bot. Los avisos de la clásica (memoria leída de otro gen, direcciones compartidas → remapeo 971-990, `.delgene`/`.mkvirus` literales) son avisos del editor con arreglo en un clic. Cada gen guarda su bot de origen. |
| 20 | Ficha del bot | Pestañas Resumen (descripción, capacidades, qué lee y escribe, notas, etiquetas), ADN (editor + laboratorio) e Historial (corridas, torneos y pruebas, cruzados por hash del ADN, con enlaces). La biblioteca mantiene agrupar, selecciones con nombre y siembra en lote. |
| 21 | Torneos: modelo | Se conserva «todo es un torneo» (lógica de `engine/league.js`, sin cambios de resultados). Las reglas del mundo son un escenario (decisión 12, sin especies) más los valores del partido, bloqueados desde el primer partido. Partido rápido sin guardar, con «Guardar como torneo». |
| 22 | Torneos: pantallas | Nuevo torneo = asistente de 3 pasos (formato con esquema, participantes desde la Biblioteca con el ADN congelado, reglas). Vistas: Tabla, estructura según el formato (Rondas en el suizo, Grupos y cuadro en el mundial, Peleas y coronas en la colina, Escalera, Calendario), Partidos (↻ repetir; «Repetir y analizar» lo vuelve a correr con su semilla y lo abre en Analizar) y Reglas. Salón de la fama global. Plantilla de informe de Torneo. |
| 23 | Torneos: jugar | «Jugar y mirar» un partido en Observar; «en segundo plano» la ronda entera corre sin dibujar en varios workers (la cola de la decisión 10). Test: el resultado de cada partido es idéntico al que da jugándolo en secuencia, porque cada partido lleva su semilla. Modo TV = Observar a pantalla completa con rótulos y cortinillas. |

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
  enlace a `/classic/` hasta cerrar el nivel 3.

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
teleporters) e Internet Mode.

**Cierre:** todo lo que hace la clásica en estas áreas se puede hacer en la
nueva, salvo lo excluido en la decisión 5.

### Nivel 4 · Veterano

Herramientas avanzadas del inspector, barrido de parámetros, más detectores
(sustitución de especie, oscilaciones…) y lo que surja del uso.

**Cierre:** lo define la lista de pedidos al terminar el nivel 3.

## Pendiente de decidir

- Nada de pantallas: Inicio, Observar, Experimentar, Analizar, Bots y
  Competir tienen sus decisiones y su boceto. Lo que surja al construir se
  agrega a esta tabla.
