# Plan: ligas (presets de mundo, reglas de combate y admisión)

Plan de ejecución para que los torneos de la app (`port/web2`) se puedan
jugar con las ligas históricas de DarwinBots (F1, F2, F3, MB, SB, SS) y con
una nueva, **F4**, elegida al crear el torneo. Acordado con el autor el
2026-10-11. Es la decisión 27 de [`PLAN.md`](PLAN.md) (la agrega el paso
L2.5). Se ejecuta con [`PLAN-LIGAS-ORQUESTADOR.md`](PLAN-LIGAS-ORQUESTADOR.md).

Una liga tiene tres capas, que varían por separado:

| Capa | Qué es | Dónde vive | Quién la hace cumplir |
|---|---|---|---|
| 1 · Mundo | Costos, física, campo, vegetales | Escenario de fábrica `partido-<liga>.json` (base `f1` + cambios) | El core, como cualquier escenario |
| 2 · Reglas de combate | Qué acción descalifica (opción 93, `Disqualify`) | Dentro del mismo escenario (`opt:93`) | El core: los 13 sitios de DQ del original ya están portados |
| 3 · Admisión | Qué bots pueden inscribirse | `engine/ligas.js` + `engine/admision.js` (JS puro, análisis estático del ADN) | El host, al inscribir y al sortear |

## Índice (lo único que lee el orquestador)

| Paso | Qué | Agente | Modelo | Verificación (además de la común) |
|---|---|---|---|---|
| L1.1 | Seis escenarios de fábrica `partido-f2/f3/mb/sb/ss/f4` | desarrollador | haiku | `npm test -- test/escenarios.test.js` |
| L1.2 | Test: la DQ y los valores del mundo llegan al partido | desarrollador | sonnet | `npm test -- test/ligas_worker.test.js` (con wasm) |
| L2.1 | `engine/ligas.js`: catálogo de ligas (puro) | desarrollador | haiku | `npm test -- test/ligas.test.js` |
| L2.2 | Asistente: elegir la liga en el paso 3; reglas `{escenario, liga}` | desarrollador | sonnet | `npm test -- test/competir_ui.test.js test/ligas.test.js` |
| L2.3 | UI: selector de liga en `EditorPartido.svelte` + i18n | desarrollador | haiku | `npm test -- test/claves.test.js test/competir_ui.test.js` |
| L2.4 | Las líneas de DQ llegan al registro del partido y se ven | desarrollador | sonnet | `npm test -- test/rondas_worker.test.js test/ligas_worker.test.js` |
| L2.5 | Documentación de L1 y L2 (es + en) | desarrollador | haiku | `node ../sitio/generar.mjs --lint` |
| L3.1 | `engine/admision.js`: perfil estático del ADN y `admitir()` | desarrollador | sonnet | `npm test -- test/admision.test.js` |
| L3.2 | Filtro de sorteo `liga:<id>` y validación de participantes | desarrollador | sonnet | `npm test -- test/admision.test.js test/competir_ui.test.js` |
| L3.3 | UI: avisos ⚠ en Participantes y opción de pool por liga | desarrollador | haiku | `npm test -- test/claves.test.js test/competir_ui.test.js` |
| L3.4 | Documentación de L3 (es + en) | desarrollador | haiku | `node ../sitio/generar.mjs --lint` |
| L4.1 | `tools/fight/torneo.mjs --liga <id>` + su README | desarrollador | haiku | ver el paso |
| L4.2 | Cierre: verificación completa e informe | (orquestador) | — | `.agents/skills/verificar-cambios/SKILL.md` |

Los comandos de verificación se corren desde `port/web2/` (salvo que el paso
diga otra cosa). Si un archivo de test que nombra la tabla no existe todavía,
lo crea el paso.

## Cómo usar este plan (para el subagente)

1. Leé `AGENTS.md`, la sección «Decisiones» de este plan y **solo** la
   sección de tu paso. No leas los otros pasos.
