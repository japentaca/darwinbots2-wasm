# AGENTS.md

Instrucciones para cualquier agente de código (Claude Code, OpenCode, Codex,
Gemini CLI, Cursor…) que trabaje en este repositorio. Están escritas para
leerse sin herramientas especiales: los procedimientos largos viven en
`.agents/skills/*/SKILL.md` (formato abierto Agent Skills) y se pueden abrir
como archivos comunes si tu herramienta no carga skills.

El proyecto se escribe en **español rioplatense** (voseo: «hacé clic en»,
«elegí»): código, comentarios, commits y documentación. El inglés existe solo
como traducción (README.en.md, la app en inglés y `/en/manual/`).

## Qué es esto

Un port fiel de **DarwinBots 2.48.32** (VB6) a C++20 → WebAssembly, con una
web que lo corre y un manual completo. Sitio: https://darwinbots-wasm.org
(portada, `/manual/`, `/en/manual/`, `/app/`, `/classic/`), publicado en
Cloudflare Pages en cada push a `main` (`.github/workflows/sitio.yml`).

| Carpeta | Qué es | Regla |
|---|---|---|
| `Darwinbots2/` y el resto de la raíz heredada (`DBLaunch/`, `Installer/`…) | Fuente VB6 original | **Solo lectura.** `git diff 02b20d7 -- Darwinbots2/` debe salir vacío (lo comprueba CI). |
| `spec/` | Especificación extraída del fuente; `70-CASOS-DORADOS.md` es la suite de verdad, `PROGRESO.md` el estado | El fuente VB6 manda cuando hay que desambiguar. |
| `port/README.md`, `port/HISTORIA.md` | Estado, build y bugs corregidos del port; la historia de milestones y etapas | `HISTORIA.md` es registro: no se actualiza. |
| `port/core/` | Motor C++20 header-only | Ciclo dorado: caso en rojo → transcripción citando el fuente → verde. |
| `port/wasm/` | API wasm (`dbcore_api.cpp`) | Exports nuevos de solo lectura; `.dbsim` idéntico byte a byte. |
| `port/web/` | La app clásica | **Congelada**: no se toca. |
| `port/web2/` | La app nueva (Vite + Svelte 5 + Biome, JS con JSDoc, sin TypeScript); `engine/` sin DOM, `src/` la UI, `test/` con `node:test` | Plan y decisiones en `port/web2/PLAN.md`. |
| `port/sitio/` | Generador del sitio (`generar.mjs`), manual en `manual/es/` y `manual/en/`, portadas en `publico/` | Plan en `port/web2/PLAN-SITIO.md`. |
| `port/tools/` | Bestiario, peleas | Cada una con su README. |

Qué documento mirar para cada cosa, y cuáles son vivos y cuáles históricos
(`spec/historial/`, `port/HISTORIA.md`, `port/web2/historial/`), está en
[`DOCUMENTACION.md`](DOCUMENTACION.md). Un documento nuevo se agrega ahí.

## Reglas duras

1. `Darwinbots2/` no se modifica nunca.
2. La capa JS nunca recalcula física ni RNG: solo presenta lo que vuelca el core.
3. Los bugs del original se corrigen solo si el lenguaje del ADN no cambia
   (única excepción decidida: el `else` tras `start`). Si un cambio altera el
   comportamiento de una rutina portada, avisá: la revisión contra VB6
   (`spec/REVISION-PORT.md`) tendría que volver a verla.
4. Nada de `-ffast-math` ni FMA implícita; las conversiones float→int pasan
   por `vb_round64`/`vb_clng`.
5. Sin dependencias nuevas sin preguntar (el generador del manual y la i18n
   son propios a propósito). Sin TypeScript.
6. Finales de línea: `.gitattributes` tiene `* -text` y los fuentes están en
   LF. No reescribas archivos en modo texto en Windows (Python: `newline=''`).
   Después de editar, `git diff --stat` tiene que tener un tamaño razonable.
7. Sysvars, operadores y nombres de bots **no se traducen** en ningún idioma.
8. Los añadidos fuera de etapa se documentan en los README y planes de
   `port/`, no en `spec/PLAN-EXTENSIONES.md` ni en `spec/PROGRESO.md`.

## Cada cambio se refleja en la web y en los manuales, en los dos idiomas

Un cambio no está terminado hasta que la documentación pública dice lo
mismo que el código. En el mismo commit (o en uno inmediatamente después):

