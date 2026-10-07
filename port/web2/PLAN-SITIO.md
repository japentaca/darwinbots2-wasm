# Sitio darwinbots-wasm.org: plan

Un sitio propio en `darwinbots-wasm.org`, alojado en Cloudflare Pages, con
una portada, un manual completo de la versión portada (cómo funciona la
simulación, el lenguaje del ADN, cada sysvar y cada operador, tutoriales y
guía de la app) y la app misma. Cada push a `main` lo despliega.

Como `PLAN.md`, es un añadido fuera de etapa: no se registra en `spec/`.

## Decisiones

| # | Tema | Decisión |
|---|------|----------|
| S1 | Estructura | `darwinbots-wasm.org/` = portada; `/manual/` = manual; `/app/` = la app nueva (web2); `/classic/` = la clásica; `/build-wasm/` compartido. Decidido por el autor (2026-10-03). |
| S2 | Alojamiento | Cloudflare Pages, proyecto de subida directa (*Direct Upload*). El build sigue en GitHub Actions (emsdk + Vite + generador del manual) y sube `site/` con `wrangler pages deploy`. La integración Git de Cloudflare no sirve: su entorno de build no trae emsdk. |
| S3 | GitHub Pages | Se apaga (decisión del autor, 2026-10-03): `pages.yml` se reemplaza por `sitio.yml`. Aviso: lo guardado en el navegador (bots propios, corridas, torneos) depende del dominio; quien lo tenga en `github.io` lo pierde si no lo exporta antes. |
| S4 | Fuente del contenido | Solo la versión portada: `spec/` (manda), `core/` para desempatar, `engine/opciones.js` y las pantallas para la guía, y el Bestiario para ejemplos. No se usa el wiki. |
| S5 | Formato | Una página = un `.md` en `port/sitio/manual/es/<capítulo>/<página>.md`, con frontmatter (`titulo`, `resumen`, `etiquetas`, `estado`). Subconjunto de Markdown propio, sin dependencias (decisión 3 de `PLAN.md`). Un generador en Node (`port/sitio/generar.mjs`) produce HTML estático: cada página es un archivo, sin JS para leerla. |
| S6 | Extensiones | `[[.shoot]]`, `[[op:store]]` y `[[capítulo/página]]` enlazan (el build falla si el destino no existe); los bloques ```` ```adn ```` se colorean al generar con `editor/resaltado.js` de la app y llevan «Abrir en la app» (`/app/#/bots/nuevo?adn=…`); `:::nota` y `:::cuidado` para avisos. |
| S7 | Referencia generada | Una página por sysvar (las 268 direcciones con sus alias) y por operador (~90), con los datos sacados de `sysvars.yaml`/`opcodes.yaml`: dirección, sentido, quién la escribe y cuándo, rango, latencia, costo, efecto en las pilas. El redactor agrega solo la prosa y un ejemplo. |
| S8 | Parámetros | Una página por grupo de `engine/opciones.js`, con la tabla generada desde el catálogo y prosa por parámetro. El build falla si una opción no aparece. |
| S9 | Navegación | Índice lateral por capítulos, migas, «anterior/siguiente», buscador con un índice JSON generado y unas decenas de líneas de JS. Tema claro/oscuro/auto con los mismos tokens que la app (decisión 24). Funciona en el celular. |
| S10 | La app enlaza al manual | Un «?» en cada pantalla abre su página (`../manual/…`); en el editor de ADN, el resumen de un sysvar u operador al pasar el cursor enlaza a su página; Experimentar avanzado y el inspector enlazan sus entradas. |
| S11 | Idioma | Español primero; el inglés (`/en/`, `/en/manual/`) se traduce después, con un test de paridad. Sysvars, opcodes y nombres de bots no se traducen (decisión 4). |
| S12 | Verificación | Cada capítulo lo revisa un agente distinto del redactor, que contrasta cada afirmación con la spec y deja la cita (`10-CICLO §4`) en un comentario del `.md`. Los ejemplos de ADN pasan `db_dna_lint`; los que dicen «hace X» se corren unos ciclos sin dibujar y se comprueba X. |

## Despliegue

`.github/workflows/sitio.yml` (reemplaza a `pages.yml`), en cada push a
`main`:

1. Compila `dbcore.js` + `dbcore.wasm` (como hoy).
2. `npm ci` y `vite build` de web2 (con `base: './'` sirve bajo `/app/`).
3. `node port/sitio/generar.mjs`: portada, manual y buscador; falla con
   enlaces rotos o referencia incompleta.
4. `armar-sitio.sh` ajustado a S1: `site/`, `site/app/`, `site/classic/`,
   `site/build-wasm/`, más `_headers` (caché larga para lo versionado,
   `application/wasm`) y `_redirects`.