2. Si el código contradice al plan (un nombre, una firma, una ruta), **manda
   el código**: adaptá y anotalo en «Desvíos». Las rutas y símbolos son del
   2026-10-11; buscá el símbolo, no la línea.
3. Lo que no está en tu paso no se hace. Sin dependencias nuevas, sin
   TypeScript, archivos en LF, `Darwinbots2/` y `port/web/` (la clásica,
   congelada) no se tocan. `port/core/` y `port/wasm/` tampoco: **ningún
   paso de este plan toca el motor**.
4. Español rioplatense en código, comentarios y textos. Sysvars, operadores,
   nombres de bots y nombres de ligas (F1, F2…) no se traducen.
5. Textos de la app siempre en `src/i18n/es/*.json` **y** `src/i18n/en/*.json`
   con las mismas claves. Manual siempre en `port/sitio/manual/es/` **y**
   `port/sitio/manual/en/` (leé `.agents/skills/escribir-manual/SKILL.md`).
6. No commitees. Tu reporte final tiene **como máximo 25 líneas**: paso,
   archivos tocados, comandos con su resultado (solo la línea de totales),
   desvíos, pendiente. Nada de volcar diffs ni salidas largas: el
   orquestador tiene que cuidar su contexto.

## Decisiones

**D1 · Las ligas son escenarios de fábrica, no bases nuevas.** `BASES` de
`engine/opciones.js` sigue con `clasica` y `f1`. Cada liga es un
`engine/escenarios/fabrica/partido-<id>.json` con `"opciones": {"base": "f1",
"cambios": {…}}`, igual que `partido-f1.json`. Así «Ver los cambios» muestra
en qué difiere de F1, que es exactamente como lo define el original
(`btnSetF2_Click` y `btnSetSB_Click` llaman a `btnSetF1_Click` y cambian un
valor, `Darwinbots2/OptionsForm.frm:2670-2690`).

**D2 · Valores de cada liga.** Fuentes: el VB6 (manda) y la wiki/foro
(`../darwinbots-wiki/wiki-diff/foro-ligas-sims.md`, fuera del repo).

| Liga | `cambios` sobre la base `f1` | Origen |
|---|---|---|
| F1 | `{}` (ya existe: `partido-f1.json`) | `OptionsForm.frm:2579-2668` |
| F2 | `{"base:maxEnergy": 30, "opt:93": 1}` | `:2670-2678`; reglas F2 = DQ nivel 1 (`frmGset.frm:304-345`) |
| F3 | `{"base:maxEnergy": 30, "opt:93": 2}` | mismo botón que F2; reglas F3 = DQ nivel 2 |
| MB | `{"base:maxEnergy": 30}` | mismo botón que F2 (ver D5) |
| SB | `{"base:fieldW": 16000, "base:fieldH": 12000}` | `:2680-2690` |
| SS | `{}` | el botón del original es «Set F1/SS settings» |
| F4 | `{"cost:31": 1, "base:fieldW": 18474, "base:fieldH": 13856}` | nueva (D3) |

**D3 · F4 (nueva, no histórica).** F1 con **AGECOST (costo 31) = 1** y el
**campo al doble de lado** (18474 × 13856, cuatro veces la superficie),
toroidal como F1. Sin descalificación. Motivo: con F1 tal cual estar vivo
casi no cuesta y un bot que solo se reproduce gana por tope; con AGECOST 1
un bot de 3000 que no caza ni come muere en unos 3000 ciclos
(`port/tools/fight/README.md`, «Receta recomendada»). Al elegir F4, el
asistente **propone** en los valores del partido `capMode: 'nrg'` y
`popCap: 100` (los del suizo del Bestiario con que se calculó el ranking del
2026-10-11); el usuario puede cambiarlos. Las demás ligas no proponen nada.

