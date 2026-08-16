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
| `OPEN_QUESTIONS.md` | 🟡 vivo | Q04, Q11, Q12, Q15 resueltas; Q03/Q14 parciales; Q01 ampliada. |

## Siguiente

**Bloque B.** El Bloque A está cerrado. **No arrancar sin orden explícita.**

Contexto de arranque para B (fijado por A1-A3):
- El orden del tick y las 7 pasadas: `10-CICLO.md §2, §5`.
- La VM y el direccionamiento: `20-VM.md`; el mapa de memoria y latencias:
  `21-MEMORIA.md` + `sysvars.yaml`.
- Avisos ya conocidos: `DnaOps.bas`/`DoubleWord.cls` son código muerto; el archivo
  `Darwinbots2/main` (sin extensión) es una copia vieja de `main.frm`, no compilada.

## Pendiente

Bloque B: `30-FISICA.md`, `31-ENERGIA.md`, `32-VISION.md`, `33-SHOTS.md`, `34-TIES.md`,
`35-VIRUS.md`, `36-REPRO.md`, `40-MUTACIONES.md`, `50-MUNDO.md`, `60-FORMATOS.md`.
Bloque C: `constants.yaml`, `70-CASOS-DORADOS.md` (`opcodes.yaml` ✅ A2; `sysvars.yaml` ✅ A3).

---

## Registro

- **2026-08-15** — Fase 0 completada. Fuentes sin modificar.
- **2026-08-15** — A1 cerrado (`10-CICLO.md`). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
- **2026-08-15** — A2 cerrado (`20-VM.md` + `opcodes.yaml`). Fuentes sin modificar.
- **2026-08-16** — A3 cerrado (`21-MEMORIA.md` + `sysvars.yaml`). **Bloque A completo.**
  Fuentes sin modificar (`git diff 02b20d7 -- Darwinbots2/` vacío).
