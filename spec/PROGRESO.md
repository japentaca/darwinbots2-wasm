# PROGRESO

Estado de la extracción. Se actualiza al cerrar cada documento, para sobrevivir
reinicios de contexto.

**Fuente:** DarwinBots 2.48.32 (`Darwinbots2/Iersera.vbp`), 53 327 LOC.
**Regla:** el fuente es la spec. El wiki no entra. Los fuentes son read-only.

---

## Hecho

| Documento | Estado | Nota |
|---|---|---|
| `00-INVENTARIO.md` | ✅ cerrado | Fase 0. Versión, flags de compilación, código muerto, mapa de módulos, loop localizado, RNG localizado. |
| `PLAN.md` | ✅ cerrado | Orden de lectura y bloques A/B/C. Aprobado (el Bloque A arrancó por orden del brief). |
| `10-CICLO.md` | ✅ cerrado | **A1.** Iteración secuencial in situ, sin doble búfer. `UpdateBots` = 7 pasadas. Nacimientos antes que muertes en `ReproduceAndKill`. 7 `[PROBABLE BUG]`. Q04 resuelta; Q01 y Q03 parciales. |
| `20-VM.md` + `opcodes.yaml` | ✅ cerrado | **A2.** Parser y VM completos: 77 opcodes con semántica numérica exacta. Stacks de 101 celdas que nunca fallan (overflow descarta el fondo; underflow: 0 / centinela −5 = "vacío es true"). Stores inmediatos confirmados (`CommandQueue` muerto). **`else` tras `start` es código muerto** (`DNA.bas:1178`). El tokenizador no rechaza nada (desconocido → número 0). Q12 resuelta; Q15-Q17 añadidas. |
| `21-MEMORIA.md` + `sysvars.yaml` | ✅ cerrado | **A3, cierra el Bloque A.** Mapa completo de `mem(0..1000)`: 247 direcciones con nombre + 971-990 (memoria genética sin nombre) + `mem(0)` como sumidero de venom/poison (exclusión 340). Latencia 1 ciclo para todos los sentidos; comandos consumidos en el mismo ciclo. Q15 resuelta (nada fuera de ±32000 en juego normal). `sysvarIN`/`sysvarOUT` = vocabulario de mutaciones. 10 `[PROBABLE BUG]` (refvelsx siempre 0, trefshell sin borrar, Kills sin clamp…). Q03(mem), Q11, Q14(A3), Q15 cerradas. |
| `30-FISICA.md` | ✅ cerrado | **B1.** Euler semi-implícito en dos tiempos; fricción/arrastre mutan `vel` directo; librería de vectores con clamps ByRef ocultos; masa incluye cloroplastos (1..32000); `Repel3` con efectos sensoriales inmediatos; bugs de `TieTorque` (Sgn cruzado, escritura en slot fantasma). |
| `32-VISION.md` | ✅ cerrado | **B2.** 9 ojos apuntables; alcance = f(anchura); **oclusión por formas rota dos veces** (bordes transpuestos + `Or`); `PI\36` división entera; `lastopppos` solo del ojo frontal; fórmulas de anchura distintas bots/formas. |
| `33-SHOTS.md` | ✅ cerrado | **B3a.** Ciclo de vida, swept-sphere con sesgo por índice, efectos por tipo. **Inmunidad filial rota** (slot vs AbsNum); slot tirador intocable; `.shoot` múltiplo de 1000 = esperma; 2 RNG/disparo (1 muerto). |
| `35-VIRUS.md` | ✅ cerrado | **B3b.** mkvirus→Vtimer(2×gen)→vshoot; doble cobro en `Vshoot`; potencia ∝ número de gen; slime penetrada amplifica; delgene blindado. |
| `34-TIES.md` | ✅ cerrado | **B4.** Máx 9 ties; puertos asimétricos; endurecimiento a los 19 ciclos define multibot; sharing destruye recursos en los caps; slot 10 fantasma con `.ang` heredable. Q03(Ties) cerrada. |
| `36-REPRO.md` | ✅ cerrado | **B6a.** Reproduce/SexReproduce/crossover. **El hijo sexual pierde su primer token** (Outdna desde índice 0); loterías vegetales asimétricas; crossover no determinista con pérdida de tramos. |
| `40-MUTACIONES.md` | ✅ cerrado | **B6b.** 11 operadores; agenda geométrica vs Bernoulli/token; **suelos anti-freeze reescriben las tasas heredables**; Minor=Major salvo defaults; Q16 resuelta (77 comandos, DNAtoInt max 32767). |
| `50-MUNDO.md` | ✅ cerrado | **B7.** Repoblación por cloroplastos (no por vegetales); sol en banda móvil; teleporters = E/S de disco en el tick (Q10); capa torneo deslindada; Q05 resuelta (Roborder pre-buckets). |
| `60-FORMATOS.md` | ✅ cerrado | **B8.** Texto/.dbo/sim binaria; versionado FE×3 + FileContinue; solo 50 vars persistidas; `sint` = Mod 32000; gen epigenético autodestructivo; **SaveSimulation recursivo en error**; Q01 completa, Q06 y Q14 resueltas. |
| `31-ENERGIA.md` + `constants.yaml` | ✅ cerrado | **B5, cierra el Bloque B.** Libro mayor del nrg/body/waste/cloroplastos por fase del tick; **P4 anti-gigantes muerta con `bodyfix=32100`**; venom 1:1 vs poison 4:1; constants.yaml con 3 capas (compiladas/arranque/preset F1). |
| `70-CASOS-DORADOS.md` | ✅ cerrado | **Bloque C, cierra la especificación.** ~110 casos en 8 familias (suite de autores minada, numérica base, VM/flujo, memoria/ciclo, física/visión, RNG inyectado, formatos, catálogo completo de `[PROBABLE BUG]` como aserciones + 10 sitios de error con decisión de port). Hallazgo: los tests de `fRnd` de los autores fallaban probabilísticamente (S-02). Correcciones derivadas: conteo RNG de repoblación en `50-MUNDO.md §2.1` (12, no 10-11) y nota de `CubicTwipPerBody` en `constants.yaml`. Sin casos `[PENDIENTE DE BINARIO]` bloqueantes (solo 2 observaciones de confirmación, §10.1). |
| `OPEN_QUESTIONS.md` | ✅ sin abiertas | **Todas las preguntas cerradas** (2026-08-16): Q01-Q17 resueltas; Q09 = irresoluble en este entorno (ni el EXE ni el IDE de VB6 corren en el Windows 11 del proyecto — validación empírica descartada; se levantó la veda de fuentes secundarias para las preguntas de runtime: Q02 con el runtime VB de dotnet/runtime, Q17 con la corrección de flags, Q07/Q08/Q13 por análisis y decisión de port). |

