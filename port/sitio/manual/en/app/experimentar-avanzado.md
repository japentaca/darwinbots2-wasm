---
titulo: "Experiment: advanced mode"
resumen: "Every simulation parameter, in twelve groups: how to find them, change them, set them back to the base, and which ones apply while the simulation is running."
etiquetas: [experiment, parameters, advanced, base, live]
estado: revisada
---
The **Advanced** mode of [[app/experimentar]] shows every simulation parameter,
one by one: more than a hundred, split into twelve groups. The ten **Basic**
mode controls are shortcuts to some of them. Here is everything else: the
fine-grained physics, the cost of each instruction, the tournament rules, light
by depth.

To get in, click **Advanced** at the top right of the controls. Both modes edit
the same draft: what you change in one shows up in the other. The species, the
seed, the world objects and the bar of unapplied changes work the same as in
Basic mode.

## The screen {#pantalla}
<!-- opciones.js PARAMETROS: 108 en 12 grupos; Avanzado.svelte nav.side (`${cambiados}/${total}`), cabecera «grupo · total», «Base {base}»; web2/src/lib/experimentar/Avanzado.svelte (nav.side, section.tabla, prow); avanzado.js gruposAvanzado, resumenGrupos; i18n/es/experimentar.json experimentar.avanzado.* -->

On the left, the list of **Parameter groups**: **All** and the twelve groups.
Next to each one, a number like `3/12` says how many of the group's parameters
you've changed from the base and how many it has in total (if you haven't
changed any, only the total shows).

On the right, the table. Each group starts with a header that has its name, the
**Value** column and the **Base** column with the name of the base (for example,
**Classic base**). Each row is a parameter and shows:

- the name, and next to it the **variable name** in the original program (such
  as `MaxVelocity`), handy if you come from the desktop DarwinBots or read the
  forum;
- a line of help and, sometimes, a note;
- the control to change it: a checkbox for yes/no ones, a list for the ones with
  fixed options and a number field for the rest;
- the value it has in the base, and whether it applies **live** or needs a
  **new** simulation.

Each group and each parameter has a **?** that opens its page in the manual
([[app/parametros-campo]], [[app/parametros-energia]]…, and each parameter's
own page, straight to its entry).

## The two change marks {#marcas}
<!-- Avanzado.svelte (marca ≠ base, class chg = sinAplicar); avanzado.js (cambiado vs sinAplicar) -->

In this mode there are two different ideas of “changed”, and it's worth not
mixing them up:

| Mark | What it means | What it's compared against |
|---|---|---|
| **≠ base** label | The value isn't the one from the scenario's base. | The base (Classic or F1 league). |
| Yellow background | **Change not applied**: the value isn't the one in the running simulation. | The running simulation or, if there isn't one, the scenario you picked. |

If you pick the built-in Day and night scenario with no simulation running, its
day and night parameters show **≠ base** (the scenario brings them different
from the base) but no yellow background: you haven't touched anything yet.

## Finding a parameter {#buscar}
<!-- avanzado.js coincideBusqueda (es, en, variable, clave; todas las palabras; sin tildes), plano; probado: t1.mjs ('veneno' → cost:26, 'maxvel' → opt:11, 'friction' → opt:16/17) -->

The **Search a parameter by name or variable** field filters the table as you
type. It searches all of these at once:

- the name in Spanish and in English (_friction_ finds both frictions);
- the name of the original variable (_maxvel_ finds the max speed);
- the internal key, such as `opt:11`.

Case and accents don't matter. If you type several words, all of them have
to be there. While you search, the table looks across all the groups, no matter
which one is selected on the left.

The **Changed only** checkbox keeps only the parameters marked **≠ base**: it's
the quick way to see what's different about a scenario.

## Changing a value {#cambiar}
<!-- avanzado.js escribirParametro (normalizarValor: clave-derivada, valor-tipo, valor-rango, valor-saturado); opciones.js LIMITES, sugerido, fueraDeLoUsual, satura; probado: t1.mjs (opt:34 40000 → valor-rango; opt:36 1e12 → 2147483647 saturado; opt:12 2 → aviso; opt:34 12.5 → valor-tipo) -->

Type the number and leave the field (or press Enter). One of four things can
happen:

1. **It's accepted**: the value goes into the draft and the row is marked.
2. **It's accepted with a notice**: the value is unusual (an engine efficiency
   above 1, a negative cost). The notice tells you the usual range, but the
   value stays: sometimes the odd value is exactly what you want to try.
3. **It's clamped to the cap**: some large integer parameters, like the sun
   thresholds, don't accept more than a certain maximum. If you go over, the
   maximum is saved and a notice says so.
4. **It's rejected**: the value doesn't fit in what the engine can store, or an
   integer was needed and you typed decimals. The field goes back to the
   previous value and a red message explains why.

The decimal comma is accepted (`0,5`). Some parameters depend on others and
can't be edited: they carry the **derived** mark. The most visible case is
**Toroidal (both axes)** ([[param:opt:1]]), which is 1 when both pairs of edges
are connected: to change it, change the axes or the **Edges** control in Basic
mode.

## Setting back to the base {#volver}
<!-- Avanzado.svelte botones reset (aBase, aBaseDe, baseGrupo); avanzado.js volverABase -->

Each parameter marked **≠ base** has, on the right, a button with a circular
arrow: **Back to the base value**. In the header of each group with any change
there's another one that sets the whole group back at once.

