# Cómo ejecutar PLAN-LIGAS.md sin atender

Receta para correr [`PLAN-LIGAS.md`](PLAN-LIGAS.md) con un agente
orquestador que lanza un subagente por paso
(`.claude/agents/desarrollador.md`). Ningún paso toca `port/core` ni
`port/wasm`, así que no hace falta `desarrollador-motor`. Escrito el
2026-10-11.

La receta está pensada para que **el orquestador no sature su contexto**:

- Lee solo el índice, «Cómo usar» y «Decisiones» del plan; el cuerpo de cada
  paso lo lee el subagente.
- Lleva la cuenta por los commits (`L2.3: …`), no de memoria: si su contexto
  se compacta o la sesión se corta, retoma con `git log`.
- Corre las verificaciones con la salida recortada (`tail`) y no lee diffs,
  solo `git diff --stat`.
- Los subagentes reportan en 25 líneas como máximo.

## Lanzar

Sesión nueva de Claude Code en la raíz del repo, con Opus 5.5 y esfuerzo
`high`:

```sh
claude --model opus --dangerously-skip-permissions
```

y pegar el prompt de abajo. O en modo headless:

```sh
claude -p "<el prompt de abajo>" --model opus --dangerously-skip-permissions
```

Lleva un par de horas (los tests con wasm tardan). Nada hace `git push`.

## Prompt

```
Sos el orquestador de port/web2/PLAN-LIGAS.md. Cuidá tu contexto: no leas
código ni diffs, no leas el cuerpo de los pasos; eso lo hacen los
subagentes.

0. Leé de port/web2/PLAN-LIGAS.md SOLO desde el principio hasta el final de
   la sección «Decisiones» (el índice, «Cómo usar» y D1-D8). Corré
   `git log --oneline -40` y tomá como hechos los pasos cuyo commit empieza
   con «L<n>.<m>:». Seguí desde el primero que falte. Si no existe
   port/build-wasm/dbcore.js, corré desde port/:
   `cmake --preset wasm && cmake --build --preset wasm 2>&1 | tail -3`.
   Repetí este punto 0 entero si en algún momento perdés el hilo (por
   ejemplo, después de que se compacte tu contexto).

1. Por cada paso del índice, en orden, salvo L4.2: lanzá UN subagente con
   Agent, subagent_type "desarrollador", el model de la columna «Modelo» del
   índice y el prompt:
   «Ejecutá el paso <paso> de port/web2/PLAN-LIGAS.md.»
   Un paso por subagente; nunca dos en paralelo (comparten el árbol).

2. Al terminar, verificá vos, sin fiarte del reporte, con salidas cortas:
   - `git status --short | head -30` y `git diff --stat | tail -5`
     (tamaño razonable; nada en Darwinbots2/, port/web/, port/core/,
     port/wasm/).
   - CRLF: `git diff --name-only | while read f; do [ -f "$f" ] &&
     [ "$(tr -cd '\r' < "$f" | wc -c)" != 0 ] && echo "CRLF $f"; done`
     (más los archivos nuevos de `git status --short`). No uses grep $'\r'.
   - Desde port/web2: el comando de la columna «Verificación» del paso,
     `npm test 2>&1 | tail -12` y `npm run check 2>&1 | tail -5`.
   Si algo falla, relanzá el mismo paso con el mismo modelo y, en el prompt,
   las últimas 30 líneas del error. Si vuelve a fallar, relanzalo con
   model "sonnet" (si ya era sonnet, con "opus"). A la tercera falla, pará:
   escribí port/web2/PLAN-LIGAS-INFORME.md con lo que pasó, commitealo y
   terminá.

3. Con el paso verde: `git add -A` de los archivos del paso y commit en
   español con título «L<n>.<m>: <qué cambió>» y cuerpo con el porqué y los
   desvíos que reportó el subagente (resumidos). Terminá el mensaje con las
   líneas de atribución que te indique el sistema. Nunca git push.

4. Al cerrar L2 (después de L2.5) y L3 (después de L3.4): corré
   `node port/sitio/generar.mjs --lint 2>&1 | tail -8` desde la raíz y
   `npm test -- test/claves.test.js test/manual.test.js 2>&1 | tail -8`.
   Si falla, un subagente "desarrollador" (model "haiku") lo corrige con el
   error en el prompt; commit «L<n>.x: …».

5. L4.2: lanzá un subagente "desarrollador" (model "sonnet") con el prompt
   «Ejecutá .agents/skills/verificar-cambios/SKILL.md completo y reportá en
   25 líneas qué pasó y qué falló.». Si algo falla, corregilo con otro
   subagente. Después escribí vos port/web2/PLAN-LIGAS-INFORME.md (cifras de
   tests, desvíos por paso sacados de los commits, pendientes: D5 y lo que se
   haya salteado, y la prueba manual de L4.2) y sumalo a DOCUMENTACION.md
   como histórico. Commit «L4.2: informe de la ejecución de PLAN-LIGAS.md».

Reglas que no se negocian: Darwinbots2/, port/web/, port/core/ y port/wasm/
no se tocan; sin dependencias nuevas (package.json no cambia); sin
TypeScript; archivos en LF; sin push. Trabajá sin pedirme confirmación:
estoy ausente. Si algo te deja sin poder avanzar, escribí el informe y
terminá.
```

## Al volver

1. `git log --oneline` para ver hasta qué paso llegó.
2. Leer `port/web2/PLAN-LIGAS-INFORME.md`.
3. Probar a mano en `npm run dev`: crear un torneo con cada liga, ver una
   descalificación en un partido F3, sortear con «Bots de la liga» en SB y
   SS, y que F4 proponga `nrg` y 100.
4. Decidir D5 (MB kill restrictions) y el push.
