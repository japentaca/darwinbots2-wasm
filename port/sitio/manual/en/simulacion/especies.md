---
titulo: Species and lineage
resumen: "What a species is for the engine (an inherited name), what happens to it when bots mutate, how parentage and genetic distance are recorded, and where you can see all of that in the app."
etiquetas: [species, lineage, phylogeny, genetic distance, mutations]
estado: revisada
---
To the DarwinBots engine, a species is above all **a name**. Every bot you seed
from a given library bot carries its name, and all of its descendants inherit it,
however much they mutate. The app builds the species record, the family tree and
the measures of how far the DNA has changed on top of that simple idea.

This page separates three things that are easy to mix up: the species (the name),
the lineage (who is whose child) and genetic similarity (how alike two DNAs are).

## What a species is {#especie}
<!-- core sim.hpp SpeciesFromBot (por FName); formats.hpp AddSpecieFromFile; engine/sim.js seedSpecies; 33-SHOTS §5 (−3/−5 conespecífico por FName); sysvars .totalmyspecies -->

When you set up a simulation, each species you add under “Species to seed” (see
[[app/experimentar]]) is a library bot with a quantity, a color and a vegetable or
animal mark. When you seed it, the world registers the species under that name, and
every seeded bot and every child born afterwards carries it.

The engine uses that name to decide who is “one of its own”:

- [[.totalmyspecies]] counts the living bots with the same name as yours.
- The venom ([[.strvenom]]) and the poison ([[.strpoison]]) of a bot of the same
  species do no harm to it: it absorbs them as if they were its own.
- Corpses are named `Corpse` and stop counting for their species (see
  [[simulacion/muerte]]).

That doesn't mean a bot _knows_ the name of the others: the DNA can't read it. To
recognize a relative, a bot compares the signature of its DNA with that of the bot
it sees ([[sysvars/my]] and [[sysvars/ref]]), which is an approximation. The
tutorial [[tutoriales/reconoce-especie]] goes into it.

## When bots mutate {#mutaciones}
<!-- core mutations.hpp (mutatecolors, Mutations, generation); 36-REPRO §2; sysvars my* (se recalculan al mutar, B6-9) -->

With mutations turned on (see [[simulacion/mutaciones]]), children are not exact
copies of the mother and, over time, a species' DNA drifts away from the original.
In this version **the name does not change**: the descendants are still the same
species even when their DNA no longer resembles the founder's. They still count in
`.totalmyspecies` and are still immune to the venom of their relatives.

What does change, in every bot that mutates:

- **The color.** Each mutation shifts one of the three components (red, green or
  blue) a little, so an evolving species gradually turns into several shades.
- **The signature.** The `my*` sysvars are recalculated, and what the others see in
  `ref*` changes along with them.
