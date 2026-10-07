# Prompt de arranque — A3 · `21-MEMORIA.md` (cierre del Bloque A)

> Copiá el bloque de abajo como primer mensaje de una sesión nueva, en el directorio
> `C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`.
>
> **Por qué en sesión nueva:** higiene de contexto. Cada documento del Bloque A arranca
> limpio para que nada que no venga del fuente (wiki, foros, conocimiento previo) pueda
> colarse como si fuera código. Las sesiones de A1 y A2 ya cerraron y commitearon.

---

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de **DarwinBots 2.48.32 (Visual Basic 6)**.

Voy a reimplementar el simulador desde cero: core sin dependencias de motor, compilado a
WASM, render 2D en web. El objetivo es **compatibilidad de comportamiento** con el lenguaje
de ADN y con la ecología originales, para poder importar y correr el corpus histórico de bots.

Tu tarea **no es portar código**. Es producir una **especificación formal, verificable y
trazable**, extraída exclusivamente del fuente.

### Antes de nada

La Fase 0 y los documentos A1 y A2 ya están hechos. Leé estos archivos antes de tocar
nada más, en este orden:

- `spec/PROGRESO.md` — estado actual y punto de entrada exacto para A3
- `spec/00-INVENTARIO.md` — versión, flags de compilación, código muerto, mapa de módulos
- `spec/10-CICLO.md` — **A1, cerrado.** El orden del tick: quién escribe y borra sentidos
  y cuándo (su §7 es tu esqueleto de partida)
- `spec/20-VM.md` — **A2, cerrado.** La VM: cómo lee y escribe `mem()` el intérprete,
  direccionamiento, `mod32000`, los stores
- `spec/opcodes.yaml` — registro por operador, salido de A2
- `spec/OPEN_QUESTIONS.md` — preguntas abiertas (Q01-Q17)
- `spec/PLAN.md` — el plan general, por si necesitás contexto de los bloques

El repo está bajo git. El commit `02b20d7` es la línea base del fuente intacto.
A1 cerró en `e0b3604`; A2 cerró en `df06228`.

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
  `DoubleWord.cls`, `NodeSpeedThings.bas`, `unixtime.bas`, `OptionsRobotPlacement.bas`.
- Hechos de A1 que enmarcan a A3 (`spec/10-CICLO.md §2, §7`):
  - El ADN del ciclo N lee sentidos escritos en N−1. `EraseSenses` corre justo después
    del ADN (paso 12 del tick); `updateshots` y `UpdateBots` reescriben después.
  - `10-CICLO.md §7` ya tiene la tabla gruesa de quién borra qué y cuándo — tu documento
    la refina posición a posición, no la re-derives desde cero.
  - Los ojos no los borra `EraseSenses`: los borra y reescribe `BucketsProximity` en cada
    barrido (`Quads.bas:183-186`); corpses y `CantSee` conservan ojos rancios.
- Hechos de A2 que enmarcan a A3 (`spec/20-VM.md`):
  - **Toda dirección efectiva desde ADN se normaliza a `1..1000`** (`Abs Mod 1000`,
    `0 → 1000`). `mem(0)` existe (`mem(1000) As Integer`, `Robots.bas:265`) pero es
    **inalcanzable desde el ADN**. Si el motor lo usa, es por otra vía.
  - Las escrituras del intérprete pasan por `mod32000` (±32000), salvo
    `divstore`/`rndstore`/`sgnstore`/`absstore`/`sqrstore`/`negstore` (acotadas igual).
    **Si el motor escribe en `mem()` valores fuera de ±32000 es tu Q15** — resolvela.
  - Ya especificadas en A2, no las repitas: `mem(336)`=DnaLen y `mem(339)`=genenum al
    cargar (`Module1.bas:18-19`), `mem(341)`=`thisgene` en cada token de flujo
    (`DNA.bas:167`), y los flags `TieAngOverwrite`/`TieLenOverwrite` de 480-487.
  - `sysvar(1000) As var` es la tabla que carga `LoadSysVars`; `sysvarIN(255)` y
    `sysvarOUT(255)` también se cargan ahí pero **el intérprete no los usa** — averiguá
    quién sí (sospecha: mutaciones/display), es parte de tu tarea.
  - La resolución de nombres (case-insensitive para sysvars, shadowing por variables
    privadas) ya está en `20-VM.md §8` — no la re-derives.

