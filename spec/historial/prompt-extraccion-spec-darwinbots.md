# Extracción de especificación formal — Darwinbots (VB6 → spec)

## Contexto

Estás parado en el repositorio del código fuente original de Darwinbots 2 (Visual Basic 6).

Voy a reimplementar el simulador desde cero: core sin dependencias de motor, compilado a WASM, con render 2D en web. El objetivo es mantener **compatibilidad de comportamiento** con el lenguaje de ADN y con la ecología originales, para poder importar y correr el corpus histórico de bots.

Tu tarea en esta sesión **no es portar código**. Es producir una **especificación formal, verificable y trazable**, extraída exclusivamente del fuente. El fuente es la spec; todo lo demás (wiki, documentación, foros, tu conocimiento previo de Darwinbots) es rumor.

---

## Reglas duras

1. **Los fuentes son read-only.** No modificar, no refactorizar, no "arreglar" nada. Todo output va a `spec/`.
2. **Toda afirmación cita `archivo:línea`.** Sin cita, no entra en el documento.
3. Si algo no se puede derivar del fuente, marcalo `[SIN VERIFICAR]` y anotalo en `spec/OPEN_QUESTIONS.md`. **Nunca completes huecos con el wiki, con conocimiento general de Darwinbots, ni con lo que "tendría sentido".** Un hueco documentado vale más que una suposición plausible: la suposición se propaga silenciosamente al port y aparece seis meses después como un bot que no sobrevive.
4. **Los bugs son parte de la especificación.** Si el código hace algo raro (overflow, off-by-one, orden contraintuitivo), documentalo como comportamiento observado y marcalo `[PROBABLE BUG]`. No lo corrijas ni asumas cuál era la intención: la comunidad evolucionó bots que explotan esos comportamientos.
5. **Precisión numérica explícita siempre.** Para cada valor: tipo VB6 (`Integer` 16 bits, `Long` 32 bits, `Single`, `Double`, `Variant`), comportamiento en overflow, redondeo, clamping y saturación.

---

## Trampas de VB6 a vigilar (documentalas cuando aparezcan)

