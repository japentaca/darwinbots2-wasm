---
titulo: Your first evolution experiment
resumen: "Step by step: seed a species with mutations on, let it run for tens of thousands of cycles and learn what to look at in Observe, Analyze and the inspector to tell selection from drift."
etiquetas: [evolution, mutations, experiment, genetics, selection]
estado: revisada
---
In [[tutoriales/busca-comida]] you wrote a bot that makes a living, and in
[[tutoriales/reconoce-especie]], one that gets along with its own kind. This
tutorial is different: it doesn't end in a new bot. It ends in a running
experiment and in knowing what to look at while your species evolves.

## Setting up the experiment {#preparar}

You need four things: a seed species that knows how to make a living, enough
food, mutations switched on and time. Everything is set up in
[[app/experimentar]].

**The seed species.** Any of these will do:

- the final bot from [[tutoriales/busca-comida]], if you followed it;
- the Bestiary's Animal_Minimalis_mod_stress: it reproduces with [[.repro]]
  when it is doing well and with [[.mrepro]] when it is losing energy
  ([[simulacion/mutaciones#mrepro]]);
- any simple bot you know eats and reproduces: with no births there are no
  mutations to inherit.

A small one that you understand is best: when a descendant changes, you will
be able to read what changed.
<!-- Animal_Minimalis_mod_stress del Bestiario; probado con el motor: contra un alga en campo chico, el mod_stress persigue, la drena de 3000 a 1638 en 40 ciclos mientras él sube a 4136, y tiene un hijo (33 %) cerca del ciclo 40; el bot final de busca-comida, igual: come, se mueve siempre y pasa de 2 a 4 bots en 100 ciclos; reverificado: el mod_stress contra un blanco quieto drena a 200 por ciclo (+209 él) y pare a los ~25 ciclos; el bot de busca-comida come y se reproduce igual -->

The steps:

1. In [[app/inicio|Home]], find the **Primordial soup** scenario and click
   **Tweak**: it opens in Experiment already loaded. It is the right template: a
   world with no costs, 15 algae, 5 animals and mutations switched on.
   <!-- web2/engine/escenarios/fabrica/sopa-primordial.json (base clasica, sin cambios: costos 0, mutaciones encendidas) -->
2. Under **Species to seed**, remove the animal with the **×** on its row and
   add your seed with **Add species**: **A bot from the library (by name)** or
   **Paste DNA**. Leave the algae: they are the food. 5 seed bots are enough;
   every species you add from here starts with 3000 energy.
   <!-- app/experimentar #especies (DialogoEspecie; 3000 fijo) -->
3. Check that **Mutations** says **Yes**. And don't touch anything else: the
   app seeds each species with its mutation table on and the factory rates, so
   the switch is enough.
   <!-- 40-MUTACIONES §1; core db_sim_add_species (SetDefaultMutationRates y Mutations = True); simulacion/mutaciones #quien-muta -->
4. Set the **Seed** and click **New simulation**. The app builds the world,
   sets it running and takes you to Observe.

:::cuidado
The **F1 match** scenario and the **F1 settings** button turn mutations off.
If you come from there, turn them back on by hand.
:::
<!-- opciones.js F1_NOMBRADAS (mutations: 0); empezar/preguntas #no-evolucionan -->

## Running it and watching {#mirar}

Set the speed to **Max**: evolution shows up over tens of thousands of cycles,
not hundreds. Then, three places.
<!-- empezar/preguntas #no-evolucionan (falta tiempo); app/observar #tiempo -->

**Observe** ([[app/observar]]). The **Population by species** chart and the
**Max. generation** card tell you the basics: whether there are births (the
generation goes up) and whether the population holds. The **Events** list
notes the record generations. And the **Color by** selector changes the tint
of the bots: **Mutations** paints by how many each one has accumulated,
**Generation** by its genealogical age, and **Genetic distance** by how much
it resembles the bot you have picked.
<!-- web2/src/lib/mundo/render-enriquecido.js (lentes); i18n/es/mundo.json mundo.lente.*; lib/observar/PanelVivo.svelte -->

**Analyze** ([[app/analizar]]), with the run live. Four tabs are useful for
this:

- **Species**: one row per species, with the average of **Mutations**, the
  **Max gen.**, the **Mean DNA** and the **Offspring per bot**.
- **Phylogeny**: the tree of individuals of your species, ordered by
  generation. Click a bot and the card gives its parent, its mutations, its DNA
  length and its offspring.
- **Genetics**: histograms of the population (DNA length, generation,
  mutations, offspring) and the most direct view of all, **Dominant DNA vs
  founder**: every 1000 cycles the app takes a snapshot of the DNA carried by
  the most bots and compares it gene by gene with the founder's — which genes
  stay the same, which changed, which are new.
- **Events**, and the Dashboard's **Findings**: a **dominance**, a
  **replacement** or a **collapse**, written out in words and with their
  cycle.
  <!-- web2/src/lib/analizar/Genetica.svelte, Especies.svelte, Filogenia.svelte; web2/engine/lineage.js (fotos del dominante); lib/analizar/hallazgos.js -->

**The inspector** ([[app/inspector]]). When you see a bot with a shifted
color, click it: the header gives its generation and how many mutations it has
accumulated, and the **DNA** tab shows its program as it is now, changes
included. **Copy** takes it all with you; **Family** highlights its
descendants in the world.
<!-- i18n/es/inspector.json inspector.mut.*, inspector.adn.*; lib/inspector/Familia.svelte -->

## What to expect {#esperar}

With the factory rates, in a 20-instruction bot we measured that roughly 1 in
every 60 children conceived with [[.repro]] is born changed, and almost 1 in 5
with [[.mrepro]]. It is a measurement, not a law: the proportion depends on
the DNA length and on the rates. And evolution happens almost entirely through
births: in life, almost nothing changes. The numbers are in
[[simulacion/mutaciones#tasas]] and [[simulacion/mutaciones#mrepro]].
<!-- medido con las mutaciones encendidas (contar-mut, ADN de 20 instrucciones, tasas de fábrica): 8 hijos mutantes de 497 partos con .repro (≈1 en 62) y 91 de 515 con .mrepro (≈1 en 5,7); con las mutaciones apagadas, 0 de 570. Tasas de vida: 40-MUTACIONES §0.2 -->

The rest is biology:

1. **Almost every mutation breaks something.** Mutants show up one at a time,
   and most of them live shorter than the founder: a deleted `start`, a
   shifted number, a gene that stops switching on
   ([[simulacion/mutaciones#que-cambia]]). It is normal for nothing visible to
   happen in the first tens of thousands of cycles.
2. **A mutant that thrives** is recognized like this: its descendants fill the
   population, the **dominant DNA** in Genetics changes from one snapshot to the next and, in
   Phylogeny, its branch is the thick one. The change can be small: a lower
   shooting threshold, a shorter turn.
3. **Color is your first indicator.** Each mutation shifts one channel of the
   species color a little, so an evolving species turns into several
   shades: each shade is, more or less, a lineage.
   <!-- 40-MUTACIONES §1 (mutatecolors); simulacion/especies #mutaciones -->
4. **Drift or selection.** A change sticking around doesn't mean it helped: in
   small populations, a neutral lineage can stay by pure luck. The test is to
   repeat: in [[app/analizar#comparar|Compare]], the **Replicates** run the
   scenario again with other seeds. If a similar change wins in most of them,
   it is selection; if each run tells a different story, what you saw was
   drift.
   <!-- web2/src/lib/analizar/comparar/Replicas.svelte; web2/engine/replicas.js -->

## If the experiment dies out {#apagado}

Three signs that something isn't working: the animal population falls and
never picks up again (the **Findings** write it up as a collapse); the maximum
generation doesn't move — there are no births, and without births there is no
evolution —; the vegetables disappear and the world runs out of energy.
<!-- lib/analizar/hallazgos.js (Colapso); simulacion/cloroplastos (toda la energía entra por los vegetales) -->

What to adjust, all in [[app/experimentar]] with **Apply to current**, without
starting over:

1. **Food**: raise the **Solar energy** ([[param:base:maxEnergy]]) or the
   **Vegetable repopulation** ([[param:base:minVegs]]), or enlarge the
   **Vegetable cap** ([[param:base:maxPopulation]]).
2. **Costs**: if you raised them, try again with **No costs**; a world that
   starves everyone lets nothing evolve.
3. **Starting energy**: in Observe, **Seed** lets you choose the energy new
   bots come in with: seed a few with more energy to relaunch the population.
   <!-- app/observar #sembrar (Energía inicial del diálogo) -->
4. **Time**: most experiments that “don't work” do work, just not yet.

## Variants {#variantes}

- **Exploring faster.** Swap the [[.repro]] for [[.mrepro]] in your seed (or
  use the Animal_Minimalis_mod_stress, which already does it when it is in
  trouble): each child is born with ten times the chance of mutating, just for
  that birth. You will see mutants right away — and also their price: most are
  born broken, and the mutations histogram in Genetics shifts to the right.
  <!-- 36-REPRO §2 (tasas ÷10, solo para ese parto); simulacion/mutaciones #mrepro -->
- **Sexual reproduction.** With [[.sexrepro]] the child is already born
  different because it mixes the DNA of two bots, even if nothing mutates; and
  when two branches drift far apart, they can no longer cross — genetic
  distance decides ([[simulacion/reproduccion]],
  [[simulacion/especies#distancia]]).
- **A hostile world.** The factory world is kind. Push: charge **Costs** (the
  basic control in Experiment), switch on **Day and night** — at night
  vegetables don't make energy and eyes see 20% less —, lower the vegetables
  or shrink the field. Each pressure pushes evolution somewhere else: with
  costs, the ones that spend little; with night, the ones that endure the dark.
  <!-- app/experimentar #controles (Costos, Día y noche); 32-VISION §0.4 (noche: 20 % menos alcance); 50-MUNDO §2.2 (de noche no toca comer) -->

## And now {#ahora}

<!-- app/informes (informe de una corrida guardada); app/inspector #adn (Copiar el ADN del bot); web2/src/lib/analizar/comparar/Replicas.svelte (Réplicas con otras semillas) -->

- Save the run (**Save**, in Observe) and build a report with its findings:
  [[app/informes]].
- If you like a descendant, copy its DNA from the inspector and save it as a
  bot of your own in [[app/bots]]; the [[app/editor|DNA editor]] helps you
  read what changed.
- Before drawing conclusions, repeat with other seeds
  ([[app/analizar#comparar|Compare]] › **Replicates**).
- If something didn't go the way you expected, the list is in
  [[empezar/preguntas]].
