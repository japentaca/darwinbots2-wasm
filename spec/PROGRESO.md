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
| `OPEN_QUESTIONS.md` | 🟡 vivo | Q04 resuelta; Q10-Q14 añadidas en A1. |

## Siguiente

**Bloque A2 — `20-VM.md`.** Esperando orden de arranque.

Punto de entrada para retomar:
- Stacks (leer primero): `Module1.bas` (`PushIntStack`, `PopIntStack`, `ClearIntStack`, `DupIntStack`, `IsRobDNABounded`)
- Intérprete y operadores: `DNA.bas:56-1244`
- Tokenizador: `DNATokenizing.bas:1-861` y `:3169-3306`
- Contexto ya fijado por A1: los stacks se limpian por bot (`DNA.bas:68-69`), los store son
  inmediatos, cada token cobra energía en el momento, el intérprete no toca otros bots.

## Pendiente

Bloque A: `20-VM.md`, `21-MEMORIA.md`.
Bloque B: `30-FISICA.md`, `31-ENERGIA.md`, `32-VISION.md`, `33-SHOTS.md`, `34-TIES.md`,
`35-VIRUS.md`, `36-REPRO.md`, `40-MUTACIONES.md`, `50-MUNDO.md`, `60-FORMATOS.md`.
Bloque C: `constants.yaml`, `sysvars.yaml`, `opcodes.yaml`, `70-CASOS-DORADOS.md`.

---

## Registro

- **2026-08-15** — Fase 0 completada. Fuentes sin modificar.
- **2026-08-15** — A1 cerrado (`10-CICLO.md`). Fuentes sin modificar
  (`git diff 02b20d7 -- Darwinbots2/` vacío).
