# Prompt de arranque — Bloque C · `70-CASOS-DORADOS.md` (cierre de la especificación)

> Copiá el bloque de abajo como primer mensaje de una sesión nueva, en el directorio
> `C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`.
>
> **Por qué en sesión nueva:** higiene de contexto, como en A y B. Los casos dorados son
> la última línea de defensa contra la contaminación: si un valor esperado saliera del
> wiki o de la memoria en vez del fuente, envenenaría los tests del port para siempre.

---

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de **DarwinBots 2.48.32 (Visual Basic 6)**.

El proyecto: reimplementar el simulador desde cero — **core en C++ compilado a WASM vía
Emscripten, render 2D en web** (decisión fijada en `spec/PLAN.md`, con sus salvaguardas
de build). El objetivo es compatibilidad de comportamiento con el lenguaje de ADN y la
ecología originales, para importar y correr el corpus histórico de bots.

La especificación está **completa**: Fase 0, Bloque A (ciclo, VM, memoria) y Bloque B
(física, visión, shots, virus, ties, reproducción, mutaciones, mundo, formatos, energía)
están cerrados y commiteados. Tu tarea es el **Bloque C**: producir
`spec/70-CASOS-DORADOS.md` — los casos de test con resultado esperado que anclarán el
port. No es portar código ni escribir C++ todavía: es destilar la spec en aserciones
ejecutables.

### Antes de nada

Leé en este orden:

- `spec/PROGRESO.md` — estado y punto de entrada. **Incluye la corrección de premisa
  del 2026-08-16** (el EXE compila CON chequeos; flags `=0` = casillas sin marcar):
  leela antes que nada, invalida cualquier intuición de "wrap silencioso".
- `spec/PLAN.md` — la decisión de arquitectura C++/WASM y sus 5 salvaguardas de build
  (la salvaguarda 5 define la prioridad de este documento)
- `spec/OPEN_QUESTIONS.md` — **las 17 preguntas están cerradas**; ninguna bloquea.
  Contexto que te afecta: ni el EXE ni el IDE de VB6 corren en esta máquina (Q09),
  así que no hay validación empírica posible — las preguntas de runtime se cerraron
  con fuentes secundarias marcadas (Q02: el LCG de VB6, con algoritmo completo;
  Q07/Q08/Q13/Q17: análisis y decisiones de port).
- `spec/10-CICLO.md §14` — la semántica de truncamiento de tick (errores 6/9/11)
- El resto de `spec/` como material de referencia: `10-CICLO.md`, `20-VM.md` +
  `opcodes.yaml`, `21-MEMORIA.md` + `sysvars.yaml`, `30-FISICA.md`, `31-ENERGIA.md` +
  `constants.yaml`, `32-VISION.md`, `33-SHOTS.md`, `34-TIES.md`, `35-VIRUS.md`,
  `36-REPRO.md`, `40-MUTACIONES.md`, `50-MUNDO.md`, `60-FORMATOS.md`

El repo está bajo git. `02b20d7` es la línea base del fuente intacto. El Bloque A cerró
en `b18d2cc`; el B en `a1d419c`; la decisión de arquitectura en `8cf9864`; la corrección
de premisa (chequeos activos) y el cierre de todas las preguntas abiertas en `6e3d22c`.

### Reglas duras

1. **Los fuentes son read-only.** Todo output va a `spec/`. Verificable con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. **Todo valor esperado de un caso dorado debe ser derivable del fuente por
   computación manual verificable, con cita `archivo:línea` de cada regla aplicada.**
   Si un valor esperado no puede derivarse sin ejecutar el binario, el caso se marca
   `[PENDIENTE DE BINARIO]` y se registra qué observación lo cerraría (alimenta Q09).
3. **El fuente es la spec; los documentos de `spec/` son su índice.** Si al derivar un
   caso encontrás una contradicción entre un documento y el código, **gana el código**:
   corregí el documento en el mismo commit y anotalo. No consultes el wiki de
   Darwinbots bajo ningún concepto. (La excepción de fuentes secundarias del
   2026-08-16 aplicaba solo a preguntas de *runtime* ya cerradas — para valores
   esperados de casos dorados no hay excepción: fuente o nada.)
4. **Los `[PROBABLE BUG]` se testean como comportamiento correcto.** Un caso dorado del
   `else` muerto espera que el else NO ejecute; uno de `refvelsx` espera 0. Los ~35
   catalogados en los documentos son la lista de casos de más valor: son exactamente
   donde un port ingenuo divergiría.
5. **Precisión numérica explícita**: cada valor esperado con su tipo VB6 de origen, y
   cada paso de redondeo/wrap/clamp citado. **Corrección 2026-08-16**: el EXE compila
   **con** chequeos (`00-INVENTARIO.md §1`) — EXE ≈ IDE; los wraps de la spec son solo
   los explícitos del fuente, y los sitios de error 6/9/11 truncan el tick
   (`10-CICLO.md §14`), con decisión de port propia por sitio.
