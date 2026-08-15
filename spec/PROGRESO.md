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
| `PLAN.md` | ✅ cerrado | Orden de lectura y bloques A/B/C. **Pendiente de aprobación.** |
| `OPEN_QUESTIONS.md` | 🟡 vivo | 8 preguntas abiertas desde Fase 0. |

## Siguiente

**Bloque A1 — `10-CICLO.md`.** Bloquea todo lo demás.
Arrancar en **sesión limpia** (este contexto está contaminado con el wiki) y con el
repo bajo git.

Punto de entrada para retomar:
- Bucle exterior: `main.frm:2061` `Private Sub main()`
- Tick: `Master.bas:23` `Public Sub UpdateSim`
- ADN: `DNA.bas:1245` `ExecRobs` → `DNA.bas:56` `ExecuteDNA`
- Bots: `Robots.bas:1476` `UpdateBots`
- Stacks (leer antes que el intérprete): `Module1.bas`

## Pendiente

Bloque A: `10-CICLO.md`, `20-VM.md`, `21-MEMORIA.md`.
Bloque B: `30-FISICA.md`, `31-ENERGIA.md`, `32-VISION.md`, `33-SHOTS.md`, `34-TIES.md`,
`35-VIRUS.md`, `36-REPRO.md`, `40-MUTACIONES.md`, `50-MUNDO.md`, `60-FORMATOS.md`.
Bloque C: `constants.yaml`, `sysvars.yaml`, `opcodes.yaml`, `70-CASOS-DORADOS.md`.

---

## Registro

- **2026-08-15** — Fase 0 completada. Fuentes sin modificar.