> ⚠️ **CORRECCIÓN DE PREMISA (2026-08-16)** — Los flags `=0` de `Iersera.vbp:92-101` son
> casillas de "Advanced Optimizations" **sin marcar**: el EXE distribuido compila **con**
> chequeos de límites/overflow/FP (0 = default = chequear; −1 = eliminar). La premisa del
> brief y de la Fase 0 ("overflow envuelve, índices no fallan") estaba invertida. Errores
> 6/9/11 ocurren en el EXE igual que en el IDE, y con `ignoreerror` (default desde 2014)
> **truncan el resto del tick en silencio** — contrato completo en `10-CICLO.md §14`,
> corrección de origen en `00-INVENTARIO.md §1`. Documentos barridos y corregidos:
> `00-INVENTARIO`, `10-CICLO`, `20-VM`, `opcodes.yaml`, `21-MEMORIA`, `30-FISICA`,
> `PLAN`, `PROMPT-BLOQUE-C`, `OPEN_QUESTIONS`. Los `PROMPT-BLOQUE-A/A2/A3/B.md` se
> conservan sin tocar como registro histórico (contienen la premisa vieja).

## Port C++/WASM (`port/`) — arrancado 2026-08-24 por orden del usuario

| Milestone | Estado | Nota |
|---|---|---|
| M1 · Sustrato numérico | ✅ cerrado | Salvaguarda 5: casos §1 (S-01..S-07), §2 (N-01..N-19) y R-01..R-03 en verde (30 casos, 438 aserciones). Helpers: redondeo bancario, LCG VB6, gasdev, stacks, mod32000, handlers VM, bitwise. Sitios de error con decisión de port + `VmDiag` (N-07 satura a ±2·10⁹; S-05 a 16384). |

## Siguiente

**M2 · VM y flujo**: `ExecuteDNA` + tokenizador contra `20-VM.md`/`opcodes.yaml`
y los casos §3 (V-01..V-09). Después: mapa de memoria (`21-MEMORIA.md` +
`sysvars.yaml`), esqueleto del tick (`10-CICLO.md`), física.

## Pendiente

- Instalar clang + emsdk y verificar que el sustrato numérico da verde compilado
  a WASM (decisión Q07: determinismo del port consigo mismo).

---

## Registro

- **2026-08-15** — Fase 0 completada. Fuentes sin modificar.
- **2026-08-15** — A1 cerrado (`10-CICLO.md`). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-15** — A2 cerrado (`20-VM.md` + `opcodes.yaml`). Fuentes sin modificar.
- **2026-08-16** — A3 cerrado (`21-MEMORIA.md` + `sysvars.yaml`). **Bloque A completo.**
  Fuentes sin modificar (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-16 (post-Bloque B)** — El usuario confirma que ni el EXE ni el IDE de VB6
  corren en su máquina: se descarta la validación empírica y se admiten fuentes
  secundarias para las preguntas de runtime. Q02 resuelta (LCG de VB6, fuente:
  dotnet/runtime `VBMath.vb`); Q09 reclasificada; Q13 resuelta por análisis.
- **2026-08-16 (corrección de premisa)** — Descubierto que los flags del `.vbp` estaban
  leídos al revés: el EXE compila **con** chequeos. Barrido de corrección en 9 archivos
  de `spec/`, nueva `10-CICLO.md §14` (truncamiento de tick), Q07/Q08/Q17 cerradas bajo
  la premisa corregida. **No quedan preguntas abiertas.** Fuentes sin modificar.
- **2026-08-22** — Bloque C cerrado (`70-CASOS-DORADOS.md`). **Especificación
  completa.** Suite de los autores minada (`UnitTests/TestCommon.cls`: solo cubre
  `Common.bas`; hallazgo S-02: los tests de `fRnd` afirmaban un rango que el fuente
  viola con p ≈ 0.5/rango). Dos correcciones menores a documentos B
  (`50-MUNDO.md §2.1`, `constants.yaml`). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-24** — Port C++ arrancado (`port/`) por orden del usuario. M1 cerrado:
  sustrato numérico con casos dorados §1/§2/R-01..R-03 en verde (g++ 14 nativo,
  build estático; clang/emsdk pendientes). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