**D4 · Descalificación.** F2 → `opt:93 = 1` (alimentarse por tie de otra
especie, virus). F3 → `opt:93 = 2` (ties, virus, info shots, venom, poison,
slime, shell, `.delgene`, sexrepro). El core solo descalifica con el modo F1
encendido, y el torneo siempre lo enciende (`fijarModoF1` en
`engine/partido.js`). La DQ mata a la especie entera (`dreason`,
`core/include/dbcore/gamemodes.hpp`), así que esa especie pierde la ronda.
Dos rarezas del original que se documentan y **no** se corrigen: (a) la
especie descalificada es la del bot que hace la acción, aunque lo haya
forzado un info shot ajeno; (b) la prohibición de sexrepro en F2 era de la
comunidad, el código no la impone (en F2 queda como aviso de admisión, D7).

**D5 · MB sin las «MB kill restrictions».** El core las tiene (`kill_mb`,
`master.hpp`), pero la API wasm no deja marcarlas por especie, y agregar ese
dato a `db_sim_add_species` cambia una firma del motor. **Queda fuera de
este plan** (pendiente con el autor). La liga MB se juega con el mundo de F2
sin DQ, y el manual lo dice.

**D6 · Lo que se guarda.** Las reglas de una temporada pasan a ser
`S.rules = {escenario, liga}`, con `liga` ∈ `f1|f2|f3|mb|sb|ss|f4` o ausente
(escenario propio o «sin costos»). Reglas viejas sin `liga`: se deduce del
id del escenario (`partido-f1` → `f1`); si no, sin liga. El archivo de
torneo no cambia de versión: `lgImportObj` ya copia `rules` entero.

**D7 · Admisión.** Tres tipos de comprobación, de más dura a más blanda:

| Tipo | Ejemplo | Al inscribir a mano | En el sorteo (`liga:<id>`) |
|---|---|---|---|
| Forma del ADN (exacta) | SB: ≤ 6 genes; SS: un solo `store`/`inc`/`dec` en todo el ADN | **error**: no se puede agregar | excluido |
| Categoría (board del foro) | F2 admite los boards «F2 bots» y «F3 bots» | aviso ⚠ | excluido |
| Acciones prohibidas (estático, aproximado) | F3: el ADN escribe `.tie` | aviso ⚠ | incluido (el árbitro es la DQ) |

Categorías por liga (regla de inscripción de 2014: «F1 contains all robots
from F1, F2, F3, SS, SB, MB / F2 contains all robots from F2, F3 / SB
contains all robots from SB, SS»): F1 y F4 → cualquier bot no vegetal; F2 →
F2, F3; F3 → F3; MB → Multi-Bots; SB → Short bots, Single store; SS →
Single store. Los bots propios no tienen board: pasan la comprobación de
categoría y se les aplican las otras dos.

Acciones con aviso (claves de capacidad de `src/lib/bots/textos.js` `CAPS`):
F2 → `come-lazo`, `virus`, `repro-sex`; F3 → `lazos`, `come-lazo`, `virus`,
`dispara-info`, `veneno`, `toxina`, `limo`, `caparazon`, `autoedita`,
`repro-sex`. Para bots del foro se usan sus `caps` de
`port/web/bots/profiles.json` (calculadas por el core); para los propios,
el análisis estático de L3.1.

**D8 · Fuera de este plan.** El ranking por liga y el filtro por ranking
(el `liga` guardado en cada temporada los habilita después); el partido
rápido (sigue con F1); la clásica; D5.

---

## L1 · Mundo

### L1.1 · Seis escenarios de fábrica

Archivos: `engine/escenarios/fabrica/partido-{f2,f3,mb,sb,ss,f4}.json` (nuevos),
`engine/escenarios/fabrica.js`, `test/escenarios.test.js`.

1. Copiá la forma de `partido-f1.json`: `formato`, `id`, `nombre` y
   `descripcion` en `es`/`en`, `etiquetas` (`["competición", "F2"]`, etc.),
   `destino: "competir"`, `opciones` con la base `f1` y los `cambios` de D2
   **exactos**.