5. `cloudflare/wrangler-action`: `pages deploy site --project-name=darwinbots-wasm --branch=main`.

Nadie sube nada a mano: «subida directa» es solo el tipo de proyecto de
Cloudflare, y quien sube es el paso 5 de Actions con el token.

Lo que hace el autor una sola vez en Cloudflare:

- Crear el proyecto de Pages `darwinbots-wasm` (tipo *Direct Upload*; se
  puede crear también desde el primer `wrangler pages project create`).
- Asociarle el dominio `darwinbots-wasm.org` (y `www` → redirección).
- Crear un token de API con permiso solo «Cloudflare Pages: Edit» de esa
  cuenta, y copiar el *Account ID*.

### Quién puede desplegar

El repo es público: cualquiera puede abrir un PR desde su fork, pero solo
el autor lo integra en `main`, y solo `main` despliega.

- **Regla de la rama `main`** (ruleset): exige PR para cambiar `main`,
  prohíbe force-push y borrado; solo el autor puede saltear la regla
  (para sus pushes directos). Los colaboradores, si los hay, sin permiso
  de escritura o con rol que no pueda integrar.
- **Entorno `produccion`** en GitHub: los secretos `CLOUDFLARE_API_TOKEN` y
  `CLOUDFLARE_ACCOUNT_ID` van en ese entorno, no en el repo, y el entorno
  solo admite despliegues desde `main`. El job de despliegue declara
  `environment: produccion`; aunque un workflow de otra rama lo pida, no
  recibe los secretos.
- **PR desde forks**: `sitio.yml` solo se dispara con `push` a `main` (y
  `workflow_dispatch`); nunca `pull_request_target`. GitHub no da secretos a
  los workflows de forks, y en la configuración de Actions se exige
  aprobación del autor antes de correr workflows de colaboradores externos.
  `ci.yml` sigue corriendo los tests en los PR, sin secretos.
- Las *actions* de terceros van fijadas por versión (`@v3`, `@v4`) como hoy.

Con `gh` autenticado, el orquestador puede crear la regla y el entorno, y
cargar los secretos si el autor le pasa los valores; el token se crea en
Cloudflare. GitHub Pages se desactiva en la configuración del repo.

Ajustes en la app por moverse a `/app/`: el wasm (`./build-wasm/` → `../build-wasm/`, C2 y C10) y el Bestiario (`classic/bots/` → `../classic/bots/`, C1), con el plugin de `vite.config.js` replicando el nuevo layout en local.

## Contenido del manual

Estimación: ~80 páginas escritas y ~360 de referencia (datos generados +
prosa breve).

1. **Empezar** (5): qué es Darwinbots; tu primera simulación; recorrido por
   la app; glosario; preguntas frecuentes.
2. **Guía de la app** (12): Inicio; Observar (mundo, cámara, barra Mundo,
   eventos); inspector; Experimentar básico y avanzado (+ una página por
   grupo de parámetros, S8); escenarios; Analizar (una por pestaña);
   informes; Bots (biblioteca, ficha, editor, laboratorio, «Probar»,
   versiones); Competir (formatos, Elo, TV); tus datos y cómo exportarlos;
   la clásica.
3. **La simulación** (14): el ciclo y el orden de las acciones; energía,
   cuerpo y desechos; cloroplastos y vegetales; física (movimiento, masa,
   fricción, gravedad, browniano, bordes); visión; disparos; defensas
   (caparazón, veneno, toxina, baba); lazos y multicelulares; virus;
   reproducción asexual y sexual; mutaciones; muerte y cadáveres; el mundo
   (formas, laberintos, teleporters, día y noche, costos); especies y linaje.
4. **El lenguaje del ADN** (12): estructura de un bot; genes (`cond`,
   `start`, `else`, `stop`); pila entera y booleana; números y direcciones
   (mod 1000, mod 32000); stores; operadores por familia; condiciones en
   línea; `def`; memoria libre y epigenética; ejecución y costos; errores
   frecuentes; el formato `.txt`.
5. **Referencia de sysvars** (~270, S7): por grupo — movimiento, posición,
   ojos, `ref*`, `tref*`, `my*`, disparos, defensas, cuerpo, cloroplastos,
   reproducción, lazos, virus, entradas y salidas, `memloc`/`memval`,
   ganancias y pérdidas — más una tabla con todas.
6. **Referencia de operadores** (~90, S7): básicos, avanzados, bit a bit,
   condiciones, lógicos, stores, flujo, más una tabla con todos.
7. **Tutoriales** (8): un bot que se mueve; que busca comida; que dispara;
   que reconoce a su especie; un vegetal; un alimentador por lazo; un
   multibot; tu primer experimento de evolución.