- **Manual** (`port/sitio/manual/es/` **y** `port/sitio/manual/en/`): toda
  página que describa lo que cambiaste — pantallas de la app (`app/*.md`),
  parámetros (`app/parametros-*.md`), simulación, ADN, fichas de sysvars y
  operadores (`manual/es/spec/*.yaml` y `manual/en/spec/*.yaml`), tutoriales
  cuyos pasos o rótulos cambian, `tecnico/` (diferencias, cómo está hecho).
  Primero el español; después la traducción con el mismo número de bloques
  `adn`, los mismos `:::parametro` y las mismas anclas `{#…}`.
- **App** (`port/web2`): los textos en `src/i18n/es/*.json` **y**
  `src/i18n/en/*.json` (mismas claves), y en `engine/opciones.js` los campos
  `es`/`en` y `ayuda.es`/`ayuda.en`. Una pantalla o sección nueva necesita su
  página `app/<sección>.md` (el «?» de la barra enlaza ahí) y un parámetro
  nuevo su `:::parametro` en la página de su grupo.
- **Portadas** (`port/sitio/publico/index.html` y `publico/en/index.html`) si
  cambia algo de lo que anuncian.
- **READMEs**: `README.md` **y** `README.en.md` (cifras como casos/aserciones
  o bots del Bestiario, funcionalidades, estado), `port/README.md` y el de la
  herramienta que tocaste.
- **Planes**: `port/web2/PLAN.md`, `PLAN-SITIO.md` o
  `PLAN-TORNEO-EN-CURSO.md` si el cambio cierra o altera una decisión o
  etapa.

Si un cambio no tiene nada que documentar, decilo explícitamente al cerrar
(«sin impacto en el manual»), no lo omitas en silencio. El procedimiento
completo, con la lista de qué mirar según qué tocaste, está en
`.agents/skills/actualizar-documentacion/SKILL.md`.

## Comandos

Desde `port/` (requiere CMake ≥ 3.25, Ninja, g++/clang y emsdk con `EMSDK`;
en la máquina del autor `EMSDK=C:/Users/jntac/emsdk`):

```sh
cmake --preset native-gcc && cmake --build --preset native-gcc && build/dbtests
cmake --preset wasm && cmake --build --preset wasm && node build-wasm/dbtests.js
```

Desde `port/web2/`:

```sh
npm test          # node:test (los que necesitan wasm se saltean sin él)
npm run check     # Biome, también sobre port/sitio
npx vite build
npm run dev       # sirve /app, /classic, /build-wasm y el manual generado
```

Manual (desde la raíz):

```sh
node port/sitio/generar.mjs --lint     # genera es y en; falla con enlaces rotos,
                                       # paridad rota o avisos del lint de ADN
node port/sitio/generar.mjs --sembrar  # crea los .md de páginas nuevas del índice
node port/sitio/probar-adn.mjs --adn "cond start 10 .up store stop" --ciclos 5
```

La verificación completa antes de un commit está en
`.agents/skills/verificar-cambios/SKILL.md`.

## Skills del repositorio

| Skill | Cuándo |
|---|---|
| `actualizar-documentacion` | Después de **cualquier** cambio de comportamiento, UI, parámetros o cifras. |
| `escribir-manual` | Al escribir, corregir o traducir una página del manual. |
| `verificar-cambios` | Antes de dar algo por terminado o de commitear. |
| `cambiar-motor` | Al tocar `port/core/` o `port/wasm/`. |

Fuente canónica: `.agents/skills/`. `.claude/skills/` es una copia para Claude
Code; se regenera con `node port/web2/scripts/sincronizar-skills.mjs` y un
test (`port/web2/test/skills.test.js`) falla si difieren. Editá siempre la de
`.agents/`.

Este archivo es la única fuente de instrucciones: `CLAUDE.md` solo lo importa
(`@AGENTS.md`). Para otra herramienta que busque su propio archivo, apuntala
a `AGENTS.md` en su configuración (en Gemini CLI, `context.fileName`) en vez
de copiar el contenido.

## Git

- Una sola rama: `main`. Si trabajás en otra, al integrarla borrala (local y
  remota).
- Commits en español, título corto que diga qué cambió, cuerpo con el porqué.
- **No hagas push sin permiso explícito**: cada push a `main` publica el sitio.
- No commitees `port/sitio/salida/`, `dist/` ni `build*/` (ya están ignorados).
