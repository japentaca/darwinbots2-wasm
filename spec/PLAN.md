# PLAN — Extracción de la especificación

Derivado del reconocimiento en `00-INVENTARIO.md`. **Pendiente de tu aprobación.**

---

## Principio rector

El fuente es la spec. El orden de trabajo lo dicta el grafo de dependencias entre
subsistemas, no el orden del listado de documentos del brief. Hay tres documentos que
bloquean todo lo demás y **no admiten paralelización**.

---

## Orden de lectura propuesto

### Bloque A — Secuencial, a mano, sin subagentes (bloquea todo)

Estos tres los hago yo, leyendo línea a línea, en este orden estricto.

**A1 · `spec/10-CICLO.md`** — el orden de operaciones.
Lectura: `Master.bas:23-555` completo → `DNA.bas:1245` (`ExecRobs`) →
`Robots.bas:1476` (`UpdateBots`) → `Shots.bas:288` (`updateshots`) → `main.frm:2061` (bucle exterior).

Preguntas que debe responder, y que condicionan cada documento posterior:
- ¿La iteración por bots es simultánea o secuencial? Es decir, ¿el bot `t` ve el estado
  ya actualizado del bot `t-1` dentro del mismo paso? El código itera `For t = 1 To MaxRobs`
  y muta `rob(t)` en el sitio; si no hay doble búfer, **el índice del bot determina su
  ventaja competitiva**. Sería un `[PROBABLE BUG]` de altísimo impacto: cambia toda la
  ecología y el corpus lleva veinte años evolucionando contra él.
- ¿`UpdateBots` es un bucle único que hace todo por bot, o varias pasadas por fase?
  De esto depende si el port puede paralelizar.
- Dónde nacen y dónde mueren exactamente los bots dentro del ciclo, y qué le pasa a los
  índices liberados.

**A2 · `spec/20-VM.md`** — parser y ejecución del ADN.
Lectura: `Module1.bas` (los stacks: `PushIntStack`, `PopIntStack`, `ClearIntStack`, `DupIntStack`,
`IsRobDNABounded`) → `DNA.bas:56-1244` (intérprete y todos los operadores) →
`DNATokenizing.bas:1-861` y `:3169-3306` (tokenizar/destokenizar).

Nota de orden: **los stacks están en `Module1.bas`, no en `DNA.bas`**. Hay que leerlos
primero o la semántica de cada operador no se entiende.

**A3 · `spec/21-MEMORIA.md`** — el mapa de memoria.
Lectura: `DNATokenizing.bas:862-3169` (`LoadSysVars`, ~2 300 líneas) más los puntos donde
el motor escribe cada posición, que están repartidos por `Robots.bas`, `Senses.bas`,
`Ties.bas` y `Shots.bas`.

Este documento se produce junto con `spec/sysvars.yaml` en la misma pasada: sería absurdo
recorrer 2 300 líneas dos veces.

### Bloque B — Paralelizable con subagentes

Sólo arranca cuando A1–A3 estén cerrados, porque todos dependen del orden del ciclo y del
mapa de memoria. Agrupados por acoplamiento:

| Grupo | Documentos | Fuente principal |
|---|---|---|
| **B1 · Física** | `30-FISICA.md` | `Physics.bas`, `Quads.bas`, `Robots.bas:826` (`UpdatePosition`) |
| **B2 · Percepción** | `32-VISION.md` | `Senses.bas`, `Quads.bas:350-600` (geometría de ojos, `CompareRobots3`) |
| **B3 · Combate** | `33-SHOTS.md`, `35-VIRUS.md` | `Shots.bas` (los virus viven ahí: `Vshoot`, `MakeVirus`, `addgene`) |
| **B4 · Conexiones** | `34-TIES.md` | `Ties.bas`, `Multibots.bas`, `Physics.bas:465` (`TieHooke`), `:651` (`TieTorque`) |
| **B5 · Metabolismo** | `31-ENERGIA.md` | `Robots.bas` (`Upkeep`, `ManageBody`, `HandleWaste`, `ManageChlr`), `CostsForm.frm`, `Vegs.bas` |
| **B6 · Herencia** | `36-REPRO.md`, `40-MUTACIONES.md` | `Robots.bas:1367` + `:562` (`crossover`), `NeoMutations.bas` |
| **B7 · Mundo** | `50-MUNDO.md` | `Vegs.bas`, `Obstacles.bas`, `Teleport.bas`, `SimOptions.bas`, `OptionsForm.frm` |
| **B8 · Formatos** | `60-FORMATOS.md` | `DNATokenizing.bas` (`LoadDNA`, `Parse`, `SaveRobHeader`, `Hash`), `HDRoutines.bas`, `Module1.bas` (`RobScriptLoad`) |