8. **Estrategias** (6): caníbales, enjambres, defensivos, parásitos y virus,
   multibots, bots de torneo; con ejemplos del Bestiario.
9. **Técnico** (5): formatos de archivo (`.dbsim`, `.txt`); semillas y
   reproducibilidad; diferencias con el 2.48.32 original y preguntas
   abiertas resueltas; cómo está hecho el port; créditos y licencia.

La portada: qué es, una captura o el mundo corriendo, «Abrir la app»,
«Leer el manual» y enlaces al repo.

## Etapas

Los 143 dorados, los tests de web2 y `biome check` siguen en verde en cada
etapa.

### S-A · Despliegue

`sitio.yml`, `armar-sitio.sh` con el layout S1, la app bajo `/app/`, una
portada provisoria, `_headers`, y apagar `pages.yml`. Requiere los pasos
únicos del autor.

**Cierre:** un push a `main` publica en `darwinbots-wasm.org` la portada, la
app en `/app/` y la clásica en `/classic/`, con la consola limpia.

Hecho el 2026-10-03: proyecto `darwinbots-wasm` en Cloudflare
(`darwinbots-wasm.pages.dev`), dominios `darwinbots-wasm.org` y `www`
(CNAME con proxy, `www` redirige 301 a la raíz), token de API solo
«Pages Write» que vence el 2027-10-03, entorno `produccion` con los dos
secretos y la rama `main`, regla «main protegida» (PR obligatorio, sin
force-push ni borrado, el admin la saltea) y aprobación de workflows para
todo colaborador externo.

### S-B · Generador y referencia

`generar.mjs` (S5, S6, S9), la referencia generada de sysvars, operadores y
parámetros (S7, S8) con la prosa vacía, el índice con cada página en
`pendiente`, y tests: enlaces, cobertura, lint de los bloques `adn`.

**Cierre:** el manual publicado muestra las ~360 páginas de referencia con
sus datos, se busca y se navega.

Hecho el 2026-10-03:

- `port/sitio/generar.mjs` (sin dependencias; usa `yaml.mjs` y
  `markdown.mjs`, propios) y `port/sitio/indice.mjs` (capítulos, páginas,
  grupos de sysvars, familias de operadores). La plantilla está en
  `port/sitio/plantilla/` (`manual.css` y `manual.js`); los tokens de tema
  se copian al generar de `src/app.css` (todo lo anterior a `body {`).
- 441 páginas: portada del manual, 9 capítulos, 75 de prosa, 17 grupos de
  sysvars con 251 páginas (una por dirección con nombre, más `mem-0` y la
  memoria genética en dos páginas por rango: `mem-971-975` y
  `mem-976-990`), 8 familias con 79 operadores, 12 grupos de parámetros
  (hijas de `app/experimentar-avanzado`) y las tablas `sysvars/todas` y
  `operadores/todos`. Los 429 `.md` están sembrados con `estado: pendiente`.
- URLs: `/manual/<capítulo>/<página>/`. Los símbolos de los operadores
  tienen slug propio (`SLUG_OPERADOR`: `!=` → `distinto`, `&` → `bit-and`…).
- Buscador: `buscar.json` (título, resumen, capítulo y palabras extra: alias,
  dirección, nombre y variable de cada parámetro), que se baja la primera vez
  que se usa; `/` lo enfoca. Tema: el botón cicla sistema → claro → oscuro con
  la misma clave que la app (`darwinbots2.tema`).
- Tests: `port/web2/test/manual.test.js` (10). Cubren el lector YAML, la
  cobertura contra el vocabulario del editor (las 255 sysvars y todos los
  comandos) y contra `PARAMETROS`, que todo enlace interno del HTML apunte a
  un archivo generado, las extensiones (y que las rotas fallen), el Markdown y
  el lint con el wasm. `npm run check` y el job web2 de `ci.yml` pasan Biome
  también por las fuentes de `port/sitio`.
- `armar-sitio.sh` genera el manual en `<sitio>/manual` con `--lint` (falla
  si un bloque `adn` tiene avisos de `db_dna_lint`), y la portada enlaza al
  manual.
- «Abrir en la app» de los bloques `adn` queda para S-D: la app todavía no
  tiene la ruta `#/bots/nuevo?adn=…`. Por ahora cada bloque lleva «Copiar».

### S-C · Redacción en español (en paralelo)

Olas de redactores por capítulo, cada uno con su lista de páginas y las
secciones de la spec que le tocan, y después un revisor por capítulo (S12).
Orden: 4, 5–6, 3, 1–2, 7, 8–9.

**Cierre:** cero páginas `pendiente`, todas revisadas y con citas a la spec.

