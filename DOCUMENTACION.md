# Documentación del repositorio

Qué documento mirar para cada cosa. El manual público (darwinbots-wasm.org,
fuente en `port/sitio/manual/`) explica el programa a quien lo usa; lo de
acá es para quien trabaja en el código. Los documentos **vivos** se
mantienen al día con cada cambio; los **históricos** se conservan como
registro y no se actualizan.

## Para empezar

| Documento | Para qué | |
|---|---|---|
| [`README.md`](README.md) · [`README.en.md`](README.en.md) | Qué es el proyecto, estado, cómo compilar y correr. | vivo |
| [`AGENTS.md`](AGENTS.md) | Reglas duras, comandos y cómo se documenta un cambio (`CLAUDE.md` solo lo importa). | vivo |
| [`.agents/skills/`](.agents/skills/) | Procedimientos: actualizar la documentación, escribir el manual, verificar, cambiar el motor. | vivo |

## La especificación (`spec/`)

| Documento | Para qué | |
|---|---|---|
| `spec/00-INVENTARIO.md` a `spec/60-FORMATOS.md` | La especificación del original extraída del fuente VB6, por subsistema. | vivo |
| `spec/sysvars.yaml`, `opcodes.yaml`, `constants.yaml` | Las tablas de la spec en formato de datos (las fichas del manual parten de ahí). | vivo |
| [`spec/70-CASOS-DORADOS.md`](spec/70-CASOS-DORADOS.md) | La suite de verdad: cada caso es un test de `port/tests/`. | vivo |
| [`spec/REVISION-PORT.md`](spec/REVISION-PORT.md) | La revisión del port contra el fuente VB6, piloto por piloto. | vivo |
| [`spec/OPEN_QUESTIONS.md`](spec/OPEN_QUESTIONS.md) | Preguntas que el fuente no resuelve. | vivo |
| [`spec/PROGRESO.md`](spec/PROGRESO.md) | Estado de la extracción, de los milestones M1–M10 y de las etapas E1–E13. | vivo, solo para etapas del plan |
| [`spec/PLAN-EXTENSIONES.md`](spec/PLAN-EXTENSIONES.md) | El plan de las etapas E1–E13 (la superficie del original que faltaba). | vivo, solo para etapas del plan |
| [`spec/PLAN.md`](spec/PLAN.md) | La decisión de arquitectura del port y el plan de extracción. | histórico salvo la decisión de arquitectura |
| [`spec/historial/`](spec/historial/) | Los prompts de arranque de cada bloque de la extracción (agosto de 2026). | histórico |

Los añadidos fuera de etapa no van en `spec/PROGRESO.md` ni en
`spec/PLAN-EXTENSIONES.md`: van en los README y planes de `port/`.

## El port (`port/`)

| Documento | Para qué | |
|---|---|---|
| [`port/README.md`](port/README.md) | Estructura de `port/`, estado, build, herramientas, **bugs del original corregidos** y toolchain. | vivo |
| [`port/HISTORIA.md`](port/HISTORIA.md) | Cómo se construyó: milestones M1–M10 del motor y etapas de la app clásica (`port/web/`). | histórico |
| [`port/web2/PLAN.md`](port/web2/PLAN.md) | Plan y decisiones de la app nueva. | vivo |
| [`port/web2/PLAN-SITIO.md`](port/web2/PLAN-SITIO.md) | Plan del sitio y del manual (etapas S-A a S-E, cómo se escribe una página). | vivo |
| [`port/web2/PLAN-TORNEO-EN-CURSO.md`](port/web2/PLAN-TORNEO-EN-CURSO.md) | Rediseño de cómo se juega y se mira un torneo (decisión 25). | vivo |
| [`port/web2/PLAN-EDITOR.md`](port/web2/PLAN-EDITOR.md) | Herramientas del editor de ADN (decisión 26): visor de pila, trazador, fichas y evolución asistida, etapa por etapa. | vivo |
| [`port/web2/PLAN-EDITOR-ORQUESTADOR.md`](port/web2/PLAN-EDITOR-ORQUESTADOR.md) | Receta y prompt para ejecutar `PLAN-EDITOR.md` sin atender, con los agentes de `.claude/agents/`. | vivo |
| [`port/web2/historial/PROGRESO.md`](port/web2/historial/PROGRESO.md) | Diario de la construcción de la app nueva (2026-09-29/30). | histórico |
| [`port/sitio/NOTAS-TRADUCCION.md`](port/sitio/NOTAS-TRADUCCION.md) | Decisiones de estilo de la traducción al inglés. | vivo |
| [`port/tools/bestiary/README.md`](port/tools/bestiary/README.md) | El archivador de bots del foro y del wiki. | vivo |
| [`port/tools/fight/README.md`](port/tools/fight/README.md) | Partidos y torneos sin navegador. | vivo |

## El manual (`port/sitio/manual/`)

Fuente de darwinbots-wasm.org/manual/ en `es/` y `en/`, con la misma
estructura: `empezar/`, `app/`, `simulacion/`, `adn/`, `sysvars/`,
`operadores/`, `tutoriales/`, `estrategias/`, `tecnico/` y las fichas de
`spec/*.yaml`. Cómo se escribe, en
[`.agents/skills/escribir-manual/SKILL.md`](.agents/skills/escribir-manual/SKILL.md).
