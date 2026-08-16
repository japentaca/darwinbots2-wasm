# Prompt de arranque — Bloque B (B1..B8, subsistemas)

> Copiá el bloque de abajo como primer mensaje de una sesión nueva, en el directorio
> `C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`.
>
> **Por qué en sesión nueva:** higiene de contexto, como en A1-A3. Nada que no venga del
> fuente (wiki, foros, conocimiento previo) puede colarse como si fuera código. El Bloque A
> cerró y commiteó; `spec/PROGRESO.md` guarda el estado si la sesión se corta a mitad.
>
> El Bloque B es grande (~12 000 LOC en 8 grupos). No hace falta terminarlo en una sesión:
> se cierra documento a documento, un commit por documento, y la sesión siguiente retoma
> desde `PROGRESO.md` con este mismo prompt.

---

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de **DarwinBots 2.48.32 (Visual Basic 6)**.

Voy a reimplementar el simulador desde cero: core sin dependencias de motor, compilado a
WASM, render 2D en web. El objetivo es **compatibilidad de comportamiento** con el lenguaje
de ADN y con la ecología originales, para poder importar y correr el corpus histórico de bots.

Tu tarea **no es portar código**. Es producir una **especificación formal, verificable y
trazable**, extraída exclusivamente del fuente.

### Antes de nada

La Fase 0 y el **Bloque A completo** (A1, A2, A3) ya están hechos. Leé estos archivos
antes de tocar nada más, en este orden:

- `spec/PROGRESO.md` — estado actual: qué documentos de B están cerrados y cuál sigue
- `spec/00-INVENTARIO.md` — versión, flags de compilación, código muerto, mapa de módulos
- `spec/PLAN.md` — los 8 grupos del Bloque B y sus dependencias
- `spec/10-CICLO.md` — **A1.** El orden exacto del tick y las 7 pasadas de `UpdateBots`
- `spec/20-VM.md` + `spec/opcodes.yaml` — **A2.** La VM: intérprete, stacks, stores, direccionamiento
- `spec/21-MEMORIA.md` + `spec/sysvars.yaml` — **A3.** El mapa de memoria completo:
  quién escribe/borra cada celda, latencias, regímenes, memoria genética
- `spec/OPEN_QUESTIONS.md` — preguntas abiertas; varias se resuelven en tu bloque

El repo está bajo git. `02b20d7` es la línea base del fuente intacto.
A1 cerró en `e0b3604`; A2 en `df06228`; A3 en `b18d2cc`.

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
   `Darwinbots2/frmAbout1.frm` es documentación embebida de los autores: citable como
   *testimonio de intención*, nunca como spec de comportamiento.
4. **Los bugs son parte de la especificación.** Comportamiento raro se documenta como
   observado y se marca `[PROBABLE BUG]`. No lo corrijas ni asumas la intención.
5. **Precisión numérica explícita siempre.** Tipo VB6 de cada valor, overflow, redondeo
   (bancario en `CInt`/`CLng`), clamping, saturación. La spec describe el EXE distribuido
   (`OverflowCheck=0`, `BoundsCheck=0`: overflow envuelve, índices no fallan); donde el
   IDE difiera, se anota.
6. **Un commit por documento cerrado.** Mantené `spec/PROGRESO.md` y
   `spec/OPEN_QUESTIONS.md` al día en el mismo commit.
7. **Podés usar subagentes** (el plan lo prevé para B), con dos condiciones: el prompt de
   cada subagente debe incluir las reglas 1-5 y los avisos de código muerto de abajo; y
   **todo lo que un subagente afirme lo verificás contra el fuente antes de que entre en
   un documento** — los subagentes localizan y proponen, el documento lo cierra esta
   sesión releyendo las citas.

### Trampas de VB6 a vigilar