- `And` / `Or` **no hacen cortocircuito** en VB6. Ambos lados se evalúan siempre. Si hay efectos colaterales, importa.
- `Option Base` y arrays 1-based. Cualquier índice mal trasladado rompe el mapa de memoria.
- División entera `\` vs `/`, y `Mod` con operandos negativos.
- `Rnd` es un LCG específico de VB6, y `Randomize` tiene semántica propia. Identificá el algoritmo exacto y todos los puntos donde se consume aleatoriedad, **en orden**. Esto define si los replays son reproducibles.
- Conversiones implícitas y redondeo bancario en `CInt`/`CLng`.
- Overflow de `Integer` (¿lanza error, se atrapa, se satura?).
- Variables `Static` dentro de funciones y estado global compartido entre módulos: estado oculto que el port necesita replicar.

---

## Fase 0 — Reconocimiento (hacé esto primero y **pará**)

Antes de escribir una línea de spec:

- Inventario completo de `.bas`, `.frm`, `.cls`, `.vbp`: cantidad de líneas y una frase de qué hace cada uno.
- Versión, fecha, y si hay ramas, variantes, código muerto o features a medio implementar.
- Localizá el **loop principal de simulación** y el **intérprete de ADN**.
- Proponé un orden de lectura por subsistema y un plan de trabajo.

Escribilo en `spec/00-INVENTARIO.md` y `spec/PLAN.md`, y **mostrame el plan antes de continuar.**

---

## Fase 1 — Documentos por subsistema

Prioridad estricta: los tres primeros bloquean todo lo demás.

- **`spec/10-CICLO.md`** — el documento más importante. El orden exacto de operaciones dentro de un ciclo: orden de iteración de bots, si las actualizaciones son simultáneas o secuenciales (¿un bot ve el estado ya actualizado del anterior?), en qué momento se ejecuta el ADN, cuándo se resuelven colisiones y física, cuándo se aplican los shots, cuándo mueren los bots, cuándo nacen, cuándo se limpian las sysvars.
- **`spec/20-VM.md`** — parser y ejecución del ADN: tokenización, `def`, `cond` / `start` / `else` / `stop` / `end`, flags de flujo, el stack (tamaño, qué pasa en overflow y underflow), todos los operadores con aridad y semántica exacta, si `store` es inmediato o diferido al final del ciclo, y qué ocurre con genes malformados o truncados.
- **`spec/21-MEMORIA.md`** — mapa exhaustivo de las ~1000 posiciones: número, nombre, lectura/escritura, rango válido, quién y cuándo la escribe desde el motor, cuándo se limpia, qué pasa al escribir fuera de rango.
- `spec/30-FISICA.md` — movimiento, masa y radio, colisiones, fricción, bordes del mundo, ties como restricciones físicas.
- `spec/31-ENERGIA.md` — economía completa: `nrg` vs `body`, costo de cada acción, metabolismo basal, conversiones, condiciones de muerte, waste.
- `spec/32-VISION.md` — geometría de los 9 segmentos: ángulos, alcance, cómo se calcula el valor de cada ojo, qué refvars se llenan y con qué criterio de prioridad si hay varios objetivos en el campo.
- `spec/33-SHOTS.md` — tipos de disparo, valores, propagación, alcance, decaimiento, efecto al impactar.
- `spec/34-TIES.md` — creación, tipos, transferencia de energía e información, ruptura, multibots.
- `spec/35-VIRUS.md` — creación, infección, inserción de genes en el huésped, defensas.
- `spec/36-REPRO.md` — reproducción sexual y asexual, reparto de energía y body, herencia del genoma.
- `spec/40-MUTACIONES.md` — cada operador (puntual, inserción, deleción, duplicación, translocación, lo que haya), sus probabilidades, cómo se eligen los puntos de corte y cómo se preserva o rompe la estructura de genes.
- `spec/50-MUNDO.md` — veggies, spawn, ciclo día/noche, temperatura, corrientes, y todos los parámetros configurables de simulación.
- `spec/60-FORMATOS.md` — formato de los `.txt` de ADN, de los `.sim`, y cualquier otra persistencia. Con gramática formal y ejemplos reales tomados del repo.

---

## Fase 2 — Artefactos accionables

- **`spec/constants.yaml`** — *todas* las constantes numéricas del motor, machine-readable: nombre, valor, unidad, cita y dónde se usa. Es la base para que el port sea parametrizable en vez de hardcodeado.
- **`spec/sysvars.yaml`** — el mapa de memoria en formato machine-readable.
- **`spec/opcodes.yaml`** — tabla de operadores del ADN: símbolo, aridad, efecto sobre el stack, casos borde.
- **`spec/70-CASOS-DORADOS.md`** — 20 a 30 casos de test derivados del fuente: entrada (bot mínimo + estado inicial) → salida esperada tras N ciclos, con el razonamiento y las citas que lo justifican. Esta es la suite de aceptación del port.

---

## Método de trabajo

- Un subsistema a la vez, un commit por documento.
- Mantené `spec/PROGRESO.md` al día (qué está hecho, qué falta, dónde quedaste) para sobrevivir reinicios de contexto.
- Usá subagentes en paralelo para subsistemas independientes. **El ciclo y la VM hacelos vos, secuencial y con cuidado**: son los que no admiten error.
- Cuando un subsistema toque a otro, no adivines: dejá una referencia cruzada explícita.

## Al cerrar cada documento

Releé el fuente citado y verificá que la spec dice exactamente lo que hace el código, no lo que parecía hacer en la primera lectura. Después reportame tres cosas:

1. Qué quedó `[SIN VERIFICAR]`.
2. Qué `[PROBABLE BUG]` encontraste y qué bots podrían depender de él.
3. Qué decisiones de diseño del port quedan condicionadas por lo que descubriste.
