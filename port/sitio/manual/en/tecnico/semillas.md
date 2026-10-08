---
titulo: Seeds and reproducibility
resumen: "What a simulation's seed is, when two runs are identical, when they are valid but not identical, and how many different worlds there really are."
etiquetas: [seed, reproducibility, randomness, worlds, replicates]
estado: revisada
---
Many pages of the manual send you here with the same promise: “same seed, same
simulation”. This page delivers on it and adds what usually gets lost along the way:
what exactly that seed is, what is _never_ repeated no matter how much you want
it to be, and why two different seeds can give the same world.

## What the seed is {#que-es}

The seed is the number that starts the world's random number generator. The
engine doesn't roll dice: it uses a pseudorandom number generator, a machine
that produces a very long sequence of numbers that _looks_ random but is pure
math. The seed is the point in that sequence where it starts.

Everything the engine draws comes from that single sequence, in order: where each
seeded bot is born, where the scenario's obstacles and teleporters fall, which
mutation comes out in each birth, where the vegetables the engine repopulates
reappear, and the draws of each phase of the cycle (see [[simulacion/ciclo]]).
Since everything comes from the same sequence in the same order, changing the
starting point changes the entire history.
<!-- core rng.hpp (VbRng: LCG de 24 bits, la única fuente de azar del motor); spec OPEN_QUESTIONS Q01 (inventario de consumos: siembra, formas, repoblación, browniano, mutaciones, disparos…); wasm/dbcore_api.cpp db_sim_start (Rnd -1 : Randomize CLng(semilla)/100 en cada arranque) -->

Hence the rule you've read everywhere: **the same scenario, with the same DNA in
each species, and the same seed give the same simulation, cycle by cycle**. Not
“similar”: identical. The same positions, the same energy, the same births and
deaths in the same cycles.
<!-- verificado: probar-adn.mjs, ADN con rnd y movimiento, --qty 4 --ciclos 40 --cada 10, semilla 7 dos veces → salida byte a byte igual; semilla 8 → distinta (scratchpad c8-semillas/s7a-s7b-s8) -->

In the app the seed is an integer between 1 and 2147483646. You choose it when
launching the simulation, in the right-hand column of [[app/experimentar]], with
a die (🎲, **Another random seed**) in case you want to draw one; the scenario
doesn't store it (see [[app/escenarios]]). Other places where it appears:

- **each tournament match** carries its own, noted in the **Matches** tab of
  [[app/competir]], and it is the one **↻ Replay** reuses;
