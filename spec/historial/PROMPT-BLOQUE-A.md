# Prompt de arranque — Bloque A de la extracción de spec

> Copiá el bloque de abajo como primer mensaje de una sesión nueva, en el directorio
> `C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`.
>
> **Por qué en sesión nueva:** la sesión que produjo la Fase 0 tiene contenido del wiki
> de Darwinbots en su contexto. El método prohíbe usarlo. Un dato del wiki colado como si
> viniera del código sería invisible en la revisión, y es exactamente el fallo que este
> proceso existe para evitar.

---

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de **DarwinBots 2.48.32 (Visual Basic 6)**.

Voy a reimplementar el simulador desde cero: core sin dependencias de motor, compilado a
WASM, render 2D en web. El objetivo es **compatibilidad de comportamiento** con el lenguaje
de ADN y con la ecología originales, para poder importar y correr el corpus histórico de bots.

Tu tarea **no es portar código**. Es producir una **especificación formal, verificable y
trazable**, extraída exclusivamente del fuente.

### Antes de nada

La Fase 0 (reconocimiento) ya está hecha. Leé estos tres archivos antes de tocar nada más:

- `spec/00-INVENTARIO.md` — versión, flags de compilación, código muerto, mapa de módulos,
  loop principal e intérprete localizados, RNG localizado
- `spec/PLAN.md` — el orden de lectura que vas a seguir
- `spec/OPEN_QUESTIONS.md` — 9 preguntas abiertas

El repo está bajo git. El commit `02b20d7` es la línea base del fuente intacto.

### Reglas duras

1. **Los fuentes son read-only.** No modificar, no refactorizar, no "arreglar" nada.
   Todo output va a `spec/`. Verificable en cualquier momento con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. **Toda afirmación cita `archivo:línea`.** Sin cita, no entra en el documento.
3. **El fuente es la spec. Todo lo demás es rumor** — el wiki de Darwinbots, los foros,
   la documentación suelta, y tu propio conocimiento previo de Darwinbots. Si algo no se
   deriva del fuente, marcalo `[SIN VERIFICAR]` y anotalo en `spec/OPEN_QUESTIONS.md`.
   **Nunca rellenes huecos con lo que "tendría sentido".** Un hueco documentado vale más
   que una suposición plausible: la suposición se propaga en silencio al port y reaparece
   seis meses después como un bot que no sobrevive.
   **No consultes el wiki de Darwinbots en esta sesión bajo ningún concepto.** Su archivado
   y el diff contra la spec son una tarea separada, posterior, y en otra sesión.
4. **Los bugs son parte de la especificación.** Si el código hace algo raro (overflow,
   off-by-one, orden contraintuitivo), documentalo como comportamiento observado y marcalo
   `[PROBABLE BUG]`. No lo corrijas ni asumas cuál era la intención: la comunidad evolucionó
   bots que explotan esos comportamientos.
5. **Precisión numérica explícita siempre.** Para cada valor: tipo VB6 (`Integer` 16 bits,
   `Long` 32 bits, `Single`, `Double`, `Variant`), comportamiento en overflow, redondeo,
   clamping y saturación.
6. Un commit por documento cerrado. Mantené `spec/PROGRESO.md` al día.

### Trampas de VB6 a vigilar

- `And` / `Or` **no hacen cortocircuito**. Ambos lados se evalúan siempre. Si hay efectos
  colaterales, importa.
- `Option Base` y arrays 1-based. Ningún archivo de este proyecto declara `Option Base`
  (verificado en Fase 0), así que los arrays son 0-based, pero el código itera
  `For t = 1 To MaxRobs`. Comprobá si algún array usa el índice 0 con significado.
