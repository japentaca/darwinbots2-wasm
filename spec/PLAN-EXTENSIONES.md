# PLAN-EXTENSIONES — funcionalidades restantes del original, por etapas

Ampliación del plan tras cerrar M1..M10 + Ext·Rendimiento + Ext·Bestiary
(`PROGRESO.md`). Objetivo: cubrir **el resto de la superficie funcional del
original** (menús de `MDIForm1.frm`, tabs de `OptionsForm.frm`, `SimOptions.bas`)
que el contrato de casos dorados no exigía. Se ejecuta por etapas independientes,
cada una con su criterio de cierre.

**Principio heredado**: el fuente es la spec. Cada etapa distingue **capa core**
(toca `port/core/`, exige casos nuevos y suite en verde en los 3 modos) de
**capa host** (wasm API + JS/HTML; el core no se toca y la suite queda intacta
por construcción).

**Hallazgo que ordena el plan** (2026-08-26): el core ya implementa casi toda la
configuración del original — toroidal (`Updnconnected`/`Dxsxconnected` en
`physics.hpp:503,518`, `robots.hpp:567,573,1682`), pondmode + gradiente de luz,
día/noche con los 3 modos de sol, física de fluidos/sólidos (densidad,
viscosidad, fricciones, elasticidad, Brown, `ZeroMomentum`, `MaxVelocity`),
decay/corpses, tides, formas con deriva y absorción de shots. Los únicos huecos
de core son los pasos ⚙ del tick (`master.hpp`: 3/6-9 torneo+costes dinámicos,
13 PlayerBot, 22-25 autosave/torneo) y la capa de modos de juego
(`F1Mode.bas`, restart/liga). **La mayor parte del valor pendiente es exponer
lo ya portado.**

---

## E1 · Escenario y física configurables — capa host

La demo expone hoy: campo WxH, Costs 0..70, MinVegs, repoblación, MaxEnergy,
mutaciones on/off, StartChlr. Falta el resto del "General" y "Physics and
Costs" del OptionsForm:

| Grupo | Opciones (SimOptions.bas) | Fuente UI |
|---|---|---|
| Forma del campo | `Toroidal` (= `Updnconnected` + `Dxsxconnected`), y los dos ejes sueltos | OptionsForm "General" |
| Tamaño | slider `FieldSize` 1..15: 1 = F1 (9237×6928); 2..12 = 8000×6000 × N; >12 = ×12 × (N−12) × 2 (`OptionsForm.frm:4075-4099`) | ídem |
| Física | presets Fluid/Solid/Custom (`FluidSolidCustom`), `Density`, `Viscosity`, `CoefficientStatic/Kinetic/Elasticity`, `Zgravity`, `Ygravity`, `PhysBrown`, `PhysMoving`, `PhysSwim`, `ZeroMomentum`, `MaxVelocity`, `FixedBotRadii` | tab "Physics and Costs" |
| Luz y ciclo | `Pondmode` + `LightIntensity` + `Gradient`, `DayNight` + `CycleLength`, `SunUp/SunDown` + umbrales + `SunThresholdMode`, `SunOnRnd` | tab "General" |
| Muerte y decay | `CorpseEnabled`, `Decay`, `Decaydelay`, `DecayType`, `NoShotDecay`, `NoWShotDecay`, `BadWastelevel` | ídem |
| Población | `MaxPopulation`, `KillDistVegs`, `BlockedVegs`, `DisableTies`, `DisableTypArepro`, `DisableFixing` | ídem |
| Energía | `EnergyExType`/`EnergyFix`/`EnergyProp`, `VegFeedingToBody`, `Diffuse`, `Tides`/`TidesOf` | "Energy Management" |

Trabajo: setters/getters wasm (~30 exports triviales o un
`db_sim_set_opt(id, val)` genérico), panel de opciones en la página (misma
estructura de tabs del original), y persistencia de las opciones de la UI.
Cierre: sim toroidal visible (bots cruzando bordes), preset F1 de campo, y
smoke test node que fija cada opción y verifica el campo en el struct.

## E2 · Animaciones e inspección de bots — capa host

Lo investigado de `main.frm` (2026-08-26, conversación de visión):

1. **Destellos de impacto** (`DrawShots`, main.frm:953-971 + paleta
   `FlashColor` :397-404): añadir `flash`+`opos` al dump de shots (el core ya
   mantiene ambos, `shots.hpp:645,712`) y pintar el círculo un frame por tipo
   (rojo −1, blanco −2, azul veneno −3, verde waste −4, amarillo poison −5,
   magenta body −6, cian virus −7). Toggle como el original.