- **The mutation count**, which accumulates from mother to daughter.
- **The subspecies.** The bot gets a new subspecies number within its species (the
  same happens when a virus infects it, see [[simulacion/virus#infeccion]]), and its
  children inherit it. It is an internal label: the DNA can't see it and it changes
  nothing of the above; it only serves to measure how many variants coexist within a
  species.
<!-- core mutations.hpp (NewSubSpecies al mutar), robots.hpp Reproduce (c.SubSpecies = p.SubSpecies); 35-VIRUS §3.5; wasm CalcStats (SPECIESDIVERSITY_GRAPH cuenta subespecies distintas) -->

### New species by mutation {#autoespeciacion}
<!-- 36-REPRO §4 (auto-especiación); core mutations.hpp (renombrado "(k)Nombre", tope 49); web2/PLAN.md C7 -->

The original DarwinBots engine can also split a species in two: _self-speciation_.
When a bot accumulates more mutations than a certain percentage of the length of its
DNA (a setting that is saved with the simulation), it is renamed and founds a new
species. The new name is the old one with a number in parentheses in front:
`(12)Mi bicho`. The number comes from a world counter that goes up with every new
species; if the name already had a number, it is replaced, so parentheses never pile
up. The renamed bot starts counting its mutations again from 0, and its children
inherit the new name. No new species are created if the world already has 49
registered.

From that moment on it is a different species for everything above: its
`.totalmyspecies` counts separately and the venom of the mother species no longer
spares it.

:::nota
The app has no control to turn self-speciation on. The engine only applies it in a
simulation loaded from a `.dbsim` file that has it turned on (see
[[tecnico/formatos]]). In a simulation set up in the app, the species are the ones
you seeded.
:::

## The lineage {#linaje}
<!-- core robots.hpp Reproduce/SexReproduce (generation, BirthCycle, parent); 36-REPRO §0.2 (matrilineal); engine/lineage.js -->

Besides its species, every bot has a number that is never repeated in the whole
simulation, and the engine records for each one:

- its **mother** (the seeded ones have none; they are _founders_);
- its **generation**: the mother's plus one, starting at 0 for the founders;
- the **cycle it was born in** and how many mutations it has accumulated.

In sexual reproduction (see [[simulacion/reproduccion]]), the “mother” is the bot
that has the child. The other one only supplied the sperm with a shot, and is not
recorded: the lineage follows the maternal line.

## Genetic distance {#distancia}
<!-- 36-REPRO §3.3 (GeneticDistance = no emparejados / total), §0.3 (0,6), §4; 34-TIES §2.1 (0,25); wasm db_sim_vis_gendist_step; web2 genetica.js distanciaDiff -->

How alike are two bots? The engine measures it by aligning the two DNAs word by
word: it looks for the stretches they have in common and counts what fraction of the
words ended up without a match. 0 is two identical DNAs; 1, two that share nothing.

That measure decides two things in the world:

| What for | Threshold |
|---|---|
| Having a child with the sperm received ([[.sexrepro]]) | If the distance is over 0.6, there is no child. |
| Sharing chloroplasts through a tie ([[.sharechlr]]) | If it is over 0.25, nothing is shared. |

So even if the species name doesn't change, two branches that drifted far apart can
no longer interbreed: the species splits in practice even though the record doesn't
say so.

## Where you see it in the app {#app}
<!-- web2 src/i18n/es/analizar.json, mundo.json, inspector.json; engine/lineage.js (fotos, poda); analizar/filogenia.js, genetica.js -->

**In Observe** (see [[app/observar]]), the color of the bots can follow the species
(the usual setting) or other measures: generation, mutations, DNA length and
_genetic distance_, which paints each bot according to how much it resembles the
selected bot. With the enriched view, the inspector (see [[app/inspector]]) shows a
bot's species, mother and living children and, with “Family”, highlights all of its
descendants in the world.

**In Analyze** (see [[app/analizar]]) there are four tabs for this:

- **Species**: one row per species, with the bots alive today and their maximum, the
  cycle it appeared in and the one it went extinct in, the highest generation, and
  the averages of mutations, DNA length, energy, age and offspring per bot.
- **Phylogeny**: the species tree (each species hangs from the species of the mother
  of its first bot) and, for one species, the tree of its individuals ordered by
  generation. Of the individuals' tree only the living bots and their ancestors are
  kept; branches that went extinct without leaving descendants are discarded.
  Without self-speciation, the species tree is flat: they are all founders.
- **Genetics**: histograms of the population (DNA length, generation, mutations,
  age, energy, body, genes, offspring, prey hunted) and how they change over the run.
  It also compares the _dominant_ DNA of a species (the one most bots carry,
  photographed every 1000 cycles) with the founder's, gene by gene: which genes stay
  the same, which changed, which are new and which were lost.
- **Events**: new species, extinctions and population and generation records, marked
  in time.

:::nota
The “distance to the founder” in the Genetics tab is not the same measure as the
engine's: it compares the two DNAs gene by gene and counts the fraction of words
that changed. It is useful for seeing how much a species has evolved, but it is not
the one that decides whether two bots can interbreed.
:::

The Genetics tab is the most direct way to watch evolution in action: in
[[tutoriales/evolucion]] there is a step-by-step experiment.
