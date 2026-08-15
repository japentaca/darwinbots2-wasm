# Prompt de arranque — A2 · `20-VM.md` (continuación del Bloque A)

> Copiá el bloque de abajo como primer mensaje de una sesión nueva, en el directorio
> `C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`.
>
> **Por qué en sesión nueva:** higiene de contexto. Cada documento del Bloque A arranca
> limpio para que nada que no venga del fuente (wiki, foros, conocimiento previo) pueda
> colarse como si fuera código. La sesión de A1 ya cerró y commiteó su documento.

---

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de **DarwinBots 2.48.32 (Visual Basic 6)**.

Voy a reimplementar el simulador desde cero: core sin dependencias de motor, compilado a
WASM, render 2D en web. El objetivo es **compatibilidad de comportamiento** con el lenguaje
de ADN y con la ecología originales, para poder importar y correr el corpus histórico de bots.

Tu tarea **no es portar código**. Es producir una **especificación formal, verificable y
trazable**, extraída exclusivamente del fuente.

### Antes de nada

La Fase 0 (reconocimiento) y el documento A1 ya están hechos. Leé estos archivos antes de
tocar nada más, en este orden:

- `spec/PROGRESO.md` — estado actual y punto de entrada exacto para A2
- `spec/00-INVENTARIO.md` — versión, flags de compilación, código muerto, mapa de módulos
- `spec/10-CICLO.md` — **A1, cerrado.** El orden del tick. Define el contrato que rodea
  al intérprete: cuándo se ejecuta el ADN, qué lee y qué escribe
- `spec/OPEN_QUESTIONS.md` — preguntas abiertas (Q01-Q14)
- `spec/PLAN.md` — el plan general, por si necesitás contexto de los bloques

El repo está bajo git. El commit `02b20d7` es la línea base del fuente intacto.
A1 se cerró en el commit `e0b3604`.

### Reglas duras

1. **Los fuentes son read-only.** No modificar, no refactorizar, no "arreglar" nada.
   Todo output va a `spec/`. Verificable en cualquier momento con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. **Toda afirmación cita `archivo:línea`.** Sin cita, no entra en el documento.
3. **El fuente es la spec. Todo lo demás es rumor** — el wiki de Darwinbots, los foros,
   la documentación suelta, y tu propio conocimiento previo de Darwinbots. Si algo no se
   deriva del fuente, marcalo `[SIN VERIFICAR]` y anotalo en `spec/OPEN_QUESTIONS.md`.
   **Nunca rellenes huecos con lo que "tendría sentido".**
   **No consultes el wiki de Darwinbots en esta sesión bajo ningún concepto.**
   Ojo: `Darwinbots2/frmAbout1.frm` ("Help for DNA commands") es documentación embebida
   escrita por los autores — podés citarla como *testimonio de intención*, nunca como
   spec de comportamiento; el comportamiento sale solo del código ejecutable.
4. **Los bugs son parte de la especificación.** Comportamiento raro se documenta como
   observado y se marca `[PROBABLE BUG]`. No lo corrijas ni asumas la intención: la
   comunidad evolucionó bots que explotan esos comportamientos.
5. **Precisión numérica explícita siempre.** Para cada valor: tipo VB6 (`Integer` 16 bits,
   `Long` 32 bits, `Single`, `Double`, `Variant`), comportamiento en overflow, redondeo,
   clamping y saturación. En el EXE distribuido (`OverflowCheck=0`, `BoundsCheck=0`) el
   overflow **envuelve en silencio** y los índices fuera de rango no fallan; en el IDE sí.
   La spec describe el binario y anota donde el IDE difiera.
6. Un commit por documento cerrado. Mantené `spec/PROGRESO.md` al día.

### Trampas de VB6 a vigilar