2. **Selección de bot + alcance de la vista** (main.frm:1017-1060,
   `showVisionGridToggle`): clic → bot; export nuevo con los 9 ojos
   [dir efectiva con `EYE1DIR`, semiancho con `EYE1WIDTH`, `EyeSightDistance`,
   valor visto]; arcos cian (encogidos a la distancia vista cuando el ojo ve,
   pluma invertida), ojo con foco en rojo. Doble uso: herramienta de
   diagnóstico de visión.
3. **Inspector**: `db_sim_bot_text` ya existe; panel con nrg/body/mem y ADN.
4. **Vectores de movimiento** (`displayMovementVectors`) y **gauges de
   recursos** (`displayResourceGuages`): flechas de `vel` y barras nrg/body.
5. **Skins** (`DrawRobSkin`, main.frm:838) y **monitor RGB de memoria**
   (`DrawMonitor`): al final, valor menor.

Cierre: los 4 toggles del menú View del original funcionando en la página.

## E3 · Objetos del escenario: formas, laberintos, teleporters — capa host

Menú "Objects" del original:

- **Shapes UI**: alta manual, "Add/Delete Ten Random Shapes", borrar todas;
  toggles ya en core (`shapesAreVisable/SeeThrough/AbsorbShots`, deriva
  V/H + `shapeDriftRate`, `makeAllShapesTransparent/Black`) — solo exponer.
- **Mazes** (`Obstacles.bas:45-208`): 6 generadores (horizontal, vertical,
  espiral, checkerboard, polar ice, trash compactor) — transcribir las
  fórmulas de layout como llamadas a `db_sim_add_obstacle` (host) respetando
  su consumo de RNG si generan aleatorio.
- **Teleporters UI**: alta ya exportada; faltan highlight/delete/delete-all.

Cierre: cada maze reproduce el layout del original a igual campo.

## E4 · Costes dinámicos y torneo del tick — CAPA CORE

Los pasos ⚙ 3 y 6-9 de `Master.bas` (hoy fuera de contrato): ajuste dinámico
de costes (`DynamicCosts`, Costs 51..62: target/sensitivity/upper/lower,
`BOTNOCOSTLEVEL`, `COSTXREINSTATEMENTLEVEL`, `ALLOWNEGATIVECOSTX`,
`AGECOSTMAKELOG/LINEAR`), y `PopLimMethod`. Exige: transcripción fiel,
inventario RNG, casos dorados nuevos (familia E4-*), suite en verde en 3
modos. Es el primer trabajo de core desde M8 — rama + revisión.

## E5 · Modos de juego — core + host

- **F1 / League / Restart** (`F1Mode.bas`, tab "Restart and League",
  `Contest_Form.frm`): condiciones de reinicio, liga, contests.
- **Auto-forking** (`SpeciationForkInterval` y compañía; la auto-especiación
  por distancia ya está en `mutations.hpp`).
- **PlayerBot Mode** (paso 13 ⚙): control manual de un bot desde la UI.
- "Automatically tag by name", "Restriction Overwrites", hidepred.

## E6 · Registro y análisis — capa host

- **Gráficas** (`grafico.frm`, `chartingInterval`): población/energía/especies
  en canvas.
- **Snapshots** ("Snapshot of the living/dead", `DeadRobotSnp`,
  `SnpExcludeVegs`) y safemode backup → descargas del navegador.
- **Philogeny / Gene activations / Console / Find Best** (menú Robot).
- **Database/Survival info** solo si aporta: era MDB de Access.

## E7 · Internet / torneo distribuido — capa host (transporte)

La E/S por búferes (`outbox`/`inbox`) ya funciona entre sims. Falta el
transporte real entre navegadores (la capa ⚙ de `50-MUNDO.md §5`):
servidor simple o WebRTC. Diseño abierto — decidir al llegar.

## E8 · Extras de menor valor

Eye designer (`frmEYE.frm`), imagen de fondo, settings del monitor RGB,
E-Grid (`EGridEnabled/Width` — verificar primero si el original lo consume
de verdad), tray icon (n/a en web).

---

## Orden recomendado

**E1 → E2 → E3** (todo capa host, valor alto, riesgo nulo para el core) →
**E4** (primer core nuevo, con su familia de casos) → **E5 → E6 → E7 → E8**
según apetito. Cada etapa cierra con su fila en `PROGRESO.md`.
