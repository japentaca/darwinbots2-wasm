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
   (escudo, veneno, ponzoña, baba); lazos y multicelulares; virus;
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

### S-C · Redacción en español (en paralelo)

Olas de redactores por capítulo, cada uno con su lista de páginas y las
secciones de la spec que le tocan, y después un revisor por capítulo (S12).
Orden: 4, 5–6, 3, 1–2, 7, 8–9.

**Cierre:** cero páginas `pendiente`, todas revisadas y con citas a la spec.

### S-D · La app enlaza al manual

Los «?» y los resúmenes en el editor, Experimentar avanzado y el inspector
(S10).

**Cierre:** cada pantalla y cada parámetro llevan a su página.

### S-E · Inglés

Traducción por capítulo en paralelo, con el test de paridad (S11).

## Cómo se reparte el trabajo

S-A y S-B entran en una sesión cada una. S-C no: va por olas de ~8 agentes
(redactores, después revisores), con el orquestador integrando y mirando el
resultado en el navegador (C16 de `PLAN.md`). Cada agente escribe solo los
archivos de su capítulo, así no chocan (como C9). El `estado` de cada página
en su frontmatter permite que cualquier sesión retome desde el índice.
