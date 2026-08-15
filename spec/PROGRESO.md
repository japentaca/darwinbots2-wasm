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
| `OPEN_QUESTIONS.md` | 🟡 vivo | Q04 y Q12 resueltas; Q10-Q17 añadidas. |

## Siguiente

**Bloque A3 — `21-MEMORIA.md` + `sysvars.yaml`.** Esperando orden de arranque.

Punto de entrada para retomar:
- `DNATokenizing.bas:862-3169` (`LoadSysVars`, ~2300 líneas: la tabla de sysvars; también
  `sysvarIN(255)`/`sysvarOUT(255)`, que el intérprete no usa — `20-VM.md §11`)
- Cruzar con los puntos de escritura del motor (`Robots.bas`, `Senses.bas`, `Ties.bas`,
  `Shots.bas`) y con la tabla de limpieza de `10-CICLO.md §7`.
- Contexto fijado por A2: direccionamiento siempre normalizado a 1..1000 (`mem(0)`
  inalcanzable desde ADN); escrituras del intérprete acotadas por `mod32000`; el motor
  puede escribir otras cosas (Q15). `mem(336)`/`mem(339)`/`mem(341)` ya especificadas.

## Pendiente

Bloque A: `21-MEMORIA.md`.
Bloque B: `30-FISICA.md`, `31-ENERGIA.md`, `32-VISION.md`, `33-SHOTS.md`, `34-TIES.md`,
`35-VIRUS.md`, `36-REPRO.md`, `40-MUTACIONES.md`, `50-MUNDO.md`, `60-FORMATOS.md`.
Bloque C: `constants.yaml`, `sysvars.yaml`, `70-CASOS-DORADOS.md` (`opcodes.yaml` ✅ salió con A2).

---

## Registro

- **2026-08-15** — Fase 0 completada. Fuentes sin modificar.
- **2026-08-15** — A1 cerrado (`10-CICLO.md`). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-15** — A2 cerrado (`20-VM.md` + `opcodes.yaml`). Fuentes sin modificar.