2. Nombres: «Partido F2» / «F2 match», y así. Descripción en una oración que
   diga en qué difiere de F1 (p. ej. F3: «vegetales a 30 y descalificación
   F3: sin ties, virus, info shots, venom, poison, slime, shell, .delgene ni
   sexrepro»). F4: «F1 con AGECOST 1 y el campo al doble de lado
   (18474×13856)». MB: aclarar que sin las MB kill restrictions.
3. Especies: el alga de `partido-f1.json` más dos bots de la liga, sacados de
   `port/web/bots/bots.json` (campo `board`). Sugeridos (verificá que el
   nombre exista tal cual): F2 `Spinner v1.5 (F2) (Moonfisher) 04-05-08` y
   `Gimmick1.0(F2)(Ikke)11.6.2008.txt`; F4 `Etch Mk II(F1)(abyaly)-15.03.2008`
   y `Republican Wasp (F1)(Commander Keen)(25-05-2008)`; F3, MB, SB y SS:
   los dos primeros de su board (`F3 bots`, `Multi-Bots`, `Short bots`,
   `Single store`) que no sean vegetales; en SB, que tengan ≤ 6 genes; en
   SS, un solo `store`. El `hash` se calcula como el de `partido-f1.json`:
   buscá en `test/escenarios.test.js` o en `engine/escenarios/index.js` cómo
   se valida y usá la misma función (`lgHash` de `engine/adn.js` u otra).
4. Registralos en `fabrica.js` (import + `FABRICA_CRUDA`), después de
   `partidoF1`.
5. Tests nuevos en `test/escenarios.test.js`: cada uno valida y normaliza;
   `resolverOpciones` (de `engine/escenarios/index.js`) de cada uno da los
   valores de D2 (F2: `base:maxEnergy` 30 y `opt:93` 1; SB: 16000×12000;
   F4: `cost:31` 1 y 18474×13856; los demás valores iguales a los de F1).
   Si algún test existente cuenta los escenarios de fábrica, actualizalo.

### L1.2 · La DQ y el mundo llegan al partido (test con wasm)

Archivo nuevo: `test/ligas_worker.test.js`. Tomá como modelo el test de
worker que juegue un partido de torneo (`test/rondas_worker.test.js` o el
que use `mensajesPartido` con el worker real); se saltea sin
`build-wasm/` igual que los demás.

1. Opciones: armá el plan de un partido con las reglas
   `reglasDeEscenario(<partido-f3>)` (de `engine/rondas.js`) y comprobá que
   las opciones del reset traen `opts[93] === 2`, `opts[91] === 1` y
   `maxEnergy === 30`; con `partido-f4`, `costs[31] === 1`,
   `fieldW === 18474` y `fieldH === 13856`. Esta parte no necesita wasm.
2. DQ real: un partido corto (1 ronda, tope bajo) con reglas F3 entre un bot
   que hace un tie en su primer ciclo (p. ej.
   `cond start 1 .tie store stop` más un gen que lo reproduzca, ajustá hasta
   que el core lo acepte) y un bot pasivo. Esperado: el log de DQ del worker
   (la línea `DQ: … has been disqualified for making a tie.` que hoy escribe
   `engine/sim.js`) aparece y el pasivo gana la ronda. Con reglas F1 el
   mismo partido no descalifica a nadie.
3. Si el paso 2 no sale porque el worker no expone el log de DQ en el flujo
   de partidos, dejalo como `test.todo` con el motivo: lo cubre L2.4.

---

## L2 · Reglas en los torneos

### L2.1 · `engine/ligas.js` (puro)

Archivo nuevo: `engine/ligas.js`; test nuevo: `test/ligas.test.js`.

