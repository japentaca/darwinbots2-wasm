# 31 — Energía y metabolismo

> Documento B5 de la especificación; cierra el Bloque B. Fuente de verdad: el código
> citado sobre el commit `02b20d7`. Cubre el libro mayor de la energía: entradas,
> salidas, las tres monedas (nrg, body, cloroplastos) y el escape (waste), en el orden
> exacto en que se cobran dentro del tick. Las fórmulas de cada subsistema viven en sus
> documentos (fotosíntesis B7, shots B3, ties B4, VM A2); aquí se integran. Los valores
> por defecto van en `spec/constants.yaml`, producido en esta misma pasada.

---

## 0. Respuestas centrales

1. **La pasada anti-gigantes está muerta con la configuración por defecto**: P4 mata si
   `(chloroplasts < body/2 Or Kills > 5) And body > bodyfix` (`Robots.bas:1613-1617`),
   pero `bodyfix = 32100` por defecto (`HDRoutines.bas:854`) y `body` está clampado a
   ≤ 32000 en todos los caminos (`Robots.bas:1275`, ties, shots) — la condición es
   **inalcanzable** salvo que `Global.gset` baje `bodyfix`. `[PROBABLE BUG]` de primer
   orden: la regla "los asesinos con Kills > 5 mueren" que sugiere el código no opera
   en una instalación estándar.
2. **El orden de cobro dentro del ciclo es parte del contrato**: ADN (paso 10, por
   token, puede dejar `nrg` negativa) → `Upkeep` P1 (edad, body, ADN; decaimientos
   ×0.98) → fuerzas voluntarias P1 (`MOVECOST`, suelo −1000) y flotabilidad → giro P3
   (`TURNCOST`) → transferencias por tie P3 → conversiones P5 (shell/slime/venom/
   poison/body) → disparos P5 → partos P6 (impuestos + `DNACOPYCOST`). Los clamps
   están en P3 (`nrg` a ±32000) y en `WriteSenses` P5 (suelo 0 antes de publicar) —
   entre medias la energía negativa es estado real y visible para los costes.
3. **Tres monedas con tipos de cambio fijos**: `body↔nrg` a 10:1 (`storebody`/
   `feedbody`, cap 100/ciclo, `Robots.bas:1698-1714`); cloroplastos→nrg vía
   fotosíntesis (B7) y digestión de waste (`feedveg2`); las defensas se compran a
   1 nrg = 10 shell = 10 slime = 1 venom = 4 poison, con caps por ciclo
   100/200/100/100 y coste de transacción aparte que **se convierte en waste**
   (`Robots.bas:886-981, 2010-2089`).
4. **La contabilidad global es una ventana circular de 100 ciclos**:
   `TotalSimEnergy(0..99)` acumula por ciclo `nrg + body·10` de cada bot vivo
   (`Robots.bas:1640`) más la energía de los shots −2 en vuelo (`Shots.bas:319`); el
   valor mostrado/usado por los umbrales de sol es el del ciclo **anterior**
   (`Master.bas:236-238`; `10-CICLO.md §2.5`). Los cloroplastos y el waste no cuentan:
   la "energía de la sim" ignora dos de sus reservas.
5. **El multiplicador dinámico `COSTMULTIPLIER` escala *todo* coste** (índice 54,
   aplicado en cada fórmula) y lo gobierna la población no-vegetal con histéresis y
   cero-costes de emergencia (`Master.bas:254-300`; `10-CICLO.md §2.6-2.7`). Un port
   sin costes dinámicos debe fijarlo a 1 y documentar la divergencia.

---

## 1. El libro mayor, por fase del tick

| Fase | Cargo/abono | Fórmula y cita |
|---|---|---|
| paso 10 | ejecución de ADN | por token, tabla de `20-VM.md §1`; sin suelo |
| P1 `Upkeep` | vejez | desde `AGECOSTSTART`: constante, `AGECOST·Log(ageDelta)` o lineal según flags (`Robots.bas:1007-1017`) |
| | mantenimiento | `body·BODYUPKEEP·mult` + `(DnaLen−1)·DNACYCCOST·mult` (`:1020-1025`) |
| | decaimientos | `slime ×0.98` y `poison ×0.98` (suelo 0.5→0), publicados (`:1028-1035`) |
| P1 | movimiento voluntario | `|NewAccel|·MOVECOST·mult`, techo `nrg`, **suelo −1000** (`Physics.bas:447-460`) |
| | flotabilidad (pondmode) | `Ygravity/PhysMoving·min(mass,192)·MOVECOST·mult·Bouyancy` (`Physics.bas:398`) |
| P3 | giro | `|Δgiro/200|·TURNCOST·mult` (`Robots.bas:792`) |
| | ties | alimentación −1/−6 con límites y retaliación por poison; sharing con impuesto 1% al iniciador (`34-TIES.md §2`) |
| | virus | `genelength·DNACOPYCOST·mult` al fabricar; doble `vshoot+SHOTCOST` al disparar (`35-VIRUS.md`) |
| P5 | conversiones | §0.3; el coste de transacción (`SHELLCOST` etc. ×mult) va a `Waste` (`Robots.bas:914-922` y análogos) |
| | cloroplastos | `ChangeChlr`: solo cobra al **añadir** (`CHLRCOST·Δ·mult`), y se anula si dejaría `nrg < 100` (`Robots.bas:1249-1257`) |
| | disparos | tabla de `33-SHOTS.md §2.1` (SHOTCOST, valor del −2, log-escalado) |
| P6 | partos | 0.1% al padre, 1% al hijo, `DnaLen·DNACOPYCOST·mult` con suelo 0 (`36-REPRO.md §2`) |
| paso 21 | fotosíntesis | fórmula de `50-MUNDO.md §2.2` (entrada de nrg/body) |