- División entera `\` vs `/`, y `Mod` con operandos negativos.
- Conversiones implícitas y redondeo bancario en `CInt`/`CLng`.
- Variables `Static` dentro de funciones y estado global compartido entre módulos: estado
  oculto que el port necesita replicar.

### Trampas específicas de este fuente, ya confirmadas

Estas salieron de la Fase 0. Dalas por ciertas y no las vuelvas a investigar; usalas.

- **El binario y el IDE divergen.** `Iersera.vbp` compila con `OverflowCheck=0`,
  `BoundsCheck=0`, `FlPointCheck=0`, `FDIVCheck=0`. En el EXE distribuido el overflow
  **envuelve en silencio** y los índices fuera de rango no dan error; en el IDE sí.
  **El corpus histórico evolucionó contra el EXE.** Escribí la spec describiendo el
  comportamiento del binario, y anotá donde el IDE difiera.
  Hay comprobaciones manuales de límites (`Shots.bas:1226 IsArrayBounded`,
  `Module1.bas IsRobDNABounded`): los autores sabían que el chequeo automático estaba apagado.
- **`DnaOps.bas` (962 LOC) es código muerto.** Ningún `.vbp` del repo lo compila. Contiene
  una implementación **antigua** de mutaciones (`DuplicateRandomGene`, `Mutchange`…),
  superseded por `NeoMutations.bas`. Especificar mutaciones desde ahí produciría la spec de
  un motor que no existe. Igual con `DoubleWord.cls` frente a `Bitwise.bas`.
  Otros muertos: `NodeSpeedThings.bas`, `unixtime.bas`, `OptionsRobotPlacement.bas`.
  `Main.bas` no está en el EXE, sólo en el proyecto de tests.
- **Los stacks no están en `DNA.bas`.** `PushIntStack`, `PopIntStack`, `ClearIntStack`,
  `DupIntStack` viven en `Module1.bas` (módulo `DNAManipulations`). Leelos antes que el
  intérprete o la semántica de los operadores no se entiende.
- **`gasdev` (`Common.bas:85`) guarda estado entre llamadas.** Box-Muller con caché del
  segundo valor en `Static iset` / `Static gset`. Sobrevive entre ciclos. Un port que no lo
  replique diverge aunque el RNG base sea idéntico.
- **`Master.bas` mezcla ecología y torneo.** Los modos `hidepred`, `x_restartmode` y ZeroBot
  son andamiaje de competición, no ecología base. Documentalos como capa separable.

### Tu tarea en esta sesión: Bloque A

Tres documentos, **secuenciales, a mano, sin subagentes**. Bloquean todo lo demás y no
admiten error. Paran y me reportás al cerrar cada uno.

**A1 · `spec/10-CICLO.md`** — el orden exacto de operaciones. El documento más importante.

Lectura: `Master.bas:23-555` completo → `DNA.bas:1245` (`ExecRobs`) →
`Robots.bas:1476` (`UpdateBots`) → `Shots.bas:288` (`updateshots`) →
`main.frm:2061` (bucle exterior).

Debe responder:
- **¿La iteración por bots es simultánea o secuencial?** ¿El bot `t` ve el estado ya
  actualizado del bot `t-1` dentro del mismo paso? El código itera `For t = 1 To MaxRobs`
  mutando `rob(t)` en el sitio. Si no hay doble búfer, **el índice del bot determina su
  ventaja competitiva** y eso condiciona toda la ecología. Es la pregunta más importante
  de todo el proceso.
- ¿`UpdateBots` es un bucle único que hace todo por bot, o varias pasadas por fase?
  De ello depende si el port puede paralelizar.
- Dónde nacen y dónde mueren exactamente los bots dentro del ciclo, y qué pasa con los
  índices liberados.
- Cuándo se limpian las sysvars, cuándo se resuelven física y colisiones, cuándo se aplican
  los shots.

Punto de partida ya verificado: el ADN se ejecuta (`Master.bas:332 ExecRobs`) **antes** de
borrar los sentidos (`Master.bas:340`) y **antes** de `updateshots` (`Master.bas:362`).
El propio código lo justifica en `Master.bas:339`. `Master.bas:530` declara un `Static`
dentro del procedimiento. `Master.bas:442-461` mata bots por presión de memoria eligiendo
los de menor `nrg + body*10`: presión selectiva artificial que forma parte del
comportamiento observable.

**A2 · `spec/20-VM.md`** — parser y ejecución del ADN.

Lectura: `Module1.bas` (stacks) → `DNA.bas:56-1244` (intérprete y operadores) →
`DNATokenizing.bas:1-861` y `:3169-3306` (tokenizar/destokenizar).

Cubrí: tokenización, `def`, `cond`/`start`/`else`/`stop`/`end`, flags de flujo, el stack
(tamaño, overflow, underflow), todos los operadores con aridad y semántica exacta, si
`store` es inmediato o diferido, y qué ocurre con genes malformados o truncados.

**A3 · `spec/21-MEMORIA.md`** — el mapa de memoria, junto con `spec/sysvars.yaml`
en la misma pasada.

Lectura: `DNATokenizing.bas:862-3169` (`LoadSysVars`, ~2 300 líneas) más los puntos donde
el motor escribe cada posición, repartidos por `Robots.bas`, `Senses.bas`, `Ties.bas`
y `Shots.bas`.

Para cada posición: número, nombre, lectura/escritura, rango válido, quién y cuándo la
escribe desde el motor, cuándo se limpia, qué pasa al escribir fuera de rango.

### Al cerrar cada documento

Releé el fuente citado y verificá que la spec dice exactamente lo que hace el código, no lo
que parecía hacer en la primera lectura. Después reportame tres cosas:

1. Qué quedó `[SIN VERIFICAR]`.
2. Qué `[PROBABLE BUG]` encontraste y qué bots podrían depender de él.
3. Qué decisiones de diseño del port quedan condicionadas por lo que descubriste.

Y parás. No arranques el documento siguiente sin que yo te lo diga.

**Empezá por A1.**

## ↑ COPIAR HASTA AQUÍ ↑