```js
// @ts-check
/** @typedef {'f1'|'f2'|'f3'|'mb'|'sb'|'ss'|'f4'} IdLiga */
export const LIGAS = Object.freeze([
  { id: 'f1', escenario: 'partido-f1', boards: null, avisos: [], forma: null, fmt: null },
  { id: 'f2', escenario: 'partido-f2', boards: ['F2 bots', 'F3 bots'], etiquetas: ['F2', 'F3'],
    avisos: ['come-lazo', 'virus', 'repro-sex'], forma: null, fmt: null },
  // … f3, mb, sb ({maxGenes: 6}), ss ({maxStores: 1}), f4 (fmt: {capMode: 'nrg', popCap: 100})
]);
export const ligaPorId = (id) => …;
export const ligaDeEscenario = (escenarioId) => …;   // 'partido-f2' → liga f2, si no null
export const ligaDeReglas = (rules) => …;            // rules.liga, o por rules.escenario.id (D6)
```

- `boards: null` = cualquier bot no vegetal. `etiquetas`: las etiquetas de
  nombre que también cuentan como categoría (`(F2)`, `(F2MB)`…; comparación
  sin mayúsculas, ver D7).
- Los valores salen de D2, D3 y D7; no los inventes.
- Tests: los siete ids, `ligaDeEscenario` de cada escenario de fábrica,
  `ligaDeReglas` con `{liga}`, con solo `{escenario: {id: 'partido-f1'}}`
  (reglas viejas) y con un escenario propio (→ `null`). Que cada
  `escenario` del catálogo exista en `ESCENARIOS_FABRICA`.

### L2.2 · Asistente: elegir la liga

Archivos: `src/lib/competir/asistente.js`, `src/lib/competir/torneos.svelte.js`
(solo si hace falta), tests en `test/competir_ui.test.js` (o el test que hoy
cubre `reglasDeSeleccion`/`tipoDeReglas`; buscalo).

1. `SeleccionReglas` suma `{tipo: 'liga', liga: IdLiga}`. `{tipo: 'f1'}` se
   mantiene como alias de `{tipo: 'liga', liga: 'f1'}` (lo usan
   `reglasBase` en `torneos.svelte.js` y reglas guardadas).
2. `reglasDeSeleccion({tipo: 'liga', liga})` →
   `{...reglasDeEscenario(escenarioFabrica(LIGA.escenario)), liga}`. Para
   `{tipo: 'f1'}`, lo mismo con `liga: 'f1'`. `sincostos` y `escenario` no
   llevan `liga`.
3. `tipoDeReglas(rules)` devuelve, además de lo actual, la liga
   (`ligaDeReglas`) para marcar la opción: elegí la forma menos invasiva
   (p. ej. devolver `'liga'` y exponer otra función `ligaSeleccionada(rules)`),
   cuidando que lo que hoy devuelve `'f1'` siga funcionando donde se use.
4. Al elegir una liga con `fmt` (solo F4), el asistente escribe esos valores
   en `a.fmt` (D3). Si después el usuario los cambia, no se pisan hasta que
   vuelva a elegir la liga.
5. Tests: `reglasDeSeleccion` de cada liga trae `liga` y el escenario
   correcto; las reglas viejas (`{escenario: partido-f1}` sin `liga`) se
   reconocen como F1; elegir F4 deja `capMode 'nrg'` y `popCap 100`.

### L2.3 · UI: selector de liga

Archivos: `src/lib/competir/EditorPartido.svelte` (lo usan el asistente y la
pestaña Reglas), `src/lib/competir/Asistente.svelte` y `Reglas.svelte` solo
si pasan la selección, `src/i18n/es/competir.json` y `src/i18n/en/competir.json`
(o el JSON donde estén hoy las claves `competir.reglas.*`).

1. El radio «Base F1» pasa a ser «Liga» con un `<select>` de las siete
   ligas (F1, F2, F3, MB, SB, SS, F4), en ese orden, y debajo la
   descripción de la elegida. «Sin costos» y «Desde Experimentar» quedan como
   están.
2. Claves nuevas: `competir.reglas.liga`, `competir.reglas.liga.desc`, y por
   liga `competir.reglas.liga.<id>` (el nombre: «F2») y
   `competir.reglas.liga.<id>.desc` (una línea: qué cambia respecto de F1 y
   qué descalifica). Mismo texto en espíritu que las descripciones de L1.1.
   Las claves `competir.reglas.f1*` que queden sin uso se borran de los dos
   idiomas.