### Tu tarea en esta sesión: A3 · `spec/21-MEMORIA.md` + `spec/sysvars.yaml` — el mapa de memoria

Secuencial, a mano, sin subagentes. Es la pasada más mecánica del Bloque A: 2300 líneas
de tabla más la caza de escritores. Producí **los dos artefactos en la misma pasada**:
sería absurdo recorrer `LoadSysVars` dos veces.

Lectura:

1. `DNATokenizing.bas:862-3169` — `LoadSysVars` completo: las tres tablas (`sysvar`,
   `sysvarIN`, `sysvarOUT`), nombre a nombre, dirección a dirección. Anotá huecos,
   duplicados, entradas comentadas y colisiones (dos nombres → misma dirección, o un
   nombre → dirección distinta según tabla).
2. Los puntos donde el **motor** lee/escribe/borra cada posición, repartidos por
   `Robots.bas`, `Senses.bas`, `Ties.bas`, `Shots.bas`, `Physics.bas`, `Master.bas`
   (griposo pero acotado: buscá `\.mem(` y clasificá). Cruzalo con `10-CICLO.md §7`.
3. `Robots.bas:1-120` — el bloque de constantes `Public Const ... As Integer = <dir>`
   (ahí viven `DnaLenSys`, `GenesSys`, `thisgene`, `trefnrg`…): es el índice simbólico
   que usa el motor y tu segunda fuente de verdad para el mapa.

`spec/sysvars.yaml`: un registro por posición de memoria usada, con: dirección, nombre(s),
dirección simbólica en el motor (const de `Robots.bas` si existe), sentido (entrada del
bot / salida del bot / bidireccional / interna), quién escribe y en qué paso del ciclo,
quién borra y cuándo, rango de valores observado en el código, y cita por cada afirmación.

`spec/21-MEMORIA.md` debe responder, como mínimo:

- El mapa completo 1..1000: qué rangos están definidos, cuáles son huecos sin nombre
  (pero direccionables y persistentes: ¿memoria libre del bot?), y si algún hueco lo
  usa el motor sin nombre simbólico.
- Por posición con semántica: latencia exacta (¿el valor que lee el ADN es de este ciclo
  o del anterior?), política de borrado (por ciclo / al consumir / nunca), y qué pasa si
  el bot la escribe (¿el motor la pisa? ¿la respeta? ¿la interpreta como orden?).
- Q15: ¿alguna escritura del motor deja valores fuera de ±32000 en `mem()`?
  (habilitaría los edges de `absstore`/`negstore` de `20-VM.md §7`).
- Q14 (parte A3): `GiveAbsNum`/`AbsNum` y su publicación en memoria, si la hay.
- Los refvars y el `makeoccurrlist`/`occurr` que A2 dejó señalados (`Module1.bas:15`):
  qué son, dónde viven, cuándo se reescriben.
- Memoria genética (`DoGeneticMemory`, `10-CICLO.md §5 P3`): qué posiciones toca.
- Si `mem(0)` recibe alguna escritura del motor por índice calculado (cierra Q03 para
  `mem`).

### Al cerrar el documento

Releé el fuente citado y verificá que la spec dice exactamente lo que hace el código, no
lo que parecía hacer en la primera lectura. Después reportame tres cosas:

1. Qué quedó `[SIN VERIFICAR]`.
2. Qué `[PROBABLE BUG]` encontraste y qué bots podrían depender de él.
3. Qué decisiones de diseño del port quedan condicionadas por lo que descubriste.

Y parás. **El Bloque A queda cerrado; no arranques el Bloque B sin que yo te lo diga.**

## ↑ COPIAR HASTA AQUÍ ↑