- **the first replicate** of a replicates job uses the source run's seed, to
  repeat it (see [[app/analizar#comparar]]);
- **the test of a bot** (**Test**, in the editor) runs several seeds and, with
  the same first one, always gives the same result (see [[app/editor#probar]]).
- **the evolution** (**Evolve**, in the editor) tests the base and each variant
  with the same replicate seeds, which come from the round's seed, as in
  **Test**. The variants are generated in disposable sims of the engine, each
  with the round's seed plus a number: the user's simulation isn't touched and
  uses no randomness (see [[app/editor#evolucionar]]).
<!-- web2/src/lib/trabajos/evolucion.js (unidadesEvolucion: las mismas semillas para la base y las variantes); web2 engine/sim.js variantesDe (semilla + i, sims descartables del worker); port/wasm/dbcore_api.cpp db_sim_bot_mutate -->
<!-- web2/src/lib/experimentar/borrador.js (SEMILLA_MAX 2147483646, parsearSemilla, semillaAleatoria); i18n experimentar.semilla.ayuda, experimentar.error.semilla; engine/replicas.js semillasReplicas (la primera es la de la corrida); lib/trabajos/prueba.js -->

## When two runs are identical {#identicas}

The complete list of what has to match is short:

| Has to match | What it covers |
|---|---|
| The scenario | World parameters, species (which ones, how many, with what color), objects. |
| The DNA | That of each species: if the scenario references a bot by name, the same bot; the Bestiary is the same for everyone. |
| The seed | The starting point of the randomness. |
| The engine version | Between app versions some engine detail may change, and with it the run. |

<!-- engine/escenarios/index.js aplicar (escenario + semilla = mensajes que arman el mundo); PLAN.md C15 (reset limpio: «escenario + semilla» da la misma corrida en cualquier worker; colores de formas nuevas desde un generador sembrado con la semilla) -->

If all four match, the two runs are the same, and it doesn't matter where: the
same configuration in any browser, on your machine or a friend's, starts the same
world and follows the same path.

The changes you make to a simulation live don't break anything: they are
recorded with the cycle they came in at and are saved with the run. That is why
a replicate can repeat your entire run, applying each change at its same cycle
(see [[app/experimentar#aplicar]]).

## Valid but not identical: resuming {#retomar}

There is one case where a run is still valid but **not** identical to how it
would have continued: resuming a saved run, or loading a `.dbsim`.

The file stores the world (bots, positions, energy, ties, the shots in flight),
but not the random generator's exact position. On load, the app reseeds the
randomness with the run's seed, as if the sequence started over. From there on
everything is legal: the draws keep coming out fine, but from another place in
the sequence, so the future isn't the one the run would have had if you had
never saved it. It is the behavior of the original and of the [[app/clasica|classic interface]],
not a defect of the port. The metrics history, the events and the lineage don't
go inside the file either: they stay with the saved run in the browser
([[tecnico/formatos#dbsim-carga]]).
<!-- wasm/dbcore_api.cpp db_sim_load (post-carga: Rnd -1 : Randomize UserSeedNumber/100, incondicional; la semilla es la del archivo); PLAN.md C17 -->

What is guaranteed: **the same file loaded in any browser continues the same
way**. The load is always the same, so your run resumed here and on another
machine takes the same path. The DNA of a species that the file doesn't carry is
restored by looking up the bot by its name, and the few settings that the format
doesn't store are always rewritten with the same value. The Bestiary's bots are
in every browser; yours, export them first (see [[app/tus-datos]]).
<!-- PLAN.md C17 (dna-missing repone el ADN; StartChlr y opciones 92–101 se reescriben); lib/sim/corrida-nucleo.js (#resolverAdn por nombre) -->

In practice: to carry on tomorrow where you left off, resume without worry
([[app/inicio]]). For someone else to repeat your run from the start, don't give
them the `.dbsim`: give them the exported scenario and the seed (see the recipes
below). How a run is saved and what the file holds is in
[[app/observar#guardar]] and [[tecnico/formatos]].

## How many worlds there really are {#mundos}

The uncomfortable question: with 2,147,483,646 seeds to choose from, how many
different worlds can the engine give you? The answer: **65,536**.

The generator has a 24-bit internal state (16,777,216 values), but when a
simulation starts only 16 of those bits come from the seed: the engine seeds the
randomness by dividing the seed by 100 and mixing the bits of the result, and 16
bits survive that mixing. It is a legacy of the original that the port reproduces
bit for bit. With 65,536 worlds, each one is shared on average by about 32,768
seeds.
<!-- core rng.hpp (Randomize n reemplaza solo los bytes medios del estado; el byte bajo sobrevive); wasm/dbcore_api.cpp db_sim_start (Randomize semilla/100); spec OPEN_QUESTIONS Q02 y 70-CASOS-DORADOS R-01 (algoritmo, caso 1234 → EE3C); PLAN.md C19; verificado: engine/replicas.js estadoSemilla replica la mezcla (test: 3.017/3.017 semillas) -->

That two “different” seeds give the same world is not unusual: among the first
20,000 seeds, 473 repeat another one's world. Some pairs, checked by running the
engine: **12345 and 73151** give exactly the same run; so do **1234 and 66184**,
and **49 and 807**. 12346, on the other hand, gives another world. Two twin seeds
aren't “similar”: they are the same world, and if you compare them you'll be
comparing a run with itself.
<!-- verificado: scratchpad c8-semillas/t-semillas.mjs (estadoSemilla de engine/replicas.js: 12345 y 73151, 1234 y 66184, 49 y 807 comparten mezcla; 1..20000: 473 repetidas) y probar-adn.mjs con semillas 49 y 807 → salida byte a byte igual; 50 → distinta; re-corrido por el revisor: t-semillas.mjs de nuevo (mismos pares, período 2^24) y probar-adn con 49/807/50 (49 y 807 idénticas byte a byte) -->

Within a run, the generator goes through its 16,777,216 states before repeating
the first draw; since a simulation with a population consumes thousands of draws
per cycle, you won't run out of sequence.
<!-- verificado: scratchpad c8-semillas/t-semillas.mjs (ciclo del LCG desde el estado de la semilla 12345: 16.777.216 pasos = 2^24, período completo); re-corrido por el revisor: idéntico (16.777.216 extracciones hasta volver al estado inicial) -->

The app knows about this and has you covered:

- **replicates and the sweep discard** the seeds that would repeat a world
  already used, so that the band and the deviation don't come out narrower than
  they are (see [[app/analizar#comparar]]);
- the **comparison report warns** when the two runs you are comparing start from
  the same world (see [[app/informes#comparacion]]);
- if you pick seeds by hand, it isn't enough for them to be different numbers: in
  a job of 64 replicates, 3.5% repeated some world without anyone noticing.
<!-- engine/replicas.js semillasReplicas (descarta misma mezcla); engine/report/textos.es.json cmp.mismoMundo; PLAN.md C19 (3,5 % de trabajos de 64 réplicas repetían un mundo) -->

## What the app guarantees {#garantias}

- **Scenario + seed give the same run in any browser and in any thread of
  execution.** An interrupted replicate restarts from scratch and gives the same
  result; a long run doesn't depend on the machine.
- **Each tournament match carries its seed**, so the background round gives the
  same result as playing it while watching, and **↻ Replay** warns if something
  doesn't match (see [[app/competir#tabla]]).
- **Everything a run records travels with its seed**: the saved run, the report,
  the data JSON, the replicates JSON (with each one's seed) and the tournament
  one. What you report can be verified by anyone with the scenario, the seed and
  the same version of the app.
- **The same `.dbsim` loaded anywhere continues the same way.**
<!-- PLAN.md C15, C17, C19 y decisión 23; engine/report/textos.es.json rep.c19 (el informe de réplicas cuenta las descartadas); i18n competir.partidos.ayuda -->

## Recipes {#recetas}
<!-- app/experimentar (Nueva simulación, Semilla, aplicar en caliente), app/analizar#comparar (Réplicas, barrido con Semillas por valor), app/competir#tabla (↻ Repetir), app/observar#guardar (Descargar .dbsim), app/informes#comparacion (aviso de mismo mundo) -->

| You want to | Do this |
|---|---|
| Repeat a run exactly | In [[app/experimentar]], open the same scenario, type the same **Seed** and press **New simulation**. If the run had live changes, use **Replicates** in [[app/analizar#comparar]]: the first one repeats the entire run, with its changes at the same cycle. |
| Replay a match | In [[app/competir]], **Matches** tab, **↻ Replay**: same rules, entrants, seeding order and seed. |
| Compare worlds | **Replicates** in [[app/analizar#comparar]]: up to 64 runs of the same scenario with seeds that don't repeat worlds, with mean, band and deviation. For two individual runs, check whether the report warns that the seeds give the same world. |
| Share your run | For someone else to follow it from where you left off: **Save** → **Download .dbsim** in [[app/observar#guardar]]. For them to repeat it exactly from the start: **Export** the scenario and give them the seed too. |
| Test whether a result was luck | Run several seeds: replicates, or a parameter sweep with **Seeds per value**. If the same thing wins in most of them, it wasn't luck. |

The common questions about repeating are in [[empezar/preguntas#repetir]]. And if
you wonder how the original program's random sequence is made to come out the
same in a browser today, that story is in [[tecnico/como-esta-hecho]] and in
[[tecnico/diferencias]].