3. `onReglas` emite `{tipo: 'liga', liga}`. Con las reglas bloqueadas (🔒)
   el select queda deshabilitado como el resto.
4. Tests: `test/claves.test.js` en verde; en `test/competir_ui.test.js` (o el
   test de componentes de Competir) que al montar con reglas F3 el select
   muestre F3.

### L2.4 · Las descalificaciones se ven

Hoy el worker solo escribe `DQ: …` en su log (`engine/sim.js`, drenaje de
`db_sim_events_dq`). En un torneo eso no llega a ningún lado.

1. Buscá cómo viajan del worker al host `f1-note` y `f1-over` (encabezado de
   `engine/partido.js` y `engine/worker.js`). Agregá un mensaje
   `{t: 'f1-dq', lines: string[]}` con las líneas drenadas, emitido en el
   mismo lugar donde hoy se escriben al log (el log se mantiene).
2. En `engine/partido.js`, el reductor de mensajes del partido acumula esas
   líneas; al registrar el partido van en el registro como `dq: string[]`
   (solo si hay alguna). Documentá el campo nuevo en el typedef `Match` de
   `engine/league.js`. No cambia nada más del registro.
3. En la vista de partidos del torneo (`src/lib/competir/Partidos.svelte`)
   un partido con `dq` muestra «⚖ DQ» y, al desplegarlo o en su `title`,
   las líneas. Claves i18n nuevas en es y en.
4. Tests: el reductor con un `f1-dq` deja `dq` en el registro; con wasm,
   completá el `test.todo` de L1.2 si quedó.

### L2.5 · Documentación de L1 y L2

Leé `.agents/skills/actualizar-documentacion/SKILL.md` y
`.agents/skills/escribir-manual/SKILL.md`.

- `port/sitio/manual/es/app/competir.md` y su par en `en/`: en «Las reglas
  del partido» `{#reglas}`, «Base F1» pasa a «Liga» con la lista. Sección
  nueva `## Las ligas {#ligas}` después de `{#reglas}`: tabla de las siete
  (mundo, qué descalifica, quién se inscribe), de dónde salen (botones del
  original, reglas del foro), F4 explicada (D3), las dos rarezas de D4, que
  MB va sin kill restrictions (D5) y las DQ en la vista de partidos.
- `port/sitio/manual/*/app/escenarios.md`: la lista de escenarios de fábrica
  suma los seis.
- `port/sitio/manual/*/tecnico/diferencias.md`: los presets F2/F3/MB y SB ya
  existen (antes faltaban); siguen faltando las MB kill restrictions; F4 y el
  `capMode 'nrg'` son añadidos del port.
- `README.md` y `README.en.md` si enumeran escenarios de fábrica o
  funcionalidades de Competir.
- `port/web2/PLAN.md`: fila **27 · Ligas** en la tabla de decisiones, una
  línea que resuma D1-D7 y enlace a `PLAN-LIGAS.md`.
- `DOCUMENTACION.md` (raíz): filas para `PLAN-LIGAS.md` y
  `PLAN-LIGAS-ORQUESTADOR.md` (vivos) si todavía no están.
- Verificación: `node port/sitio/generar.mjs --lint` (desde la raíz) y
  `npm test -- test/manual.test.js test/claves.test.js`.

---

## L3 · Admisión

### L3.1 · `engine/admision.js` (puro)

Archivo nuevo: `engine/admision.js`; test nuevo: `test/admision.test.js`.

```js
/** Perfil estático del ADN: lo que se puede saber sin correrlo. */
export function perfilLiga(adn) → { genes: number, stores: number, escribe: Set<string>, caps: Set<string> }
/** ¿Puede inscribirse? entrada = {nombre, board?: string|null, veg?: boolean, adn, caps?: string[]} */
export function admitir(liga, entrada) → { ok: boolean, errores: Mensaje[], avisos: Mensaje[] }
```

