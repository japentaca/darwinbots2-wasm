---
titulo: Experiment
resumen: "The screen where you build a simulation: pick a scenario, change the world with the basic controls, add species and launch it, or apply the changes to the one already running."
etiquetas: [experiment, draft, species, seed, live]
estado: revisada
---
**Experiment** is the app's workbench. Here you set up a simulation before
letting it go: how big the world is, how much food comes in, whether there are
mutations, which species get seeded and with how many bots. It's also where you
change the rules of a simulation that's already running, without starting over.

You get in from the top bar, with **Experiment**, or from a scenario card on
[[app/inicio]] with **Tweak**, which opens this screen with the scenario already
loaded.

## The idea: a draft {#borrador}
<!-- web2/src/screens/Experimentar.svelte (elegir, seguirCorrida); lib/experimentar/estado.svelte.js; PLAN.md decisiones 12 y 13 -->

Everything you touch in Experiment goes into a **draft**: a copy of a scenario
that you can edit without affecting the running simulation. A _scenario_ is a
complete setup: the world's parameters, the species that get seeded and the
objects (obstacles and teleporters). Scenarios have their own page:
[[app/escenarios]].

With the draft ready you have two ways out:

- **New simulation**: starts a new world with the whole draft.
- **Apply to current**: sends the running simulation only the changes that can
  be applied live.

The draft is kept while you switch screens: you can go to Observe, see how it's
going and come back to keep editing. If you reload the page, it's lost. If
another simulation starts (for example, from Home) and the draft had no changes
of yours, it switches to showing the new one's setup.

## The screen {#pantalla}
<!-- Experimentar.svelte (aside.lateral, section.centro, aside.derecha); i18n/es/experimentar.json -->

It has three columns (on a narrow screen they stack one below the other):

| Column | What it has |
|---|---|
| Left | The list of scenarios: **Built-in scenarios** and **Mine**, and the buttons to save, duplicate, delete, import and export. |
| Center | The draft's name, its base, the **Basic** / **Advanced** selector and the controls. |
| Right | **Species to seed**, the **Seed** and the **New simulation** button. |

Above the controls, under the scenario's name, you can read where it came from
(**Built-in scenario**, **My scenario** or **Draft**), its **base** and how many
changes it has compared with that base. The base is the starting point for all
the values: **Classic** (the classic interface's: no costs, a 32000 × 32000
field) or **F1 league** (the costs, physics and field of the F1 tournaments). If
you change the base, the values take what the new one fixes; the species, the
objects and the changes to parameters the base doesn't fix stay.

This page covers **Basic** mode. **Advanced**, with all the parameters, is in
[[app/experimentar-avanzado]]. The app remembers which one you picked last time.

## The marks: live, new, not applied {#marcas}
<!-- Experimentar.svelte .live::before (punto lleno), .new::before (círculo con borde), .chg sobre --aviso-fondo; .leyenda; borrador.js controlVivo, controlCambiado; opciones.js (vivo: false solo en base:fieldW/fieldH); escenarios/index.js diff -->

Every control carries a mark:

- **live** (filled dot): can be applied to the running simulation.
- **new** (empty circle): needs a new simulation.

Only three things need a new simulation: the **Field size**, the species and the
world objects. Everything else applies live.

In addition, a control with a yellow background is a **change not applied**: its
value in the draft is different from the one in the running simulation. If none
is running, the comparison is against the scenario you picked.

## The basic controls {#controles}
<!-- borrador.js GRUPOS_BASICOS; opciones.js CONTROLES_BASICOS, MEDIOS, BORDES, dimensionesCampo; probado: scratchpad pruebas-c12-experimentar/t1.mjs -->

There are ten controls in four cards. Some change several parameters at once:
advanced mode shows each one separately.

