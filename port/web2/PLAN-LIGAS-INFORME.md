# Informe: ejecución de PLAN-LIGAS.md

Corrida sin atender de [`PLAN-LIGAS.md`](PLAN-LIGAS.md) con la receta de
[`PLAN-LIGAS-ORQUESTADOR.md`](PLAN-LIGAS-ORQUESTADOR.md): un orquestador
(Opus 5.5) que lanza un subagente `desarrollador` por paso, verifica por su
cuenta y commitea. El 2026-10-11, en una sesión. Los doce pasos de L1 a L4.1
quedaron hechos, más este cierre, en 13 commits sobre `main` (de `904d1dd` a
este), **sin push**. Ningún paso tocó `port/core/`, `port/wasm/`,
`port/web/` ni `Darwinbots2/`, y `package.json` no cambió.

Es un registro: no se actualiza.

## Cifras

| | Antes de la corrida | Al terminar |
|---|---|---|
| Suite C++ (`dbtests`): g++, clang y wasm | 302 casos, 4755 aserciones | 302 / 4755 (el motor no cambió) |
| `tests/wasm/solo_lectura.mjs` | 37 ok | 37 ok |
| `npm test` (port/web2) | 887 | 930, todos en verde, ninguno salteado |
| `npm run check` (Biome) | limpio (407 archivos) | limpio (412 archivos) |
| `generar.mjs --lint` | 441 páginas, 532 bloques `adn` | 441 / 532 por idioma, 0 pendientes |

En el cierre (L4.2) pasó `verificar-cambios` completo: las tres suites C++,
`npm test`, Biome, `npx vite build`, los nueve smokes de `test/smokes/`,
`generar.mjs --lint`, `armar-sitio.sh` en modo local y
`git diff 02b20d7 -- Darwinbots2/` vacío. Al cerrar L2 y L3 pasaron el lint
del manual y `test/claves.test.js` y `test/manual.test.js`, sin correcciones.

Tests nuevos: `test/ligas.test.js`, `test/ligas_worker.test.js` (con wasm) y
`test/admision.test.js`; se extendieron `escenarios`, `competir_ui` y
`experimentar_vivo`.

## Reintentos

Uno solo. L1.1 dejó dos fallas en `npm test`: las etiquetas de los escenarios
nuevos sin traducción (`test/inicio.test.js`) y `std::bad_alloc` en
`test/experimentar_vivo.test.js`, que recorre todos los escenarios de fábrica
y no liberaba las sims. El segundo intento (mismo modelo, haiku) lo corrigió.
Nada más falló.

## Desvíos por paso

- **L1.1** (`904d1dd`): las seis etiquetas de liga tienen clave en `ETIQUETAS`
  e i18n (mismo texto en es y en). SS usa Brevis y no Animal_Archaea 1.1, que
  tiene dos `store`. `experimentar_vivo.test.js` ahora libera sus sims.
- **L1.2** (`4ddb6e4`): la acción prohibida del test es `.mkslime` (F3) y no
  un tie: no depende de que dos bots se toquen. El worker ya informaba la DQ
  como línea `DQ: …`, así que no quedó ningún `test.todo`.
- **L2.1** (`3e1e9e7`): el plan solo daba las etiquetas de nombre de F2; el
  orquestador completó las de F3, MB, SB y SS siguiendo las categorías de D7
  (F3 → F3; MB → MB; SB → SB, SS; SS → SS).
- **L2.2** (`487f7bb`): `tipoDeReglas` da `'liga'` para las seis que no son
  F1 (F1 sigue como `'f1'`), con `ligaSeleccionada(rules)` para saber cuál.
  `conReglas(a, sel)`, que el plan no nombra, escribe el `fmt` propuesto de F4.
- **L2.3** (`ffb7570`): sin infraestructura para montar componentes Svelte en
  `node:test`, el test de «el select muestra F3» es uno de compilación sin
  advertencias. La propuesta de F4 se aplica solo en el asistente, no en la
  pestaña Reglas. Se borró `competir.reglas.f1.desc`.
- **L2.4** (`a58c917`): las líneas de `f1-dq` van sin el prefijo `DQ: `. `dq`
  también pasa por `ResultadoPartido` y `correrPartido`, porque si no las
  rondas en segundo plano lo perdían.
- **L2.5** (`b863c65`): además de lo pedido se corrigieron unas diez frases
  que los escenarios nuevos volvieron falsas («salvo el Partido F1», «la app
  trae siete»). «Base F1» sigue en la pestaña Reglas como nombre del mundo F1.
- **L3.1** (`9996a49`): claves `competir.admision.{vegetal,genes,stores,
  categoria,accion}`. Las etiquetas del nombre cuentan solo entre paréntesis
  y se parten en `f\d|mb|sb|ss`: «(F2MB)» cuenta, «(Passive)» no. El análisis
  de acciones es por tokens, no sigue la pila.
- **L3.2** (`aff56b4`): `admision.js` usa `genesAdn` de `lineage.js` para no
  formar un ciclo con `league.js`. Los bots del foro no traen ADN en el
  índice: se juzgan por su board, sus `caps` y los genes del perfil, así que
  la regla de un solo `store` de SS no se les comprueba.
- **L3.3** (`4206a65`): `admisionDeParticipante` busca al inscrito por
  `hashAdn(dna)`. El ⚠ marca también errores de forma. El pool «los bots que
  admite <liga>» se ofrece solo en Participantes (en el asistente la liga se
  elige después del pool). `{@const}` se cambió por un helper porque Biome lo
  reformatea y rompe `vite build`.
- **L3.4** (`beedf3e`): la columna «al inscribir a mano» de D7 se documentó
  partida en «en el asistente» (bloquea los errores de forma) y «en
  Participantes» (solo ⚠), que es lo que hace el código.
- **L4.1** (`8bcf0e0`): `--liga` se aplica después del preset y antes de
  `--max-energy`, `--opt` y `--cost` (los flags ganan); liga inexistente o
  `--preset` distinto de f1 dan error. La receta avisa que la calibración
  medida con el campo de F1 no vale para F4.

## Pendientes

1. **D5**: las «MB kill restrictions» quedan fuera; MB se juega con el mundo
   de F2 sin DQ. Marcarlas por especie necesita cambiar la API wasm.
2. **Admisión en Participantes**: D7 dice que un error de forma no deja
   agregar al bot a mano. El asistente lo cumple; la pantalla Participantes
   de un torneo ya creado solo lo marca con ⚠ y no bloquea. Decidir si se
   bloquea ahí también.
3. **SS y los bots del foro**: sin ADN en el índice, la regla de un solo
   `store` solo se les aplica por categoría (board «Single store»).
4. **Prueba manual en `npm run dev`** (no se puede automatizar): crear un
   torneo F3 y ver una DQ («⚖ DQ») en la vista de partidos; sortear en SB con
   el pool «los bots que admite SB» (en Participantes); mirar el ⚠ en
   pantalla chica; elegir F4 en el asistente y ver que propone `nrg` y 100.
5. **Revisión en el navegador** de las páginas del manual tocadas
   (`app/competir.md` `{#ligas}`, `app/escenarios.md`,
   `tecnico/diferencias.md`), en es y en, y de la frase de F4 «se gasta en
   unos 3000 ciclos», que viene de D3 y no se volvió a medir.
6. **D8** sigue fuera: ranking y filtro por liga, partido rápido, la clásica.
