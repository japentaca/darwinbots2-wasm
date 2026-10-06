---
titulo: Scenarios
resumen: "What a scenario is, what each built-in one brings, and how to create, save, export and share your own."
etiquetas: [scenarios, setup, export, import, json]
estado: revisada
---
A **scenario** is a complete simulation setup, ready to start. It holds three
things:

- **The parameters**: a _base_ (**Classic** or **F1 league**) plus the changes
  the scenario makes to it.
- **The species** that get seeded: which bot, how many, what color, whether it
  is a vegetable and how much energy it starts with.
- **The world objects**: obstacles, mazes and teleporters.

It also has a name, a description and tags. What it does **not** hold is the
seed: you pick that when you launch the simulation. The same scenario with
different seeds gives similar worlds, each with its own history; with the same
seed, it gives the same simulation (see [[tecnico/semillas]]).

<!-- web2/engine/escenarios/index.js (formato 1); PLAN.md decisión 12; i18n experimentar.escenarios.ayuda -->

## Where they show up {#donde}
<!-- web2/src/screens/Inicio.svelte (galería, iniciar, Ajustar → #/experimentar/<id>, destino competir); lib/inicio/VistaEscenario.svelte, vista.js (puntosVista: entre 2 y 30 puntos por especie según la cantidad); Experimentar.svelte (marca F1 si base === 'f1'); Experimentar.svelte aside.lateral -->

On **[[app/inicio|Home]]**, in the **Scenarios** section, each one has a card
with a preview, its description and its tags. The preview is a schematic
drawing, not the real world: dots in each species' color, more or fewer
depending on how many bots it has (hexagons for vegetables, circles for
animals), the walls in gray and the teleporters as rings. Each card has two
buttons:

- **Start** starts the scenario with a random seed and takes you to Observe.
  If the running simulation has unsaved changes, it asks first.
- **Tweak** opens it in [[app/experimentar]] so you can change it before
  launching it.

In **Experiment**, the left column lists them in two groups:
**Built-in scenarios** and **Mine**. Click one to load it into the draft.
The ones that use the F1 league base carry the **F1** mark.

## The built-in scenarios {#fabrica}
<!-- web2/engine/escenarios/fabrica/*.json; fabrica.js (orden); probado: t1.mjs (cantidad de cambios y energía 3000 en todos) -->

The app comes with seven. All of them start from the Classic base except the
F1 match, and in all of them the species start with 3000 energy.

| Scenario | Species | What changes in the world | What it's for |
|---|---|---|---|
| **Primordial soup** | 15 Alga minimalis 3.0 (vegetable) and 5 Animal Minimalis | Nothing: the default world, with mutations. | The starting point to watch a species evolve. |
| **Predator and prey** | 25 Alga minimalis 3.0 (vegetable) and 5 Zebedee V2.1 | Solar energy at 20 (double). | See whether the food runs out or the populations balance. |
| **F1 match** | 5 Alga minimalis 3.0 (vegetable), 5 Devincio Dominator and 5 Carnatus Orbis | F1 league base: costs, physics and a toroidal 9237 × 6928 field. | A face-off with league rules. |
| **Day and night** | 20 Alga minimalis 3.0 (vegetable) and 5 Animal Minimalis | Day and night of 1000 cycles. | Watch the population oscillate when there's no sun at night. |
| **Maze** | 20 Alga minimalis 3.0 (vegetable) and 8 Animal Minimalis | A spiral maze, and the bots see the shapes. | See who learns to move between the walls. |
| **Ocean** | 20 Alga Cohesum (vegetable) and 6 Hunter V2.2 | Fluid medium (water) and a toroidal world. | A hunter chasing drifting algae. |
| **Archipelago** | 20 Gardener veggie (vegetable) and 6 Animal Minimalis | Ten random rock islands, two teleporters and a toroidal world. | Populations separated by obstacles. |

In the table the bot names are shortened: each one's full name is in the
species list in Experiment and in [[app/bots]].

The **F1 match** is different from the rest: on Home its button says **Pick
bots** and takes you to [[app/competir]], where you choose who faces whom. From
Experiment it launches like any other.

The built-in ones can't be modified or deleted. To change one, load it and
edit the draft; if you want to keep the result, save it as your own.

## Creating your own scenario {#crear}
<!-- Experimentar.svelte (abrirGuardar, guardar, duplicarFabrica); DialogoEscenario.svelte; archivo.js comoPropio, duplicar, idLibre, parsearEtiquetas -->

There are three ways.

**From the draft.** This is the most common:

1. In Experiment, load the scenario that's closest to what you want (or come
   in with **Custom setup** from Home).
2. Change parameters, species and whatever else you need (see
   [[app/experimentar]] and [[app/experimentar-avanzado]]).
3. Click **Save as scenario**.
4. Fill in **Name**, **Description** (optional) and **Tags**, separated by
   commas.
5. Confirm with **Save**.

The scenario shows up in **Mine** and in the Home gallery, with the **Custom**
mark.

**By duplicating a built-in one.** With a built-in scenario loaded, **Duplicate
as my own** instantly creates a copy that is yours, named “… (copy)”, and
leaves it open for editing. The copy keeps everything, including the special
behavior of the F1 match on Home.

**From the Library.** Pick one or more bots in [[app/bots]] and, in the dialog
for seeding them, use **New scenario with these**: it creates a custom scenario
with those species, in the default world, and opens it in Experiment. That
dialog also lets you choose the **Starting energy**, which Experiment doesn't
let you change.

## Modifying or deleting your own {#modificar}
<!-- Experimentar.svelte (tipoBase propio: botón Borrar, diálogo borrar.pregunta); DialogoEscenario.svelte (reemplazable, casilla marcada por defecto) -->

To change a scenario of yours, load it, edit the draft and click **Save as
scenario**. Because the draft came from one of your own, the dialog offers the
**Replace “…”** checkbox, already ticked: that overwrites the original
scenario. If you untick it, it's saved as a new one and the original stays as
it was.

With one of your scenarios loaded, the **Delete** button appears, and it asks
for confirmation. Deleting the scenario doesn't close the draft: whatever you
had open stays there until you pick another one.

## Exporting, importing and sharing {#compartir}
<!-- Experimentar.svelte (exportar: descarga del borrador; importar: input .json); archivo.js exportarEscenario, importarEscenario (renombra id ocupado o de fábrica), textoValidacion (hasta 8 errores en el aviso); probado: t2.mjs (importar Sopa primordial → sopa-primordial-2; errores clave-derivada, especie-cantidad, especie-color) -->

Your scenarios are saved in this browser (in a private window, or with storage
blocked, they can't be saved). To take them to another computer or pass them to
someone, you export them as a .json file. What else the app saves and where it
lives is in [[app/tus-datos]].

- **Export** downloads the draft just as it is on screen, saved or not, built-in
  or your own.
- **Import .json** reads an exported file, saves it in **Mine** and opens it. If
  you already have a scenario with the same identifier, or it's the identifier of
  a built-in one, the imported one is saved as a new scenario, with a different
  identifier, and the notice says so. It never overwrites anything.

If the file has problems, it isn't imported, and the notice lists what it found
(up to eight errors): a quantity outside 1 to 10000, a badly written color, a
parameter that doesn't exist, one that can't be set because it depends on
others.

One detail about the bots, because it decides whether the scenario works in
another browser:

- The **Bestiary** bots travel by name only. They work anywhere, because the
  Bestiary is the same for everyone.
- **Your own** bots, the test ones and the ones from pasted DNA travel with the
  DNA inside the file: whoever imports it doesn't need to have them.

If, when you launch, a bot's DNA is missing (for example, a name that isn't in
the Bestiary), the app warns you with the bot's name, so you can remove it or
add it again.

## The file inside {#archivo}
<!-- archivo.js exportarEscenario (JSON.stringify con sangría 2); probado: t2.mjs (Día y noche → propio con día de 3000) -->

The .json can be read and edited with any text editor. This is a custom
scenario made from Day and night, with the day stretched to 3000 cycles:

```json
{
  "formato": 1,
  "id": "noches-largas",
  "nombre": "Noches largas",
  "descripcion": "Día y noche de 3000 ciclos.",
  "etiquetas": ["ambiente"],
  "destino": "observar",
  "opciones": {
    "base": "clasica",
    "cambios": { "opt:33": 1, "opt:34": 3000 }
  },
  "especies": [
    { "bot": "Alga minimalis 3.0", "origen": "bestiario", "cantidad": 20,
      "color": "#30d030", "vegetal": true, "energia": 3000, "hash": "7688556d" },
    { "bot": "Animal Minimalis (4G)(Numsgil)-10.03.05", "origen": "bestiario",
      "cantidad": 5, "color": "#ff4040", "vegetal": false, "energia": 3000,
      "hash": "b011392f" }
  ],
  "objetos": { "obstaculos": [], "teleporters": [] }
}
```

`cambios` holds only the parameters that differ from the base, with their key:
`opt:33` is [[param:opt:33]] and `opt:34` is [[param:opt:34]]. The key of each
parameter is on its entry, starting from [[app/experimentar-avanzado]].
`energia` is each bot's starting energy (from 0 to 32000), and `hash` is a
fingerprint of the DNA that lets you tell whether the bot has changed. The full
format is in [[tecnico/formatos]].

## Scenarios as tournament rules {#torneos}
<!-- i18n/es/competir.json competir.reglas.escenario(.desc); lib/competir/asistente.js -->

When you set up a competition in [[app/competir]], the rules can come **From
Experiment**: the parameters and objects are taken from a scenario (built-in,
your own, or the draft you have open), without its species, because you pick
the competitors separately. It's the way to run a tournament in a world of your
own: you build the scenario, save it and use it as the rules.