1. `genes`: `contarGenes` de `engine/adn.js`. Tokens: `tokensEjecutables`
   de `engine/pila.js` (sin comentarios).
2. `stores`: cantidad de tokens `store`, `inc` y `dec` (y la familia
   `addstore`, `substore`, `multstore`, `divstore`… si existen en
   `engine/vocabulario.js`). Para SS cuenta todo junto.
3. `escribe`: sysvars escritas = el token anterior a un comando de la
   familia store, cuando es `.nombre` o un número que sea dirección de
   sysvar (`SYSVARS` de `engine/vocabulario.js`).
4. `caps` estáticas, con las mismas reglas que
   `port/tools/bestiary/analyze_bots.js` (leé su bloque de detección, ~líneas
   87-131) restringidas a las claves de D7. Es aproximado (no sigue la pila
   como el analizador); el comentario del archivo lo dice.
5. `admitir`: vegetal → error. Forma (D7) → errores con params
   (`{genes, max}`, `{stores, max}`). Categoría: si `entrada.board` no es
   null y la liga tiene `boards`, el board tiene que estar, o alguna
   `etiqueta` de la liga tiene que aparecer en el nombre entre paréntesis →
   si no, aviso. Acciones: `entrada.caps` si viene (bots del foro), si no
   `perfilLiga(adn).caps`; cada cap prohibida → aviso con su clave.
   Mensajes con la forma `{clave, params}` que ya usa el asistente
   (`competir.admision.<motivo>`).
6. Tests con ADN chicos escritos en el test: 7 genes → error en SB; dos
   `store` → error en SS; un `.tie store` → aviso en F3 y nada en F1;
   un bot del foro con board «F1 bots» → aviso en F2; propio sin board → sin
   aviso de categoría; vegetal → error.

### L3.2 · Sorteo y validación

Archivos: `engine/league.js` (`lgPool`), `engine/torneos.js` (el `lgPool`
envuelto, si hace falta pasarle el ADN), `src/lib/competir/asistente.js`
(`validarParticipantes`), tests.

1. `lgPool(inv, filter)` acepta `liga:<id>`: los ítems que `admitir`
   acepta **sin errores y sin aviso de categoría** (D7: en el sorteo se
   excluye lo que no es de la categoría; las acciones solo avisan). Mirá qué
   trae cada ítem del Inventario (`it.b`: nombre, board, ADN, perfil) y
   adaptá. `lgPool` sigue siendo puro.
2. `validarParticipantes(a, ctx)`: si la temporada tiene liga, cada
   participante pasa por `admitir`: errores → errores del paso 2 (no se
   puede seguir); avisos → avisos (se puede seguir). La liga del asistente
   se conoce recién en el paso 3: validá también al pasar del paso 3 al
   final (o al crear), con la misma función.
3. Tests: `lgPool` con `liga:sb` excluye a uno de 7 genes; con `liga:f2`
   excluye a un «F1 bots» y deja a un propio; el asistente con liga SS y un
   participante de dos `store` no deja crear.

### L3.3 · UI de admisión

Archivos: `src/lib/competir/Participantes.svelte`, `ElegirBots.svelte`,
`SelectorPool.svelte` (los que correspondan), i18n es/en.

1. En la lista de participantes, ⚠ con `title` (y texto visible en pantalla
   chica) con los avisos de cada uno; los errores ya los muestra el
   asistente.
2. En el selector de pool del sorteo, opción «Bots de la liga» (`liga:<id>`
   con la liga elegida); si no hay liga, no aparece.
3. Claves `competir.admision.*` y la de la opción de pool, en es y en.
4. Tests: `claves.test.js`; el de componentes que corresponda.

### L3.4 · Documentación de L3

- `app/competir.md` (es y en): en `{#ligas}`, la admisión (tabla de D7, qué
  es aproximado); en `{#participantes}`, los ⚠ y el pool «Bots de la liga».
- `tecnico/diferencias.md` si hace falta (la admisión es un añadido: el
  original no la validaba).