| Card | Control | What it does | Parameters |
|---|---|---|---|
| **World** | **Field size** | The classic sizes from the original, from 1 (the F1 field, 9237 × 6928) to 15, and **Classic** (32000 × 32000, the Classic base one). | [[param:base:fieldW]], [[param:base:fieldH]] |
| | **Edges** | **Walls**, **Toroidal** or a cylinder (left↔right or top↔bottom). | [[param:opt:2]], [[param:opt:3]] |
| | **Medium** | **Space** (nothing slows bots down), **Fluid** (water) or **Solid** (a floor with friction). | [[param:opt:14]], [[param:opt:15]], [[param:opt:16]], [[param:opt:17]], [[param:opt:19]] |
| **Energy** | **Solar energy** | The energy vegetables receive every cycle: the food that comes into the world. | [[param:base:maxEnergy]] |
| | **Day and night** | How many cycles the day (and the night) lasts; 0 is always day. | [[param:opt:33]], [[param:opt:34]] |
| | **Costs** | **F1** (the league's), **No costs** (everything free) or **Custom**. | all the ones in [[app/parametros-costos]] |
| **Vegetables** | **Vegetable cap** | The maximum number of vegetables there can be. | [[param:base:maxPopulation]] |
| | **Vegetable repopulation** | If vegetables drop below this level, more are seeded (0 = never). | [[param:base:minVegs]] |
| **Evolution and death** | **Mutations** | **Yes** / **No**: with mutations, children change. | [[param:base:mutations]] |
| | **Corpses** | **Yes** / **No**: the dead stay as food. | [[param:opt:50]] |

A few clarifications:

- **Custom** shows up in a selector only when the value doesn't match any of the
  options: for example, in **Costs** after changing a single cost in advanced
  mode. The 32000 × 32000 field of the Classic base isn't any of the fifteen
  sizes of the original: it has its own option, **Classic**.
- Numbers are corrected as you type them: if the value doesn't fit in what the
  engine can store, it's clamped to the cap. If it fits but is odd, it's accepted
  with a notice that tells you the usual range.
- If a control goes back to its original value, it stops counting as a change.

What each thing does inside the simulation is in chapter 3: the field and the
edges in [[simulacion/mundo]], the medium in [[simulacion/fisica#fluido]], the
light and the vegetables in [[simulacion/cloroplastos]], the costs in
[[simulacion/energia]], the mutations in [[simulacion/mutaciones]] and the
corpses in [[simulacion/muerte#cadaveres]].

## The species {#especies}
<!-- Experimentar.svelte aside.derecha; DialogoEspecie.svelte; borrador.js especieNueva (energia 3000), cambiarEspecie, CANTIDAD_MAX, validarAdn; lib/sim/prueba.js (presets) -->

The right column, **Species to seed**, lists what will be born when the
simulation starts. Each species shows its color, its name, whether it's a
**vegetable** or an **animal** and the **Qty.** of bots. Right there you can
change the color (with the little swatch), the quantity (from 1 to 10000) or
remove it with **×**. With no species, the world starts empty.

To add one, click **Add species**. The dialog asks for the **Source**:

1. **A bot from the library (by name)**: you type part of the name and choose
   among the Bestiary bots and your own (see [[app/bots]]).
2. **Animal Minimalis (simple predator)**: a test animal, 5 bots.
3. **Alga Minimalis (simple vegetable)**: a test vegetable, 15 bots.
4. **Paste DNA**: you give it a **Name** and paste the bot's text.

Then you adjust **Quantity**, **Color** and the **Is a vegetable
(photosynthesizes)** checkbox, and confirm with **Add**. Pasted DNA has to have
at least one gene (a `cond` or a `start`); otherwise, the dialog warns you.

Bestiary bots go into the scenario by name only. Your own, the test ones and the
pasted ones carry the DNA inside, and the list marks them with **DNA included**:
that way the scenario keeps working even if you later edit or delete the bot.

Every species you add from here starts with 3000 energy. This screen doesn't let
you change that: a scenario created from the Library with **New scenario with
these** can bring a different one (see [[app/bots]]).

Species count as the initial seeding: changing them always requires a new
simulation. To put bots into a simulation that's already running, use **Seed** in
Observe or **Seed batch** in the Library.

## The world objects {#objetos}
<!-- Experimentar.svelte snippet tarjetaObjetos; borrador.js resumenObjetos, quitarObjetos; i18n/es/mundoObj.json (barra Mundo de Observar); PLAN.md decisión 15 -->

The **World objects** card sums up the scenario's obstacles, mazes and
teleporters, such as **spiral maze** or **2 teleporters**. Here you can only
remove them all, with **Remove all**. They're placed on the world with Observe's
**World** bar (see [[app/observar]]). Their position is drawn by the simulation
with the seed. How they affect the bots is in [[simulacion/mundo#obstaculos]].

## The seed {#semilla}
<!-- Experimentar.svelte .semilla; borrador.js parsearSemilla, SEMILLA_MAX, semillaAleatoria; probado: probar-adn Animal Minimalis --semilla 7 dos veces (igual) y 8 (distinto) -->

The **Seed** is the number that starts the simulation's randomness: where each
bot is born, which mutations come out, where the obstacles land. With the same
scenario and the same seed you get the same simulation, cycle by cycle; with
another seed, the same world tells a different story. The die (🎲, **Another
random seed**) draws a new one. It has to be an integer between 1 and
2147483646. More details in [[tecnico/semillas]].

## Launching a new simulation {#nueva}
<!-- Experimentar.svelte nuevaSim (normalizar, corrida.iniciar, correr(true), hash observar; sin confirm, a diferencia de puedeReemplazar de Inicio); errores = validar(b) -->

1. Pick a scenario in the left column (or keep going with the draft).
2. Adjust the controls and the species.
3. Check the seed.
4. Click **New simulation**.

The app builds the world, sets it running and takes you to [[app/observar]]. The
simulation is named after the scenario.

The button stays disabled while the seed isn't valid, while the draft has errors
(they show up in red above the button) or while the app is busy building
another one.

:::cuidado
**New simulation** replaces the one that's running without asking. If you want to
keep it, save it first from Observe.
:::

With a tournament in progress, **New simulation** and **Apply to current** are
off (they would replace or change the fight), and a notice at the top takes you
to the tournament strip. You can still edit and save the draft (see
[[app/competir#en-curso]]).

## Applying to the running simulation {#aplicar}
<!-- Experimentar.svelte .pendientes, aplicarActual (sesion.aplicarEnCiclo, registrarCambio), descartar; borrador.js pendientes, cambiosVivos; PLAN.md decisión 13 y C12 -->

If a simulation is running and the draft differs from it, a bar shows up at the
bottom with **_N_ changes not applied**. Each change reads as “name: before →
after”, and the ones that need a new simulation carry the **new** mark. The bar
has three buttons:

- **Apply to current (cycle _N_)**: sends the live changes to the simulation.
  They're all applied together, on an exact cycle, and a notice says which.
- **New simulation**: shows up if any change needs it. It starts from scratch
  with the complete draft.
- **Discard**: sets the draft back to what the running simulation has.

If you mixed live changes with others that aren't, for example the solar energy
and a new species, **Apply to current** sends only the energy, and the species
stays pending until a new simulation.

Every applied change is recorded in the simulation, with the cycle it came in
on. That's why it's saved along with it, and the replicates in [[app/analizar]]
(in the **Compare** tab), which repeat the simulation with other seeds, apply it
on the same cycle: that way you can see whether your change's effect holds up or
was down to chance.

:::nota
In the classic interface, solar energy, vegetable repopulation and mutations
only change on restart. In the new app they apply live like the other
parameters.
:::

If the running simulation didn't come from a scenario (you loaded it from a
.dbsim file), there's nothing to compare against: the screen tells you, and the
changes are only used when you launch a new one.

## Saving what you built {#guardar}
<!-- Experimentar.svelte acciones (guardarComo, duplicar, borrar, importar, exportar) -->

The draft isn't saved on its own. To keep it, use **Save as scenario**: it ends
up in **Mine** and you can open it again, export it as .json or share it. A
built-in scenario can't be modified: **Duplicate as my own** creates a copy that
is yours to edit. All of that is in [[app/escenarios]].
