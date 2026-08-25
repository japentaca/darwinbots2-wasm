# Prompt de continuación del ciclo de desarrollo (generado 2026-08-25, post-M7)

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
- **M2 · VM y cargador** cerrado (`54d586e`): `ExecuteDNA` completo (bug del `else`
  canónico replicado, stores inmediatos, `CondStateIsTrue` sin consumo, 14 stores con
  sus asimetrías), cargador de texto (Parse, sombreado de privadas, corrección del
  cero inicial, sitios de rechazo). Casos §3 (V-01..V-14).
- **M3 · Memoria y ciclo** cerrado (`39fd715`): tabla completa de sysvars (255
  entradas de `LoadSysVars`), esqueleto del tick (`master.hpp`/`robots.hpp`) y los
  subsistemas de memoria: sentidos, ties, shots, Reproduce con memoria genética,
  corpses. Casos §4 (M-01..M-12).
- **M4 · Física y visión** cerrado (`487c406`): `Physics.bas` completo, buckets de
  `Quads.bas`, visión completa (9 ojos apuntables, oclusión rota B2-1, ojo
  panorámico B2-2) y swept-sphere de shots con `CompactShots` fiel. Casos §5
  (F-01..F-15) y R-05..R-07.
- **M5 · Formatos ida-y-vuelta** cerrado (`2bc58f8`): `formats.hpp` con E/S sobre
  búferes en memoria — registro binario de bot campo a campo, bot de texto completo
  (gen epigenético autodestructivo, `Hash` ByRef), `getvals` y `delgene` real.
  Casos §7 (FM-01..FM-07). Los formatos de nivel sim quedaron para el milestone
  de mundo (M8).
- **M6 · Catálogo de bugs (§9)** cerrado (`fe740a8`, `e88a65f`, `0121bd4`): los
  `[PROBABLE BUG]` como aserciones — B-01..B-28 + B-30. Transcripciones
  arrastradas: visión de formas completa (B-12/13/14), `MemoryPressureKill`
  (B-02), alimentación de shots (cierra B3a), `MakeStuff` real, capa de virus B3b
  completa (B-19/20/21) y `bodyfix` configurable (B-25). Fidelidad: `nbody` de
  `Reproduce` en Single estricto (B-30, errata de spec corregida).
- **M7 · Mutaciones y reproducción sexual (B6)** cerrado (`de80e6c`):
  `NeoMutations.bas` completo en `mutations.hpp` — dispatcher `mutate`, los 11
  operadores (suelos anti-freeze B-31, Insertion 2 mut/token B-33, Amplification
  desde t=2 B-34, Minor=Major B-32, firma rancia B-35), `ChangeDNA`/`ChangeDNA2`,
  `DNAtoInt`/matriz (Q16) y tablas `sysvarIN`/`sysvarOUT`. Crossover completo +
  `SexReproduce` en `robots.hpp` (B-29, R-09..R-11), `Reproduce` con toda la
  herencia y los regímenes Delta2/mrepro/epireset, `sharechloroplasts` real, paso
  4 del tick. **Erratas de spec corregidas contra el fuente** (nota B6-1 en R-11):
  el hijo sexual de padres alineados NO pierde su primer token (`Robots.bas:633`
  relee `upperbound`; el corrimiento solo existe con padres asimétricos en
  dna(0)); la moneda de valores del crossover se consume POR token (IIf eager).
  Contadores cerrados y asertados a 0: `mutate_stub`, `sexrepro_stub`,
  `makestuff_stub`.
- **Estado verificado**: 124 casos / 2668 aserciones en verde
  (`port/build/dbtests.exe`).
- **Toolchain**: g++ 14 (MSYS2 ucrt64) + CMake + Ninja, binario de tests estático.
  Pendiente: instalar clang + emsdk y verificar que la suite da verde compilada a
  WASM (decisión Q07: determinismo del port consigo mismo).
- Línea base de los fuentes VB6: `02b20d7`.

**Antes de nada, leé en este orden**

1. `spec/PROGRESO.md` — estado autoritativo, tabla de milestones del port y registro.
   Incluye la corrección de premisa del 2026-08-16 (**el EXE compila CON chequeos**;
   los flags `=0` del `.vbp` son casillas sin marcar): invalida cualquier intuición de
   "wrap silencioso".
2. `port/README.md` — build, reglas del port, pendientes y qué stub queda abierto
   (`handlewaste_stub`, `world_stub`, `obstacle_collision_stub` — todos B7).
3. `spec/50-MUNDO.md` — B7 completo: repoblación (§2.1), sol/`feedvegs` (§2.2),
   `feedveg2` (§2.3), teleporters (§3, Q10), formas de mundo (§4) y el deslinde de
   la capa torneo (§5).