- Verificación: `node port/sitio/generar.mjs --lint`.

---

## L4 · Herramientas y cierre

### L4.1 · `torneo.mjs --liga <id>`

Archivos: `port/tools/fight/torneo.mjs`, `port/tools/fight/README.md`.

1. Opción `--liga f1|f2|f3|mb|sb|ss|f4` (implica `--preset f1`): lee
   `port/web2/engine/escenarios/fabrica/partido-<id>.json` y aplica sus
   `cambios` sobre las reglas F1 que ya arma `buildRules`:
   `base:<clave>` → `base[clave]` (y `fieldW`/`fieldH` → `field`),
   `cost:<i>` → `costs[i]`, `opt:<i>` → `opts[i]`. Una sola fuente de
   verdad: no copies los números.
2. Con F4 y sin `--cap-mode`/`--popcap` explícitos, usa `nrg` y 100 (D3).
3. README: la opción, la tabla de ligas en una línea cada una, y que la
   «receta recomendada» con F4 queda `--liga f4 --cap 5000`.
4. Verificación (desde `port/`): `node tools/fight/torneo.mjs swiss --liga f4
   --limit 4 --swiss-rounds 1 --seed 1 --jobs 2` (o el modo y las opciones
   mínimas que existan) y comprobar en el JSON de salida que `rules.costs[31]
   === 1` y el campo es 18474×13856. Necesita `build/dbfight` (si no está:
   `cmake --build --preset native-gcc --target dbfight`). Borrá el JSON de
   prueba si cae dentro del repo fuera de `out/`.

### L4.2 · Cierre (lo hace el orquestador)

1. Todo `.agents/skills/verificar-cambios/SKILL.md`.
2. Prueba en `npm run dev` que no se puede automatizar: queda para el autor
   (crear un torneo F3, ver una DQ en la vista de partidos, sortear con
   «Bots de la liga» en SB).
3. `port/web2/PLAN-LIGAS-INFORME.md`: cifras de tests, desvíos por paso,
   pendientes (D5, lo que se haya salteado). Fila en `DOCUMENTACION.md`
   como histórico.

---

## Después de la corrida

Dos pendientes del informe ([`PLAN-LIGAS-INFORME.md`](PLAN-LIGAS-INFORME.md)),
decididos por el autor el 2026-10-11:

- **Pendiente 2, bloquear en Participantes.** Un error de forma ya no deja
  inscribir en un torneo creado: «Agregar» muestra los errores y avisos de
  los elegidos y desactiva **Inscribir** (`admisionDeClaves` de
  `asistente.js`). Sobre un bot ya inscrito el ⚠ sigue siendo solo una
  marca: la liga se puede cambiar después de inscribir.
- **Pendiente 3, SS y los bots del foro.** La forma se vuelve a mirar con
  el ADN real en el momento de inscribir, cuando ya se bajó
  (`erroresAlInscribir` de `admision.js`): en `participantesDeEntradas`
  (los rechazados vuelven con su motivo y la app los avisa) y en
  `lgEnroll`/`lgEnrollOne` de `torneos.js` (el sorteo saltea al que no
  pasa, sea cual sea el pool). Un bot del board «Single store» con dos
  `store` ya no entra en SS.

En la prueba manual en `npm run dev` (la que pedía L4.2) salieron tres
fallas de L3, corregidas en el mismo commit:

- El ⚠ de Participantes no encontraba a los bots del foro en el índice: los
  buscaba por `hashAdn`, y el hash de `profiles.json` coincide con el del
  `.txt` en 58 de 684. Ahora se buscan por su archivo (`e.file`) y, si no,
  por hash. Sin eso faltaban los avisos de categoría y las caps del foro.
- Participantes no cargaba la Biblioteca: abierto directo, el ⚠ no tenía
  índice. Ahora la carga si la temporada tiene liga.
- El asistente mostraba la clave de la acción («dispara-info») en vez de su
  nombre; las dos pantallas usan ahora `textoMensaje` de `textos.js`.