- `And` / `Or` **no hacen cortocircuito**: ambos lados se evalúan siempre.
- Arrays 0-based (no hay `Option Base`), pero el motor itera desde 1.
- División entera `\` vs `/`, y `Mod` con operandos negativos (signo del dividendo).
- Conversiones implícitas y **redondeo bancario** en `CInt`/`CLng`.
- Variables `Static` dentro de funciones y estado global compartido entre módulos.

### Trampas específicas de este fuente, ya confirmadas

Dalas por ciertas, no las vuelvas a investigar; pasalas a todo subagente.

- **Código muerto que parece central**: `DnaOps.bas` (962 LOC, mutaciones viejas — las
  vigentes están en `NeoMutations.bas`), `DoubleWord.cls`, `NodeSpeedThings.bas`,
  `unixtime.bas`, `OptionsRobotPlacement.bas`. Además `Darwinbots2/main` (sin extensión)
  es una **copia vieja de `main.frm`** que ningún `.vbp` compila, y `Main.bas` solo lo
  compila la suite de tests. Citarlos como comportamiento del motor invalida el documento.
- Hechos de A1 que enmarcan todo B (`10-CICLO.md`): iteración secuencial in situ por
  índice, sin doble búfer; `UpdateBots` son 7 pasadas completas, no un bucle único;
  sentidos con latencia de 1 ciclo; nacimientos antes que muertes; los shots nuevos no se
  mueven hasta el `updateshots` del ciclo siguiente.
- Hechos de A2 (`20-VM.md`): direcciones siempre normalizadas a 1..1000; escrituras del
  intérprete acotadas por `mod32000`; stores inmediatos; `else` tras `start` muerto.
- Hechos de A3 (`21-MEMORIA.md` + `sysvars.yaml`) — **no re-derives el mapa de memoria**:
  qué celda escribe/borra cada subsistema ya está registrado celda a celda con citas.
  Tu documento **enlaza** al yaml y profundiza en la mecánica del subsistema, no en el
  quién-escribe-qué. En particular ya están cerrados: `mem(0)` como sumidero de
  venom/poison (exclusión 340), Q15 (±32000 salvo Kills/fudge/I-O), `sysvarIN`/`sysvarOUT`
  como vocabulario de mutaciones, la memoria genética 971-990/epimem, `refvelsx`
  siempre 0, y los regímenes de borrado por celda.

### Tu tarea: el Bloque B, por grupos

Orden recomendado (dependencias en `PLAN.md`; **B5 al final**, es el más transversal).
Cada documento se cierra y commitea por separado. Si el contexto se agota, cerrá el
documento en curso, actualizá `PROGRESO.md` y parás.

| Grupo | Documento(s) | Fuente principal | Preguntas abiertas a atacar |
|---|---|---|---|
| **B1 Física** | `30-FISICA.md` | `Physics.bas`, `Quads.bas` (buckets/colisión), `Robots.bas:826` (`UpdatePosition`), `CalcMass`/`AddedMass` | Q07 (acumuladores `Single`/x87) |
| **B2 Percepción** | `32-VISION.md` | `Senses.bas`, `Quads.bas:350-950` (`CompareRobots3`, `CompareShapes`, `eyestrength`, `EyeSightDistance`, `NarrowestEye`) | resto de Q08 |
| **B3 Combate** | `33-SHOTS.md`, `35-VIRUS.md` | `Shots.bas` completo (los virus viven ahí: `Vshoot`, `MakeVirus`, `copygene`, `addgene`) | Q03 (índice 0 de `Shots()`); ojo: `.shoot` con múltiplo de 1000 acaba en shottype 0 → `newshot` lo convierte en **−8 (esperma)** (`Shots.bas:120-121`) — verificar y especificar |
| **B4 Conexiones** | `34-TIES.md` | `Ties.bas`, `Multibots.bas`, `Physics.bas` (`TieHooke`, `TieTorque`) | Q03 (índices de `Ties()`); los flags `TieAngOverwrite`/`TieLenOverwrite` y el centinela `fixang=32000` ya están en A2/A3 |
| **B6 Herencia** | `36-REPRO.md`, `40-MUTACIONES.md` | `Robots.bas` (`Reproduce`, `SexReproduce`, crossover `:378-770`), `NeoMutations.bas` (¡no `DnaOps.bas`!) | Q13 (desborde de `rep()`), Q16 (`dnamatrix` 76 vs 77); recordá: las mutaciones normales **no** refrescan `makeoccurrlist` |
| **B7 Mundo** | `50-MUNDO.md` | `Vegs.bas`, `Obstacles.bas`, `Teleport.bas`, `SimOptions.bas`, `Evo.bas`/`F1Mode.bas` (capa ⚙ separable) | Q10 (teleporters), resto de Q01 (`MoveObstacles`), Q05 (`NodeSpeedThings.bas`) |
| **B8 Formatos** | `60-FORMATOS.md` | `HDRoutines.bas`, `DNATokenizing.bas` (`SaveRobHeader`, `Hash`, destok), `Module1.bas` (`RobScriptLoad`) | Q06 (`Main.bas`), Q09, resto de Q14 (`MaxAbsNum` persistido), la re-exportación epigenética (`HDRoutines.bas:2274-2282`), saves con `mem()` crudo |
| **B5 Metabolismo** | `31-ENERGIA.md` + `spec/constants.yaml` | `Robots.bas` (`Upkeep`, `ManageBody`, `HandleWaste`, `ManageChlr`, `Shock`), `Vegs.bas`, `CostsForm.frm`, valores por defecto de `Costs()` | cierra `constants.yaml`, que se alimenta desde todos los grupos anteriores |

`spec/constants.yaml` se va alimentando durante todo el bloque (cada grupo aporta sus
constantes con cita) y se cierra con B5.

### Al cerrar cada documento

Releé el fuente citado y verificá que la spec dice exactamente lo que hace el código, no
lo que parecía hacer en la primera lectura. Después reportame, por documento:

1. Qué quedó `[SIN VERIFICAR]`.
2. Qué `[PROBABLE BUG]` encontraste y qué bots podrían depender de él.
3. Qué decisiones de diseño del port quedan condicionadas.

Cuando el Bloque B entero esté cerrado, parás. **No arranques el Bloque C
(`70-CASOS-DORADOS.md`, cierre de `constants.yaml`) sin que yo te lo diga.**

## ↑ COPIAR HASTA AQUÍ ↑