Herramienta: `node port/sitio/probar-adn.mjs bot.txt --ciclos 20 --mem up,50`
(o `--adn "…"`) corre un ADN sin dibujar, sin mutaciones y con costos en 0
(`--cost i=v` los fija), e imprime el lint y, por ciclo, posición, energía y
las direcciones pedidas. Con eso se comprueba cada «hace X» de S12.

Capítulo 4 (El lenguaje del ADN) hecho el 2026-10-03: las 12 páginas están
`revisada`, con 101 citas. Lo hizo una ola de 8 redactores y después un revisor.
Lo que salió de la ola:

- El `else` tras `cond … start` corre en el port (corrección A2-1 de
  `port/README.md`); las páginas lo cuentan así y dejan el comportamiento del
  original en un `:::cuidado`. `spec/20-VM.md` §0.3, §5.4, §5.5, §12.1 y el
  caso dorado V-01 describen el original; desde el 2026-10-03, §5.4 y V-01
  llevan una nota que remite a la corrección.
- `db_dna_lint` no avisaba de `def x .sysvar` (vale 0) ni de líneas como
  `defensa 50` (definen `nsa`). Desde el 2026-10-03 avisa (`defvalor` y
  `defpegado`, con sus textos en el editor y en la clásica). Le salta a 8 bots
  del Bestiario: 7 con `def botname .out1` y W6, que tiene los `def` al revés.
- `markdown.mjs`: una línea sangrada de continuación se une al texto del
  ítem de lista, y el `|` de `[[destino|texto]]` ya no parte una celda de
  tabla.

Capítulos 5 y 6 (referencia) hechos el 2026-10-04: las 354 páginas (17 grupos
y 250 sysvars, 8 familias y 79 operadores) están `revisada`, con unas 560
citas. Fueron 10 lotes, cada uno con su redactor y su revisor (un pipeline de
20 agentes). Lo que salió de la ola:

- `[[.x|texto]]`, `[[op:x|texto]]` y `[[param:x|texto]]` aceptan texto
  propio, como las páginas (`[[op:|]]` sigue siendo el `|` bit a bit).
- `rnd` con n negativo da n+1..−1 (`Int` es piso); `20-VM` §6.1 y
  `opcodes.yaml` decían n+1..0. Corregido en la spec.
- Notas para la spec, sin tocar: `36-REPRO` §0.3 (tras el rechazo por
  distancia no hay reintento), `34-TIES` §0.4 (los dos extremos pasan a
  `.multi`), `.tienum`/`.tiepres` en `sysvars.yaml`, y el rango de `.tieang1`
  (llega a 1257).
- Las fichas de datos copiaban los campos de `sysvars.yaml` y `opcodes.yaml`
  (jerga interna, nombres de VB6, citas a `Robots.bas`) y describían el
  original, así que contradecían la prosa donde el port corrigió algo (A2-1,
  A3-5, A3-7, A3-10…). Decisión del autor (2026-10-04): reescribirlas.
  Ver «Fichas en castellano llano».
- Términos: «toxina» (poison) y «veneno» (venom), como en la app; nunca
  «ponzoña».

Capítulo 3 (La simulación) hecho el 2026-10-04: las 14 páginas están
`revisada`, con 144 citas. Lo hizo una ola de 8 redactores y después un revisor.
Lo que salió:

