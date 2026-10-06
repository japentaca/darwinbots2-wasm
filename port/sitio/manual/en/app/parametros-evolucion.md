---
titulo: "Parameters: Evolution mode"
resumen: "The original's directed-evolution modes (hidden predator, ZeroBot, test) and the weight the app uses to pick the fittest bot."
etiquetas: [evolution, hidden predator, fittest, Base, Mutate, parameters]
estado: revisada
---
<!-- opciones.js «Modo evolución»; core gamemodes.hpp (HidePredStep, HandicapStep, RestartModesStep, Fittest, calc_handycap), master.hpp paso 3; sim.hpp BaseHidden; 50-MUNDO §5 (capa de torneo); web2/engine/sim.js checkGameState (eventos evo/zerobot/seeding solo al registro) -->

The original DarwinBots had an _evolution mode_: an automatic procedure for
evolving a bot from another one, which started simulations, saved files and
restarted itself for hours on end. Of all that, the app keeps what happens
_inside_ the simulation, which is what the first three parameters in this
group control. The outer procedure (the files, the stages, the automatic
restart) isn't there: when one of these simulations reaches its end, it stops
and that's it.

These are modes to experiment with carefully: they depend on species with
fixed names and on values the app leaves at 0. The fourth parameter, on the
other hand, is for everyday use: it decides which bot **Find the best** picks
in Observe.

## The modes {#modos}
<!-- gamemodes.hpp: 1 seeding (DQ como F1; evento en el ciclo 2000), 4/5 hidepred, 7/8 ZeroBot (Fittest cada 50 ciclos; calculateZB: LastMut > 0 y robid distinto del anterior → ×1,15, mismo robid con Mx mayor → ×1,75 y parada; si no, solo evento), 9 test (Test.txt, ciclo 1 vs 8000); el resto no hace nada en el core -->

[[param:opt:92]] picks the mode. The values with an effect inside the
simulation are these; the others behave like 0.

| Value | Mode | What it does in the simulation |
|---|---|---|
| 0 | Normal | Nothing: an ordinary simulation. |
| 1 | Seeding | [[param:opt:93|The disqualification rules]] apply as in an F1 contest. |
| 4 and 5 | Hidden predator | Alternates epochs in which the **Base** species disappears from the world and the **Mutate** species gets an energy boost (see below). The simulation stops if either of the two goes extinct. |
| 7 and 8 | ZeroBot | Every 50 cycles it looks for the fittest bot; if it belongs to the **Mutate** species, has already mutated and is a different bot from last time or has improved its score, it raises the mutation rates. It stops if Mutate goes extinct, or if the best is still the same bot and has improved its score (in the original, that is where it moved on to the test stage). |
| 9 | Test | Compares the energy of the **Test** species at cycle 1 and at cycle 8000: if it doubled and there are more than 10 animals, the test passes. At cycle 8000 it stops. |

Species are recognized by their exact name: they have to be called `Base`,
`Mutate` or `Test` in the scenario.

## The hidden predator {#depredador-oculto}
<!-- HidePredStep: alterna hidepred cuando ModeChangeCycles > hidePredCycl/1,2 + offset (offset al azar hasta hidePredCycl/3); al alternar borra disparos −1 y −6 y aparta a los Mutate de los Base; HandicapStep: Mutate con LastMut > 0 recibe el handicap entero, el resto la mitad; BaseHidden filtra a Base de ADN, física, visión, disparos y vegetales; Base extinto → evo_won_best = Fittest, que ni dbcore_api ni sim.js usan (solo log «evo: Base extinct») -->

The idea of mode 4 is to train one species, **Mutate**, against a fixed rival,
**Base**, without the rival wiping it out while it learns. To do that, the
simulation alternates two epochs:

1. **With the predator in view.** The two species coexist and compete
   normally.
2. **With the predator hidden.** Base's bots are frozen and out of the world:
   they don't run their DNA, they don't move, nobody sees them and they can't
   be shot. Meanwhile, Mutate's bots receive an energy compensation every
   cycle, in full for those that have just mutated and half for the rest.

When a hidden epoch ends, before Base comes back, the feeding shots in flight
are cleared and any Mutate bots that ended up too close to a Base bot are
moved away, so the new epoch doesn't start with a point-blank attack.

The mode ends badly if Mutate goes extinct and well if Base does. In both
cases the simulation stops; in the original, on winning, the fittest bot was
saved (using the criterion of [[param:opt:96]]), and in the app that step
isn't there.

:::parametro opt:92
<!-- u8; 0 normal; ver la tabla de arriba -->
Picks the directed-evolution mode from the table above. By default it is 0, a
normal simulation, and that is what you want unless you are reproducing an
experiment from the original. Modes 4 and 5 do the same thing inside the
simulation, as do 7 and 8: in the original they were told apart by what the
outer procedure did. If the species aren't named the way the mode expects,
mode 4 stops in the first cycle because it can't find Mutate.
:::

:::parametro opt:94
<!-- HidePredStep: umbral hidePredCycl/1,2 + hidePredOffset (Round(hidePredCycl/3 × rnd)); calc_handycap: rampa hasta hidePredCycl × 8 ciclos; con 0 alterna en cada ciclo -->
How long each hidden-predator epoch lasts, in cycles: each one lasts between
0.83 and 1.17 times this value, with a random part so the bots can't learn
the schedule. It also sets the ramp of the energy boost, which grows from 0 to
its full value during the first (8 × this value) cycles of the simulation. With
0 (the factory value), the epochs change every cycle and the mode is useless;
to use it, set a few thousand.
:::

:::parametro opt:95
<!-- HidePredStep: holdXP = (...)/LFOR; con LFOR = 0 no se calcula (err11 registrado); LFOR = 150 y Mutate < Base con hidepred: la época oculta se estira -->
The divisor of Mutate's energy boost. The engine compares how much the energy
of newly mutated bots changes per cycle in one epoch and in the other, and
while the predator is hidden it gives them that difference divided by this
number: with a larger value, the boost is smaller and evolution is more
demanding. With 0 (the factory value) the boost isn't calculated and Mutate
gets nothing. At the cap, 150, the hidden epoch stretches out for as long as
there are fewer Mutate bots than Base bots.
:::

:::parametro opt:96
<!-- gamemodes.hpp Fittest: s = (nrg + 10·body propios + de la descendencia viva hasta 10 generaciones); s' = (descendientes + 1)^p × s^e; e = min(v,100)/100, p = (v < 100 ? 1 : (200 − v)/100); database.hpp SnapshotFitness (misma cuenta); i18n observar.mejor -->
How the fittest bot is picked. For each bot that is neither a vegetable nor a
corpse, the engine adds up its _invested energy_ (energy plus 10 per point of
body) and that of all its living descendants, up to ten generations, and
combines that total with the number of descendants:

- at **100** (the factory value), both count equally: the score is the
  family's invested energy multiplied by (the number of descendants + 1);
- **below 100**, energy weighs less, and at **0** only the number of
  descendants counts;
- **above 100**, descendants weigh less, and at **200** only the family's
  energy counts.

This value decides which bot **Find the best** selects in Observe
([[app/observar]]) and the _Fitness_ column of the snapshot of the living and
of the record of the dead ([[app/parametros-registro]]). In ZeroBot and
hidden-predator modes it is also the criterion the engine uses to pick the
best.
:::