- `And` / `Or` **no hacen cortocircuito**: ambos lados se evalúan siempre.
- Arrays 0-based (no hay `Option Base` en ningún archivo), pero el motor itera desde 1.
- División entera `\` vs `/`, y `Mod` con operandos negativos.
- Conversiones implícitas y **redondeo bancario** en `CInt`/`CLng`.
- Variables `Static` dentro de funciones y estado global compartido entre módulos.

### Trampas específicas de este fuente, ya confirmadas

Dalas por ciertas, no las vuelvas a investigar; usalas.

- **`DnaOps.bas` (962 LOC) es código muerto.** Ningún `.vbp` lo compila. Igual que
  `DoubleWord.cls` (usar `Bitwise.bas`), `NodeSpeedThings.bas`, `unixtime.bas`,
  `OptionsRobotPlacement.bas`. `Main.bas` solo está en el proyecto de tests.
- **Los stacks no están en `DNA.bas`.** `PushIntStack`, `PopIntStack`, `ClearIntStack`,
  `DupIntStack` viven en `Module1.bas` (módulo `DNAManipulations`), junto con
  `IsRobDNABounded` (chequeo manual de límites: los autores sabían que `BoundsCheck=0`).
  Leelos **antes** que el intérprete.
- Hechos de A1 que enmarcan a A2 (citados en `spec/10-CICLO.md §3`):
  - El intérprete **solo toca `rob(currbot)`** — ningún acceso a otros bots (verificado
    por enumeración exhaustiva de las expresiones `rob(...)` de `DNA.bas`).
  - Los stacks se limpian **al entrar por bot** (`DNA.bas:68-69`); `CurrentFlow` se
    resetea al salir (`DNA.bas:174`). No hay herencia entre bots.
  - Cada token ejecutado **cobra energía en el momento** (`DNA.bas:93`, `:108`).
  - Los `store` son **inmediatos** sobre `mem` (`DNA.bas:149-153`) — confirmá la semántica
    exacta en `ExecuteStores`, es una de tus preguntas.
  - El intérprete **consume RNG** (`DNA.bas:277`, `:1098`) del flujo global.
  - Tope de ejecución: `a <= 32000 And a < UBound(.dna)` (`DNA.bas:87`).
  - El ADN del ciclo N lee sentidos escritos en N−1; sus acciones (`mem(shoot)`, `dir*`…)
    las consume `UpdateBots` en el mismo ciclo N. No lo re-derives: está en `10-CICLO.md §2`.

### Tu tarea en esta sesión: A2 · `spec/20-VM.md` — parser y ejecución del ADN

Secuencial, a mano, sin subagentes. Lectura en este orden:

1. `Module1.bas` — los stacks (tamaño, overflow, underflow, `DupIntStack`), y de paso
   `RobScriptLoad`, `insertsysvars`, `interpretUSE`, `IsRobDNABounded`.
2. `DNA.bas:56-1244` — `ExecuteDNA` y **todos** los operadores: básicos, avanzados,
   bitwise, condiciones, lógicos, stores, flujo. Aridad y semántica exacta de cada uno.
3. `DNATokenizing.bas:1-861` y `:3169-3306` — tokenizar y destokenizar.
   (El tramo `:862-3169` es `LoadSysVars`: **no lo especifiques ahora**, es A3.)

Debe responder, como mínimo:

- Tokenización: gramática aceptada, qué se ignora, qué produce token inválido, y qué
  hace el cargador con genes malformados o truncados (¿rechaza el bot? ¿carga a medias?).
- Estructura de gen: `cond`/`start`/`else`/`stop`/`end`, los flags de flujo
  (`CurrentFlow`, `CurrentCondFlag`, `NEXTBODY`…) y el "new execution paradigm" de
  condiciones ejecutables en cualquier punto del gen (`DNA.bas:126-133`).
- `def` y sysvars de usuario (`insertsysvars`, `usedvars`): resolución de nombres a
  direcciones, colisiones, límites.
- El stack de enteros y el de booleanos: tamaño exacto, qué pasa en overflow y en
  underflow (¿satura, envuelve, ignora?), semántica de `DupIntStack`.
- Cada operador: aridad, tipos, comportamiento con el stack vacío, overflow aritmético
  (recordá: el EXE envuelve), casos borde (`Mod` negativo, división por cero…).
- `store`/`inc`/`dec`: si el efecto es inmediato o diferido, direccionamiento fuera de
  rango (`DNA.bas:99-105` normaliza con `Mod MaxMem` — confirmá el caso store), y la
  condición `CondStateIsTrue` (`DNA.bas:150`).
- Producí también `spec/opcodes.yaml` en la misma pasada: un registro por operador con
  token, tipo, aridad, semántica y cita.

### Al cerrar el documento

Releé el fuente citado y verificá que la spec dice exactamente lo que hace el código, no
lo que parecía hacer en la primera lectura. Después reportame tres cosas:

1. Qué quedó `[SIN VERIFICAR]`.
2. Qué `[PROBABLE BUG]` encontraste y qué bots podrían depender de él.
3. Qué decisiones de diseño del port quedan condicionadas por lo que descubriste.

Y parás. **No arranques A3 (`21-MEMORIA.md`) sin que yo te lo diga.**

## ↑ COPIAR HASTA AQUÍ ↑