- **Bug del host, corregido el 2026-10-04:** `db_sim_add_species` creaba la
  especie con `Mutables{}` (`Mutations = false`, tasas en 0), así que en la app
  nueva y en la clásica los bots sembrados no mutaban con `.repro`, solo con
  `.mrepro`. Ahora le pone las tasas de fábrica (`SetDefaultMutationRates`:
  5000 en las 21 celdas) y `Mutations = true`, como el AddSpecie de
  `OptionsForm.frm:3290-3296`. `simulacion/mutaciones` (#quien-muta, #tasas,
  #mrepro, #encender) y la página de `.mrepro` ya describen el comportamiento
  nuevo, medido con las mutaciones encendidas: con `.repro` muta ≈ 1 hijo de
  cada 60 (ADN de 20 instrucciones) y con `.mrepro` ≈ 1 de cada 5.
- Corregido en la referencia: `.delgene` (también se escribe por el lazo),
  `.nrg` (la condición del shock), `.maxvel` (el tope sale de opt:11),
  `.setaim` (el costo depende del número escrito), `.waste` (el −4) y
  `adn/memoria` (atarse de nuevo al padre corta la memoria diferida).
- Corregidos en la app (`opciones.js`): «Toxina» en vez de «Ponzoña», y los
  textos de base:maxEnergy, opt:51, opt:63 y opt:64.
- `probar-adn.mjs` suma `--opt`, `--maxe` y `--veg`.
- Notas para la spec, sin tocar: `36-REPRO` §2 (el impuesto al hijo es
  0,1 %, no 1 %), `33-SHOTS` §5 (takenrg da 0,4 % en cuerpo), `35-VIRUS` §4
  (el lazo también escribe en `.delgene`) y `50-MUNDO` §7 (checkvegstatus ya
  está descrito según el core).
- Hay páginas largas, de unas 2500 a 2800 palabras: `fisica`, `vision`,
  `lazos` y `reproduccion`. Se pueden partir si el autor lo decide.

Capítulos 1 (Empezar) y 2 (Guía de la app) hechos el 2026-10-04: las 30
páginas (5 de Empezar, 13 pantallas y 12 grupos con los 108 `:::parametro`)
están `revisada`, con unas 180 citas a la spec, al core y a `web2/src`. Lo
hizo una ola de 8 redactores con dos revisores, uno para las pantallas y otro
para los parámetros. Lo que salió:

- Corregido en el capítulo 3: `simulacion/cloroplastos` (la energía total
  cuenta también los cadáveres), `simulacion/mundo` (las paredes de
  «escombros» solo se mueven con opt:85 > 0) y `simulacion/lazos` (el costo de
  atar se divide por los lazos *después* del intento más uno, y el lazo de
  nacimiento se lo cobra al padre).
- Textos de la app corregidos el 2026-10-04: en `i18n` (es y en), los
  tooltips del Player Bot, que tenían la 3 y la 4 al revés (la 3, `.sx`,
  empuja al bot hacia su izquierda); «baba», «caparazón / baba» y «veneno /
  toxina» en vez de «limo» y de los términos en inglés; «Bestiario»; «las
  marcadas» de las corridas; `observar.sembrar.nota` (borrada);
  `analizar.ev.tipo.objetos` (nueva) y `experimentar.objetos.ayuda`. En
  `opciones.js`, las ayudas de opt:12, 31, 34, 54, 55, 56, 72, 93 (también las
  etiquetas de los niveles), 94, 99, 100 y 101, y de cost:21 y cost:22.
- Player Bot corregido el 2026-10-04, en la app nueva y en la clásica: en los
  juegos Flechas y WASD, → y D escribían en la dirección 3, que empuja al bot
  hacia su izquierda. Ahora escriben en la 4 (`.dx`), y ← y A en la 3. Quien
  tenga guardado el juego viejo lo ve como «Personalizadas» y lo recupera eligiendo de nuevo el juego.
- Pendiente en la app (cambia el comportamiento; sin tocar):
  - opt:31 viene en 0, así que el modo estanque sin tocarla no tiene sol.
  - Pantallas: Experimentar reemplaza la simulación sin preguntar; los avisos
    del motor de F1 y de una sola especie solo llegan a Competir; no se ve el
    multiplicador de costos mientras lo mueve el ajuste dinámico (el frame
    trae `costx`, pero solo la serie de Analizar lo muestra); en Filogenia,
    con un bot elegido, «ADN vs fundador» compara las fotos del ADN dominante
    de la especie, no el de ese bot (en Especies, rótulo y acción coinciden).
    Comprobados el 2026-10-07.
- `port/README.md`: el desglose del Bestiario (545 + 115) no da los 684 de
  `bots.json`.
- `tecnico/semillas` y `tecnico/formatos` ya tienen muchos enlaces: tienen que
  cubrir la reproducibilidad (C17, los 65.536 mundos) y los formatos `.dbsim`,
  `.snp` y el `.json` de escenarios y torneos.
- Páginas largas, de 2000 a 3200 palabras: `observar`, `inspector`, `bots`,
  `editor` y `competir`.

Capítulo 7 (Tutoriales) hecho el 2026-10-05: las 8 páginas están `revisada`,
con 118 citas. Lo hizo una ola de 8 redactores y después un revisor. Los bots
finales de las 8 páginas corrieron con `probar-adn.mjs`, con 499 bloques `adn`
en el manual y el `--lint` limpio. Lo que salió:

- Correcciones del revisor: en `busca-comida`, el parto sale **delante** del
  padre (lo decía «detrás») y [[op:floor]] sí sirve de máximo, de a pares (no
  hay máximo de nueve de una); en `dispara`, [[param:cost:23]] vale 2 en la
  liga F1, no «por defecto» (el default de la app es 0); en `alimentador`, las
  órdenes por puerto del lazo les llegan a **todos** los lazos con ese puerto
  (solo `.readtie` lee el primero y `.deltie` corta uno por pasada, que es
  comportamiento del original, no bug del port), y los cadáveres no se
  descomponen de fábrica porque [[param:opt:51]] viene en 0; en `multibot`,
  el enlace al alimentador decía «alimentar a» en vez de «chuparle la energía
  a». El bot final del multibot avanza más lento que un bot suelto y el hijo
  nace delante del padre mirando hacia él: ambas correcciones medidas.
- Notas para la spec, sin tocar: `36-REPRO` §2, «posición a sondist… mirando
  en sentido opuesto» es ambiguo (el hijo nace delante del padre, mirando
  hacia él: convendría reescribirlo), y el impuesto del parto es 0,1 %, ya
  anotado.
- `simulacion/disparos.md` verificado tras la duda de un redactor: la víctima
  del −1 pierde el 90 % de la fuerza en energía y el 1 % en cuerpo (core
  `shots.hpp`, `releasenrg`: 198 y 2,2 con fuerza 220). Está bien; la
  confusión venía del reparto de quien recibe el regalo (95 %, 0,4 %, 1 %).
- Corregido fuera del capítulo: el comentario desactualizado de
  `app/analizar.md` (decía que faltaba `analizar.ev.tipo.objetos`, que ya
  existe).
- `probar-adn.mjs` (notas de la herramienta, no de las páginas): con `--veg`
  los vegetales nacen sin cloroplastos (el core arranca `startChlr` en 0; la
  app manda 16000); `--vegs` solo siembra si hay una especie vegetal
  registrada; `--cost i=v` solo cobra con el multiplicador (p. ej.
  `--cost 8=0.2,54=1`); y la salida imprime los primeros slots sin filtrar
  por especie.
- Sin arreglos pendientes de la app. Las 11 páginas `pendiente` que quedan
  son los capítulos 8 y 9.

Capítulos 8 y 9 hechos el 2026-10-05: las 11 páginas (6 estrategias y 5
técnicas) están `revisada`, con 187 citas. Lo hizo una ola de 10 redactores
y después un revisor. Con esto **S-C cierra: cero páginas `pendiente` en
español** (531 bloques `adn` con el lint limpio). Lo que salió:

- Los redactores de estrategias corrieron los bots del Bestiario que citaron
  y el revisor los re-corrió: Cannibot respeta a los suyos y caza extraños,
  SWARM y Mr_Swarm se comportan como enjambres, Leechbot desangra por el
  lazo, el P1 original ata pero no drena (su máquina queda a medio armar),
  Tribolis y Caterpillar forman organismos, W6 solo arma parejas sin presas,
  Russia hiberna y Teriyaki paga el precio de andar armado.
- Correcciones del revisor: el −6 es una transferencia fiel al original
  (484,5 cobrados contra ~510 equivalentes pagados: sin desbalance que
  marcar; canibales lo decía mal); el aviso de enjambres nombraba a
  _Turbulent Swarm_ como multibot (cero genes de lazo, no lo es); la
  cronología del desangre de Leechbot; un comentario de torneos citaba un
  `Alga_Minimalis` que no existe (es el alga de arranque de la liga);
  `como-esta-hecho` prometía «Abrir en la app» desde los bloques (S-D no
  existe todavía: ahora dice «Copiar»); los paréntesis de Q13/Q15 en
  `diferencias`; y la entrada «Réplica» de `empezar/glosario` (la primera
  réplica repite la semilla de la corrida de origen, no «semillas
  distintas»: corregida por el orquestador tras verificar
  `engine/replicas.js`).
- Verificaciones notables: `semillas` midió el período del generador
  (2^24) con un script propio y comprobó byte a byte las semillas gemelas
  (49 y 807 dan el mismo mundo; los 65.536 mundos de C19); `formatos`
  hizo la ida y vuelta del `.json` de liga y reprodujo el `.snp`;
  `diferencias` re-corrió el `else` tras `cond…start`, el shock y la
  protección del recién nacido.
- Notas para la spec, sin tocar: el período 2^24 del LCG no está
  documentado en `spec/` (afirmado en el manual con medición propia).
- Sin arreglos pendientes nuevos de la app (app_a_corregir vacío).
  Pendientes ya conocidos: el desglose del Bestiario de `port/README`
  (545 + 115 ≠ 684; el README de la raíz dice 568) y el comentario de
  cabecera de `ci.yml` (143/2962, desactualizado frente a los 272/4126
  del README).

### S-D · La app enlaza al manual

Los «?» y los resúmenes en el editor, Experimentar avanzado y el inspector
(S10).

También: la ruta `#/bots/nuevo?adn=…` en la app (abre el editor con ese
ADN) y el enlace «Abrir en la app» en los bloques `adn` del manual.

**Cierre:** cada pantalla y cada parámetro llevan a su página.

Hecho el 2026-10-06:

- «?» en la barra superior, que sigue a la pantalla activa (cada sección se
  llama igual que su página: `app/inicio`, `app/observar`…); en la ficha
  del bot (al lado de las pestañas: `app/bots` o `app/editor`); en la
  cabecera del inspector (`app/inspector`); en Experimentar avanzado, el
  grupo y cada parámetro (al ancla `p-<clave>`, la de `anclaParam`).
  Decisión del autor: los enlaces siguen al idioma de la app (es →
  `../manual/`, en → `../en/manual/`, que hasta S-E dice «not been
  translated yet»).
- `vocabulario.json` junto a `buscar.json` (uno por idioma): la página y el
  resumen de cada sysvar (por nombre y por dirección) y de cada operador
  (por token y alias). Lo baja `src/lib/manual.js` (una vez por idioma,
  cacheado): el editor muestra al pasar el cursor una tarjeta con el resumen
  y el enlace (helpers puros en `editor/hover.js`; la métrica de la fuente
  mono y el tabulador cada 4 columnas; sin sitio, no aparece), y el
  inspector enlaza cada sysvar de Memoria, de las consultas y de Sentidos
  (ojos incluidos).
- Ruta `#/bots/nuevo[?adn=…]`: el router parsea la consulta del hash
  (`consulta` en `Ruta`, un objeto plano); Bots abre el diálogo de bot nuevo
  con ese ADN precargado (no crea nada sin nombre: se nombra y Crear lleva
  al editor). `nuevo` queda reservado en la ruta de bots.
- «Abrir en la app» en los bloques `adn` del manual (junto a «Copiar»), con
  la URL relativa a la raíz del sitio. `vite-plugin-sitio` monta `/manual/`
  y `/en/` desde `port/sitio/salida` en dev (antes de correr
  `node port/sitio/generar.mjs` no hay tarjetas ni enlaces finos).
- Manual al día con la app: `empezar/primera-simulacion` (sembrar vía
  «Abrir en la app»), `app/bots` (#nuevo, #pestanas), `app/editor` (la
  sección nueva #resumen), `app/experimentar-avanzado`, `app/inspector` y
  `tecnico/como-esta-hecho`.
- Tests: 778/778 (`router` con la consulta, `editor_hover` con hover.js y
  manual.js, `manual.test.js` con el bloque «Abrir en la app»,
  `vocabulario.json` y los slugs que usa la app); `biome check` y
  `generar.mjs --lint` limpios.

### S-E · Inglés

Traducción por capítulo en paralelo, con el test de paridad (S11).

**Cierre:** cero páginas `pendiente` en `manual/en/` y `spec.yaml` con todos
los campos traducidos.

Parte técnica adelantada el 2026-10-03 (antes de S-C):

- `generar.mjs` arma un manual por idioma (`IDIOMAS` en `port/sitio/textos.mjs`):
  el español en `<sitio>/manual/` y el inglés en `<sitio>/en/manual/`, con las
  mismas páginas y los mismos slugs (en español también en las URLs en
  inglés). La CLI pasó de `--destino` a `--sitio <raíz>`; `armar-sitio.sh`
  le pasa la carpeta del sitio.
- Textos fijos: los de la plantilla, las fichas y los avisos en
  `port/sitio/textos.mjs`; los títulos del índice, de los grupos de sysvars y
  de las familias, en el campo `en` de `indice.mjs`; los parámetros salen de
  `engine/opciones.js`, que ya tenía `en`. `manual.js` toma los suyos de
  `<html lang>`.
- Los 429 `.md` de `port/sitio/manual/en/` están sembrados (`pendiente`, con
  el título en inglés). Las claves del frontmatter y los valores de `estado`
  son los mismos que en español.
- Los datos de la spec (en español) se traducen en
  `port/sitio/manual/en/spec.yaml` (`registros` por `addr`, `opcodes` por
  `token`; campos `escribe`, `lee`, `borra`, `rango`, `nota`, `sem`,
  `effect`, `value`). Lo que falta sale en español con `lang="es"`. Una
  dirección, un token o un campo que no existen hacen fallar el build.
- Paridad (falla el build): una página en inglés que no está `pendiente`
  necesita el original escrito, el mismo número de bloques ```` ```adn ```` y
  los mismos `:::parametro`. Una página en inglés pendiente cuyo original está
  escrito dice «This page has not been translated yet» y enlaza al español.
- Cada página enlaza a su par en el otro idioma (barra y
  `<link rel="alternate" hreflang>`). Portada en inglés en
  `port/sitio/publico/en/index.html`; las dos portadas se enlazan.
- Tests: 3 nuevos en `manual.test.js` (inglés con los textos fijos y los
  enlaces cruzados, `spec.yaml`, paridad), y el de enlaces internos recorre
  los dos idiomas.

Traducción hecha el 2026-10-06 (tres olas, 55 agentes, ~6,5 M tokens): las
429 páginas de `manual/en/` y las 10 fichas `manual/en/spec/*.yaml` están
`revisada`; cero pendientes en los dos idiomas, `--lint` limpio, 778/778.
Cada lote pasó por un traductor y un revisor, con un glosario es→en común y
las anclas de los encabezados fijadas con `{#…}` iguales a las del español.
Decisiones: el Glosario en inglés va en orden alfabético inglés (sin ancla de
letra compartida con el español, nadie enlaza a ellas). Los tests que daban
el inglés por sin traducir pasaron a comprobar lo contrario (ninguna ficha
sale en español). Los revisores anotaron 128 dudas sobre el original en
español en `port/sitio/NOTAS-TRADUCCION.md` (sin resolver).

### Cómo se traduce una página

`port/sitio/manual/en/<capítulo>/<página>.md`, con el mismo frontmatter
(`titulo`, `resumen`, `etiquetas`, `estado`) en inglés. Se traduce desde el
original en español ya `revisada`; los bloques ```` ```adn ```` se copian tal
cual (se pueden traducir los comentarios `'`), los enlaces `[[…]]` no
cambian, y un `[[página#ancla]]` usa el ancla de la página en inglés (o fijala
con `{#ancla}` en los dos idiomas). Sysvars, operadores y nombres de bots no
se traducen. Si el original cambia, la traducción se revisa a mano: la
paridad solo compara bloques y parámetros.

## Cómo se escribe una página

Cada página es `port/sitio/manual/es/<capítulo>/<página>.md`:

```
---
titulo: Genes: cond, start, else y stop
resumen: "Una frase: sale bajo el título, en el índice y en el buscador."
etiquetas: [gen, cond, start]
estado: borrador
---
Texto en Markdown…
```

- `estado`: `pendiente` (sin escribir) → `borrador` (escrita) → `revisada`
  (pasó el revisor de S12). Las comillas son opcionales: un valor entre
  comillas se lee como cadena JSON.
- Cursiva con `_guiones bajos_`: el asterisco es del ADN (`*.eye5`).
- `[[.shoot]]` (o `[[.7]]`, por dirección), `[[op:store]]` (también
  `[[op:!=]]`), `[[param:opt:11]]` y `[[adn/genes]]`, `[[adn/genes#ancla]]`
  o `[[adn/genes|otro texto]]`. Un destino o un ancla que no existen hacen
  fallar el build.
- `## Título {#ancla}` fija el ancla; si no, sale del texto (sin acentos).
- ```` ```adn ```` pasa por el lint; ```` ```adn sin-lint ```` no (para
  mostrar un error a propósito). `:::nota` y `:::cuidado` hasta `:::`.
- En una página de referencia (sysvar, operador, grupo) la ficha de datos
  ya sale arriba (de `manual/es/spec/*.yaml`, ver «Fichas en castellano
  llano»): el `.md` lleva el resumen y la prosa (qué es, para qué
  sirve, un ejemplo). En una de parámetros, la prosa de cada uno va en
  `:::parametro opt:11` … `:::` y sale dentro de su ficha.
- Las citas a la spec del revisor van en comentarios `<!-- 20-VM §5.4 -->`,
  que no se publican.

Se genera con `node port/sitio/generar.mjs` (salida en
`port/sitio/salida/manual/` y `port/sitio/salida/en/manual/`, ignorada por
git); `--sembrar` crea los `.md` que falten de páginas nuevas del índice, en
los dos idiomas.

## Fichas en castellano llano

La ficha de cada sysvar y cada operador sale de `port/sitio/manual/es/spec/*.yaml`
(un archivo por lote; `registros` por `addr` y `opcodes` por `token`). Los
campos son `escribe`, `lee`, `borra`, `rango` y `nota` en los registros, y
`sem`, `effect`, `value`, `cost` y `flow` en los operadores. Cada campo
reescribe en castellano llano el de `spec/sysvars.yaml` o `spec/opcodes.yaml`
y describe lo que hace el port, con las correcciones de `port/README.md`. Puede
llevar enlaces `[[…]]`; un `""` oculta la fila. Un campo sin versión llana sale
tal cual está en la spec.

Las fases del ciclo se nombran siempre igual: el ADN → se borran los
sentidos → los disparos → fuerzas y choques → movimiento → acciones →
nacimientos y muertes → el sol. La ficha ya no cita el fuente original, y el
costo enlaza a su parámetro (`[[param:cost:N]]`). El inglés
(`manual/en/spec.yaml`) se traduce desde esta versión.

## Cómo se reparte el trabajo

S-A y S-B entran en una sesión cada una. S-C no: va por olas de ~8 agentes
(redactores, después revisores), con el orquestador integrando y mirando el
resultado en el navegador (C16 de `PLAN.md`). Cada agente escribe solo los
archivos de su capítulo, así no chocan (como C9). El `estado` de cada página
en su frontmatter permite que cualquier sesión retome desde el índice.