6. Un commit al cerrar (o por entregas parciales coherentes si el documento crece).
   Mantené `PROGRESO.md` y `OPEN_QUESTIONS.md` al día.

### Avisos ya confirmados (no re-investigar)

- Código muerto: `DnaOps.bas`, `DoubleWord.cls`, `NodeSpeedThings.bas`, `unixtime.bas`,
  `OptionsRobotPlacement.bas`, `Darwinbots2/main` (copia vieja de `main.frm`).
  `Main.bas` es plomería Win32 del runner de tests, sin `Sub Main` (Q06).
- El RNG de VB6 (Q02) no está en el fuente pero **está resuelto** con fuente externa
  (Microsoft, `OPEN_QUESTIONS.md` Q02): LCG de 24 bits, semilla de proceso `&H50000`,
  `seed = (seed·&H43FD43FD + &HC39EC3) And &HFFFFFF`, retorno `seed/2²⁴`, más la
  semántica exacta de `Randomize`. El propio LCG merece sus casos dorados (marcados
  `[FUENTE EXTERNA: MS]`). Aun así, los casos de *subsistemas* que consuman
  aleatoriedad se escriben **parametrizados por una secuencia de RNG inyectada** —
  así el test no acopla el subsistema al generador.
- Errores runtime (corrección 2026-08-16): un literal fuera de ±32767 o un `def`
  1001+ hacen que el archivo de bot **no cargue** (`20-VM.md §2.4, §8.1`); un bot
  solo-defs es una "bomba de tick" (`§2.3`). Son casos dorados de carga, no de VM.

### Tu tarea: `spec/70-CASOS-DORADOS.md`

**Paso 1 — Minar la suite de los autores.** Revisá `UnitTests/DarwinBots2UnitTests.vbp`
y sus módulos: es SimplyVBUnit enlazando el motor entero (`00-INVENTARIO.md §8`). Todo
test con aserción concreta es un caso dorado regalado — extraelo con cita, y evaluá si
el valor esperado del test coincide con lo que la spec predice (si no coincide, es un
hallazgo de primer orden: o la spec está mal, o el test de los autores ya fallaba).

**Paso 2 — Derivar los casos propios**, por prioridad (la salvaguarda 5 de `PLAN.md`
manda):

1. **Numérica base**: wrap de 16 bits, redondeo bancario (`CInt`/`div`/stores),
   `mod32000`, saturaciones de `add`/`mult`/`pow`, los edges bitwise (`++` en 2³¹−1 → 0),
   underflow de stacks (0 / centinela −5). Fuente: `opcodes.yaml` + `20-VM.md §6-7`.
2. **VM y flujo**: `else` muerto tras `start`, condiciones inline gobernando stores,
   numeración de genes, el desplazamiento de `def`s, tokenización de basura → 0.
3. **Memoria y ciclo**: latencia de 1 ciclo de cada clase de sentido, consumo de
   comandos por pasada, `mem(0)` como sumidero, regímenes de borrado (tabla de
   `sysvars.yaml`), memoria genética 971-990 con su entrega diferida.
4. **Los ~35 `[PROBABLE BUG]`** como aserciones (regla 4).
5. **Física determinista**: fórmulas cerradas sin RNG — `CalcMass`, `FindRadius`,
   `iceil`, clamps de `UpdatePosition`, muelle de tie con zona muerta, `Repel3` con
   masas dadas, `EyeSightDistance`/`AbsoluteEyeWidth`/eyevalue.
6. **Secuencias con RNG inyectado**: mutaciones (un `ChangeDNA` con secuencia fija),
   crossover, disparos (jitter), repoblación — el caso fija la secuencia de entrada y
   deriva el resultado.
7. **Formatos ida-y-vuelta**: registro binario de bot mínimo, centinela 254×3,
   `sint` Mod 32000, el gen epigenético autodestructivo, hash de texto.

**Formato de cada caso**: identificador, subsistema, estado inicial mínimo, pasos,
resultado esperado con derivación citada línea a línea, y clasificación
(`unit` / `ciclo` / `integración`). Agnóstico de lenguaje pero pensado para traducirse
1:1 a tests de C++ (GoogleTest o similar — la elección del harness es del arranque del
código, no de este documento).

### Al cerrar

Releé cada derivación contra el fuente citado. Reportame:

1. Qué casos quedaron `[PENDIENTE DE BINARIO]` y qué observación única los cerraría.
2. Qué regaló (o contradijo) la suite de los autores.
3. Si alguna derivación te obligó a corregir un documento de la spec.

Y parás. **Con el Bloque C cerrado, la especificación está completa; el arranque del
código C++ es un proyecto nuevo y no lo empezás sin que yo te lo diga.**

## ↑ COPIAR HASTA AQUÍ ↑