Dependencias cruzadas que ya sé que existen y que resolveré con referencia explícita,
no adivinando: B1↔B4 (los ties son restricciones físicas), B2↔B1 (los buckets sirven a
visión y a colisión), B3↔B5 (los disparos mueven energía), B6↔B5 (reproducir cuesta).

**B5 (energía) es el más transversal** y lo dejo para el final del bloque: toca todos los
demás. Va con `spec/constants.yaml`.

### Bloque C — Artefactos accionables

- `spec/constants.yaml` — se alimenta durante todo B; se cierra al final.
- `spec/sysvars.yaml` — sale de A3.
- `spec/opcodes.yaml` — sale de A2.
- `spec/70-CASOS-DORADOS.md` — el último. Antes de escribirlo reviso
  `UnitTests/DarwinBots2UnitTests.vbp`: los autores ya escribieron tests contra el motor
  y puede que regalen casos con el resultado esperado ya fijado.

---

## Riesgos identificados en Fase 0

1. **`DnaOps.bas` es código muerto que parece central.** 962 líneas con una implementación
   antigua de mutaciones. Cualquier subagente que busque "mutaciones" por nombre de archivo
   caerá ahí. Va como aviso explícito en el prompt de cada subagente del grupo B6.
   Lo mismo con `DoubleWord.cls` frente a `Bitwise.bas`.
2. **El binario y el IDE pueden divergir.** Con `OverflowCheck=0` y `BoundsCheck=0`
   (`Iersera.vbp`), el EXE distribuido no lanza error donde el IDE sí lo haría. El corpus
   evolucionó contra el EXE. Toda la spec numérica se escribe describiendo **el
   comportamiento del binario**, y donde el IDE difiera lo anoto.
3. **Contaminación desde el wiki.** Esta sesión ya tiene contenido del wiki en contexto
   (direcciones de sysvars, orden de acciones, límites de movimiento). El brief prohíbe
   usarlo. Mitigación: **el Bloque A se ejecuta en una sesión limpia.** Ver más abajo.
4. **`Master.bas` mezcla ecología y competición.** Los modos `hidepred`, `x_restartmode` y
   ZeroBot son andamiaje de torneo. `10-CICLO.md` los documentará como capa separable para
   que el port no los arrastre al núcleo.

---

## Recomendación de higiene, antes de arrancar el Bloque A

**Lanzá A1–A3 en una sesión nueva.** Este contexto está contaminado con el wiki y con
las conclusiones de la sesión anterior. La Fase 0 no corría riesgo — es inventario
mecánico de archivos — pero el Bloque A sí: un dato del wiki colado como si viniera del
código sería invisible en la revisión, y es exactamente el fallo que el brief quiere evitar.

**Poné el repo bajo git antes.** El método del brief pide un commit por documento, y ahora
mismo no hay control de versiones. Sin él no hay forma de verificar que los fuentes siguen
intactos ni de auditar de dónde salió cada afirmación.

---

## Estimación

| Bloque | Alcance | Notas |
|---|---|---|
| A1 CICLO | ~5 000 LOC leídas con cuidado | El más denso. Todo depende de él. |
| A2 VM | ~4 000 LOC | `DNA.bas` + stacks + tokenizador. |
| A3 MEMORIA | ~2 300 LOC de tabla | Mecánico pero largo. Sale con el YAML. |
| B (8 grupos) | ~12 000 LOC | Paralelizable. |
| C | — | Depende de A y B. |

---

## Estado

Fase 0 cerrada. **Esperando aprobación del plan para arrancar A1.**
