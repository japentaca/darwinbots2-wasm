---
description: Genera el prompt de arranque para continuar el ciclo de desarrollo del port en una sesión nueva
---

Generá un prompt de arranque autocontenido para que el usuario lo pegue como primer
mensaje de una **sesión nueva** de Claude Code y el desarrollo del port C++/WASM
continúe exactamente donde quedó. Seguí estos pasos:

## 1. Recolectar el estado vigente (no lo inventes ni lo recuerdes)

- Leé `spec/PROGRESO.md` entero: es la fuente de verdad. De ahí salen (a) la tabla de
  milestones del port con lo cerrado, (b) la sección **"Siguiente"** (el próximo
  milestone y sus documentos de spec), (c) el registro de fechas.
- Leé la sección "Decisión de arquitectura del port" de `spec/PLAN.md` (las 5
  salvaguardas de build).
- Corré `git log --oneline -12` para citar los hashes recientes relevantes (últimos
  milestones, línea base `02b20d7`).
- Leé `port/README.md` (estado del toolchain y pendientes como clang/emsdk).
- Si `port/build/dbtests.exe` existe, corrélo y anotá el total real de casos y
  aserciones en verde; si no existe o falla, tomá los números de `PROGRESO.md` y
  anotalo como "según PROGRESO".

## 2. Escribir el prompt

Escribí el resultado en `spec/PROMPT-CONTINUACION.md` (sobrescribiendo el anterior:
es un artefacto regenerable, no historia). Usá la estructura establecida de los
`PROMPT-BLOQUE-*.md` del proyecto:

1. Un encabezado breve fuera del bloque copiable: qué es, dónde pegarlo (directorio
   del repo), y por qué en sesión nueva si aplica.
2. La línea `## ↓ COPIAR DESDE AQUÍ ↓` y debajo el prompt propiamente dicho, que debe
   contener **todo** lo siguiente:
   - **Contexto del proyecto** (2-3 párrafos): fuente original DarwinBots 2.48.32 en
     VB6; la especificación en `spec/` está completa y es el contrato; el port es
     core C++ → WASM (Emscripten) con render web separado; `70-CASOS-DORADOS.md` es
     la suite de verdad y `el fuente es la spec` cuando haya que desambiguar.
   - **Estado actual**: milestones cerrados con sus hashes de commit, total de casos y
     aserciones en verde, toolchain actual y pendientes (p. ej. clang/emsdk para
     verificar WASM).
   - **Orden de lectura al arrancar**: `spec/PROGRESO.md` primero (incluida la
     corrección de premisa 2026-08-16: el EXE compila CON chequeos), después los
     documentos de spec que el milestone siguiente necesita según la sección
     "Siguiente" de PROGRESO, y `port/README.md`.
   - **Reglas duras** (numeradas):
     1. Los fuentes VB6 (`Darwinbots2/`) son read-only; verificable con
        `git diff 02b20d7 -- Darwinbots2/` vacío.
     2. El ciclo es siempre: caso dorado transcrito como test en rojo → implementación
        transcrita del fuente VB6 citado (no de memoria, no del wiki) → verde → commit
        citando la sección de spec.
     3. Los `[PROBABLE BUG]` se replican tal cual (regla 4 del brief); los sitios de
        error 6/9/11 llevan la decisión de port documentada + registro en `VmDiag`.
     4. Salvaguardas numéricas de `PLAN.md`: redondeo bancario centralizado
        (`vb_round64`/`vb_clng`), `float` estricto para `Single`, nada de
        `-ffast-math`, sin FMA implícita, `-fwrapv` solo como red.
     5. Al cerrar el milestone: actualizar `spec/PROGRESO.md` (tabla del port +
        sección "Siguiente" + registro con fecha) y commitear.
   - **Cómo compilar y correr los tests** (los comandos exactos de `port/README.md`,
     incluida la nota del PATH de MSYS2 si aplica).
   - **La tarea**: el próximo milestone según PROGRESO, desglosado en pasos concretos
     y con los casos dorados que le corresponden (familia y rango, p. ej. "§4 M-01..M-NN"),
     mirando `spec/70-CASOS-DORADOS.md` para citar los identificadores reales.
3. Cerrá el archivo con una línea que recuerde regenerarlo con `/prompt-continuacion`
   al cerrar cada milestone.

## 3. Entregar

- Mostrá el contenido completo del bloque copiable en tu respuesta (además del
  archivo), para que el usuario pueda copiarlo directo del chat.
- Preguntá si quiere commitear `spec/PROMPT-CONTINUACION.md` o dejalo sin commitear
  si el working tree tiene otros cambios a medias.

Notas:
- No hardcodees el número de milestone ni los totales: derivalos de los archivos en
  el momento de la invocación, para que el comando siga sirviendo después de cada
  milestone.
- El prompt generado debe poder funcionar sin esta sesión: no referencies "lo que
  hicimos antes" ni memoria de conversación — solo archivos del repo y hashes.
