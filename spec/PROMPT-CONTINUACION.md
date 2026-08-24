# Prompt de continuación del ciclo de desarrollo (generado 2026-08-24)

> Copiá el bloque de abajo como primer mensaje de una sesión nueva de Claude Code, en
> el directorio `C:\Users\jntac\Documents\prj\jape\Darwinbots2-master`.
>
> Regenerable en cualquier momento con `/prompt-continuacion` — este archivo refleja
> el estado al momento de generarse; regeneralo al cerrar cada milestone.

---

## ↓ COPIAR DESDE AQUÍ ↓

Estás en el repositorio del fuente original de **DarwinBots 2.48.32 (Visual Basic 6)**.

El proyecto: reimplementar el simulador desde cero — **core en C++ compilado a WASM vía
Emscripten, render 2D en web** (decisión y salvaguardas de build en `spec/PLAN.md`).
La especificación en `spec/` está **completa** (Fase 0 + Bloques A, B y C cerrados) y es
el contrato del port; `spec/70-CASOS-DORADOS.md` es la suite de verdad. Cuando haya que
desambiguar algo, **el fuente VB6 es la spec** y los documentos de `spec/` son su índice.

El port vive en `port/` y ya está arrancado:

- **M1 · Sustrato numérico** cerrado (`9182e8e`): redondeo bancario, LCG de VB6,
  gasdev, stacks, mod32000, handlers numéricos/lógicos/bitwise de la VM. Casos §1
  (S-01..S-07), §2 (N-01..N-19) y R-01..R-03.
- **M2 · VM y cargador** cerrado (`54d586e`): `ExecuteDNA` completo (flujo de genes con
  el bug del `else` canónico replicado, stores inmediatos, `CondStateIsTrue` sin
  consumo, 14 stores con sus asimetrías), cargador de texto (Parse, sombreado de
  privadas, corrección del cero inicial, sitios de rechazo). Casos §3 (V-01..V-14).
- **Estado verificado**: 44 casos / 1539 aserciones en verde (`port/build/dbtests.exe`).
- Toolchain: g++ 14 (MSYS2 ucrt64) + CMake + Ninja, binario de tests estático.
  **Pendiente**: instalar clang + emsdk y verificar que la suite da verde compilada a
  WASM (decisión Q07: determinismo del port consigo mismo).

### Antes de nada, leé en este orden

1. `spec/PROGRESO.md` — estado autoritativo, tabla de milestones del port y registro.
   **Incluye la corrección de premisa del 2026-08-16** (el EXE compila CON chequeos;
   los flags `=0` del `.vbp` son casillas sin marcar): invalida cualquier intuición de
   "wrap silencioso".
2. `port/README.md` — build, reglas del port, pendientes.
3. `spec/21-MEMORIA.md` + `spec/sysvars.yaml` — el mapa de memoria (el milestone que sigue).
4. `spec/10-CICLO.md` — el orden del tick (§3 el contrato alrededor del intérprete,
   §14 truncamiento de tick).
5. `spec/70-CASOS-DORADOS.md §0` (convenciones del harness) y `§4` (los casos del
   milestone).

### Reglas duras

1. **Los fuentes VB6 (`Darwinbots2/`) son read-only.** Verificable con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. **El ciclo es siempre**: caso dorado transcrito como test en rojo → implementación
   transcrita del fuente VB6 citado línea a línea (no de memoria, no del wiki) →
   verde → commit citando la sección de la spec.
3. **Los `[PROBABLE BUG]` se replican tal cual** (regla 4 del brief). Los sitios de
   error 6/9/11 del original llevan decisión de port documentada por sitio + registro
   en `VmDiag` (`10-CICLO.md §14`).
4. **Salvaguardas numéricas** (`PLAN.md`): toda conversión float→int marcada por la
   spec pasa por `vb_round64`/`vb_clng` (bancario centralizado); `Single` = `float`
   estricto; nada de `-ffast-math`; sin FMA implícita (`-ffp-contract=off`); `-fwrapv`
   solo como red.
5. **Al cerrar el milestone**: actualizar `spec/PROGRESO.md` (tabla del port + sección
   "Siguiente" + registro con fecha) y commitear. Regenerar
   `spec/PROMPT-CONTINUACION.md` con `/prompt-continuacion`.

### Compilar y correr los tests

```
cmake -S port -B port/build -G Ninja
cmake --build port/build
port/build/dbtests.exe
```

(El exe linkea estático; no necesita las DLL de MSYS2 en el PATH.)

### Tu tarea: M3 · Memoria y ciclo

Según `spec/PROGRESO.md` ("Siguiente"):

1. **Cargar la tabla completa de sysvars** desde `spec/sysvars.yaml` (247 direcciones
   con nombre): hoy `SysvarTable` (`port/core/include/dbcore/loader.hpp`) se inyecta a
   mano en los tests. La tabla del port debe reproducir `LoadSysVars`
   (`DNATokenizing.bas:862-3169`) según `21-MEMORIA.md` — decidí si transcribís desde
   el fuente o generás desde el YAML, pero el fuente manda si divergen.
2. **Los casos §4 (M-01..M-12)** de `70-CASOS-DORADOS.md`: latencia de 1 ciclo de los
   sentidos, comandos consumidos en el mismo ciclo, `mem(0)` como sumidero del remapeo
   de 340, régimen C (comandos que no se consumen), memoria genética 971-990,
   `refvelsx`=0 y `trefshell` sin borrar ([PROBABLE BUG] A3-1/A3-2), herencia del
   timer, shots de memoria, publicaciones al cargar, normalización in place, corpses.
   Varios son [ciclo]/[integración]: van a necesitar el **esqueleto del tick** de
   `10-CICLO.md` (las 7 pasadas de `UpdateBots` en su orden, aunque las pasadas que no
   toquen memoria queden como stubs documentados).
3. Verde total → commit(s) → actualizar `PROGRESO.md`.

Después de M3 vienen: física/visión (§5, F-*), formatos ida-y-vuelta (§7, FM-*) y el
catálogo de bugs como aserciones (§9, B-*). No los arranques sin cerrar M3.

## ↑ COPIAR HASTA AQUÍ ↑

*Regenerá este archivo con `/prompt-continuacion` al cerrar cada milestone.*