Muerte energética (`ManageDeath`, `Robots.bas:1300-1339`): con corpses activados,
`nrg < 15` (y `age > 0`) → corpse (la energía restante se destruye: `nrg = 0`);
`body < 0.5` → `Dead`. Sin corpses: `nrg < 0.5 Or body < 0.5` → `Dead`.
`Shock` (`:1281-1296`): no-vegetal con `nrg > 3000` que pierde más de media `onrg` en
un ciclo → `nrg = 0` (la conversión a body es código muerto, `10-CICLO.md §11.1`).

## 2. Waste: el escape

Fuentes: costes de transacción de conversiones (§1), 1% de las transferencias de
nrg/body por tie y shot, decaimientos varios. Sumideros, en el orden de `HandleWaste`
(P5, `Robots.bas:1185-1195`): digestión con cloroplastos (`feedveg2`, 1 RNG,
`50-MUNDO.md §2.3`) → `BadWastelevel` (0 → default **400**, `:1187`; −1 desde la UI lo
desactiva de facto al ser `> 0` falso… no: `−1 > 0` es falso → sin alzheimer) →
`altzheimer` si `Pwaste + Waste > umbral` (escrituras aleatorias en memoria,
`21-MEMORIA.md`) → `defacate` si `> 32000` (shot −4 de 200, cap a 31500) → suelo 0 →
publicación. `Pwaste` es un acumulador sin retorno (solo crece: 1% de defacate, 1% de
los shots −4 emitidos, transferencias por tie) con clamp 32000.

## 3. Body y cloroplastos

- `body` se publica y clampa en P5 (`ManageBody`); alimenta la masa (B1), el radio,
  el `vbody` multibot (B4), la potencia de shots (B3) y es el botín de `releasebod`.
  Los corpses lo drenan por `Decay` (`33-SHOTS.md §5`).
- Cloroplastos: decaimiento por ciclo `0.5/(100^(chlr/16000))` (`Robots.bas:1222`),
  compra/venta por `mkchlr`/`rmchlr` (§1), reparto en partos (proporcional `per`),
  sharing por tie con умbral de distancia genética (B4), techo poblacional
  `TotalChlr > MaxPopulation` que bloquea compras y reproducción vegetal (B7).
  Acoplan masa (×31680/32000, B1), radio (→415) y la condición muerta de P4 (§0.1).

## 4. Resumen de `[PROBABLE BUG]`

1. **P4 anti-gigantes inalcanzable con `bodyfix = 32100`** (§0.1).
2. **Tipos de cambio asimétricos venom/poison** (1:1 vs 4:1, `Robots.bas:2015,2055`)
   — geometría del código; el poison es 4× más barato.
3. **El suelo −1000 de `MOVECOST`** (`Physics.bas:456-458`): con costes negativos
   configurados, el movimiento *regala* hasta 1000 nrg/ciclo — el techo existe, el
   suelo del regalo también, pero ninguno se documenta en la UI.
4. **`ChangeChlr` cobra solo las compras netas** y las anula si dejarían `nrg < 100`
   (`Robots.bas:1253-1257`) — comprar cloroplastos es gratis si te arruina, con el
   comentario del autor reconociendo el anti-cheat de 3 ciclos.
5. Heredados: `Shock` destruye energía (A1); la energía del corpse se destruye al
   formarse (`nrg = 0` sin conversión, `Robots.bas:1317`); sharing con caps destruye
   recursos (B4).

## 5. `[SIN VERIFICAR]`

- Los valores de `Costs()` de una instalación real: el arranque los deja en 0 salvo
  los sembrados (`constants.yaml §defaults`), y `lastexit.set`/el preset elegido en la
  UI los determinan. El corpus de liga evolucionó contra el **preset F1**
  (`constants.yaml §preset_f1`); las sims eco contra ajustes de usuario. El port
  debería tratar el preset F1 como la referencia de compatibilidad.
- El efecto agregado de `COSTMULTIPLIER` dinámico sobre ecologías largas (es
  emergente, no especificable estáticamente).

## 6. Preguntas

Ninguna nueva; este documento consolida. Con B5 cerrado, **el Bloque B está completo**.