Setting back to the base is not the same as **Discard**. Discard leaves the
draft like the running simulation; setting back to the base leaves the
parameter as the base fixes it, even if the scenario brought it different.

## What changes live {#en-vivo}
<!-- opciones.js (vivo: false solo base:fieldW/fieldH), mensajeVivo; escenarios/index.js diff; PLAN.md C12; Experimentar.svelte aplicarActual -->

Almost everything. Of the more than a hundred parameters, only the field width
and height need a new simulation; the rest is sent to the running simulation
with **Apply to current**, just like in Basic mode (see
[[app/experimentar#aplicar]]). That includes the costs, the physics, the light,
the vegetable economy and the mutations. The species and the world objects
can't be changed live either, but they aren't parameters.

A parameter applying live doesn't mean its effect shows right away. An example:
turning on **F1 mode (species contest)** ([[param:opt:91]]) in a simulation that
is already running doesn't start the contest. That row's note says so: contests
are set up from [[app/competir]] or with a new simulation.

## The twelve groups {#grupos}
<!-- opciones.js GRUPOS y los parámetros de cada grupo; avanzado.js PRESETS_GRUPO (campo: tamano; fisica: medio); Avanzado.svelte (Ajustes F1 en el grupo modos) -->

Each group has its own page, with an entry for each parameter: what it does,
its default value, the range and what you need to know to use it well.

### Field and edges {#campo}
The size of the world and whether its edges are walls or connected. At the top
of the group is the **Field size** selector, with the fifteen classic sizes and the
Classic base one, so you don't have to type the width and height by hand. See
[[app/parametros-campo]].

### Energy and vegetables {#energia}
How much energy the sun gives, how many vegetables there are and how they're
replenished, how what photosynthesis produces is shared out, how much a shot
steals, the tides and the master switch for **Mutations**. See
[[app/parametros-energia]].

### Light and day/night {#luz}
The day and night cycle, the sun that turns on or off depending on the world's
total energy, the sun that moves at random and pond mode, where the light fades
with depth. See [[app/parametros-luz]].

### Physics {#fisica}
Max speed, engine efficiency, friction, the medium's density and viscosity,
gravity, collision elasticity, Brownian motion and options such as **No
inertia** or **Fixed bot radii**. At the top is the **Medium** selector (space,
fluid or solid), which sets the values of each one in one go. See
[[app/parametros-fisica]].

### Death and decay {#muerte}
Whether the dead stay as corpses, how they decay and what they release, whether
energy and waste shots are spent, and from how much accumulated waste a bot gets
poisoned ([[simulacion/energia#desechos]]). See [[app/parametros-muerte]].

### Restrictions {#restricciones}
Three prohibitions for all bots: tying, reproducing on their own (except
repopulating vegetables) and anchoring in place. See
[[app/parametros-restricciones]].

### Costs {#costos}
What a bot pays for everything it does or has: each type of instruction, moving,
turning, shooting, making defenses, keeping up its body and DNA, aging. It's the
biggest group. See [[app/parametros-costos]].

### Dynamic costs {#costos-dinamicos}
The multiplier that scales all the costs and the adjustment that moves it on its
own to bring the population to a target. See
[[app/parametros-costos-dinamicos]].

### Shapes (vision and drift) {#formas}
How obstacles behave: whether bots see them, whether they're transparent,
whether they stop shots and whether they drift around the field on their own.
See [[app/parametros-formas]].

### Game modes (F1 / rounds) {#modos}
The rules of the original's contests: rounds, caps, disqualification and F1
mode. At the top is the **F1 settings** button (see below). See
[[app/parametros-modos]].

### Evolution mode {#evolucion}
The parameters of the original's evolution mode, with its hidden predator. See
[[app/parametros-evolucion]].

### Recording {#registro}
What gets noted down while the simulation runs: the interval of the charts and
the record of the bots that die. See [[app/parametros-registro]].

## F1 settings {#ajustes-f1}
<!-- Avanzado.svelte (preset en grupo modos); borrador.js conAjustesF1; opciones.js ajustesF1 (F1_COSTOS, F1_OPTS, F1_NOMBRADAS); probado: t1.mjs (sobre Sopa primordial: 31 cambios, costos=f1, mutaciones no, bordes toroidal) -->

The **F1 settings** button, in the game modes group, does the same as the
button of the same name in the classic interface: it puts into the draft the F1
league costs (all the others at 0), its physics (solid floor, max speed 180),
the 9237 × 6928 toroidal field, the league's vegetable economy and mutations
turned off. It doesn't touch the species, the objects or the rest of the
parameters. Like any change, it stays in the draft until you apply it or launch
a new simulation.

It's different from changing the base to **F1 league**: the F1 settings write
those values as changes on top of whatever base you have, while changing the
base replaces the starting point of all the values.

## Saving and taking your settings with you {#guardar}
<!-- Experimentar.svelte (guardarComo, exportar, importar); lib/experimentar/archivo.js; búsqueda sin resultados de importadores de .set en web2/src, web2/engine y port/web -->

Parameters aren't saved on their own: they travel inside a scenario. To keep a
configuration, use **Save as scenario** in the left column; to take it to
another browser or pass it to someone, **Export** downloads it as .json and
**Import .json** loads it back. A scenario saves only the parameters that differ
from its base, so the file stays short and easy to read. All of it is in
[[app/escenarios]].

The app doesn't read the settings files from the desktop DarwinBots. If you have
an old configuration you want to reproduce, look up each value by its variable
name (the search finds it) and copy it over by hand.