4. `spec/60-FORMATOS.md` §2.2/§3/§4 — el sidecar `.mrate`, `SaveOrganism`/
   `LoadOrganism` (`.dbo`) y `SaveSimulation`/`LoadSimulation`.
5. `spec/70-CASOS-DORADOS.md` — **R-08** (inventario de 12 extracciones de la
   repoblación), **B-36/B-37** (teleporters y repoblación con deuda), **R-12**
   (orden global de RNG del tick, el meta-caso de cierre); **§0** para las
   convenciones del harness.

**Reglas duras**

1. Los fuentes VB6 (`Darwinbots2/`) son **read-only**. Verificable con
   `git diff 02b20d7 -- Darwinbots2/`, que debe salir vacío.
2. El ciclo es siempre: caso dorado transcrito como test **en rojo** → implementación
   **transcrita del fuente VB6 citado** línea a línea (no de memoria, no del wiki) →
   verde → commit citando la sección de la spec.
3. Los `[PROBABLE BUG]` se replican tal cual (regla 4 del brief): cada caso B-* se
   testea **como comportamiento correcto**. Los sitios de error 6/9/11 del original
   llevan decisión de port documentada por sitio + registro en `VmDiag`/`SimDiag`
   (`10-CICLO.md §14`).
4. Salvaguardas numéricas (`PLAN.md`): toda conversión float→int marcada por la
   spec pasa por `vb_round64`/`vb_clng`/`vb_cint` (bancario centralizado); `Single` =
   `float` estricto con casts explícitos en las fórmulas sensibles; ojo con la
   semántica de VB6 ya replicada en M7: `1/Single` y `Byte/100` dividen en Double,
   `Long + Single` promociona a Double, `IIf`/`And`/`Choose` evalúan todos sus
   brazos (consumen RNG aunque el brazo no gobierne); nada de `-ffast-math`; sin
   FMA implícita (`-ffp-contract=off`); `-fwrapv` solo como red.
5. Al cerrar el milestone: actualizar `spec/PROGRESO.md` (tabla del port + sección
   "Siguiente" + registro con fecha) y commitear. Regenerar
   `spec/PROMPT-CONTINUACION.md` con `/prompt-continuacion`.

**Compilar y correr los tests**

```
cmake -S port -B port/build -G Ninja
cmake --build port/build
port/build/dbtests.exe
```

(El exe linkea estático; no necesita las DLL de MSYS2 en el PATH.)

**Tu tarea: M8 · Mundo (B7)**

Según `spec/PROGRESO.md` ("Siguiente"):

1. Leé `50-MUNDO.md` completo antes de escribir nada. Primer bloque natural: la
   **economía vegetal** — `VegsRepopulate` (`Vegs.bas:23-38` +
   `aggiungirob`/`preparerob`, habilita **R-08**: exactamente 12 extracciones por
   vegetal repoblado, con las 2 coordenadas descartadas, y **B-37**: el cooldown
   arranca en −25, la primera tanda tarda el doble), `feedvegs` (sol en banda
   móvil, 2 RNG/ciclo con `SunOnRnd`) y `feedveg2` (digestión de waste en P5 —
   cierra `handlewaste_stub` junto con `altzheimer`; ahí vive también el
   decremento de `Chlr_Share_Delay` que M7 dejó anotado).
2. Después los **teleporters** (`Teleport.bas`, `50-MUNDO.md §3`): habilita
   **B-36** (drift con un solo eje no traslada; con ambos, tope `MaxVelocity/4` y
   rebote/envoltura). La E/S de disco del modo internet es ⚙/infra: solo el
   movimiento y el ciclo local del teleporter son core.
3. **Obstacles**: `DoObstacleCollisions`/`DoShotObstacleCollisions` (cierra
   `obstacle_collision_stub` y las guardas `numObstacles > 0` de M4).
4. **Formatos de nivel sim** (`60-FORMATOS.md`): `SaveSimulation`/`LoadSimulation`
   sobre búferes (decisión B8-1 ya documentada: sin reintento recursivo),
   `SaveOrganism`/`LoadOrganism` (`.dbo`) y el sidecar `.mrate`
   (`Save_mrates`/`Load_mrates` — las `Mutables` que M7 dejó completas).
5. Cierre: **R-12** — el meta-caso del orden global de consumo de RNG en un tick
   determinista completo (la red de seguridad de la salvaguarda 4 de `PLAN.md`).
   Si algo de B7 resulta depender de la capa torneo/UI (⚙), decidilo caso a caso y
   dejalo registrado en `PROGRESO.md` como en M6/M7.
6. Verde total → commit(s) → actualizar `PROGRESO.md`.

---

*Regenerá este archivo con `/prompt-continuacion` al cerrar cada milestone.*
