---
titulo: "Parameters: Game modes (F1 / rounds)"
resumen: "The contest rules of the original: rounds that restart, the F1 mode where species compete until one wins, the cycle and population caps, and disqualification."
etiquetas: [F1, rounds, contest, disqualification, tournaments, parameters]
estado: revisada
---
<!-- opciones.js «Modos de juego (F1 / rondas)»; core gamemodes.hpp (FindSpecies, Countpop), robots.hpp:2105 (Restart), sim.hpp DisqualifyAction; web2/engine/sim.js newRound/checkGameState; 50-MUNDO §5; port/HISTORIA.md «Ajustes F1» y «Torneos» -->

This group holds the rules the original DarwinBots used to make species
compete: a simulation played in **rounds**, each one won by the last species
left standing, and a contest that ends when a species has collected enough
victories. This is the _F1 mode_, the one used for bot leagues.

In the app, you normally leave all of this alone and compete from
**Compete** (see [[app/competir]]): that is where you set up matches, fix these
values for each one and keep the standings. This group is for setting up a
contest by hand from Experiment, or a simulation that restarts on its own.

## What a round is {#ronda}
<!-- web2/engine/sim.js newRound: semilla nueva (roundSeed), mismas especies, opciones de la sim que termina (ROUND_OPT_IDS + costos 0..70), 90-101 restaurados; objetos según PP-03; resetSim → db_sim_round_carry (TotRunCycle y repoblación siguen, RV-33/RV-35); gamemodes.hpp Countpop pone TotRunCycle = 0 al abrir la ronda F1 -->

When a round ends, the app rebuilds the world from scratch with a new seed: it
seeds the species from the start again, with the scenario's count and energy.
The options carry over just as they were when the round ended, including the
changes the simulation itself made (for example, the multiplier moved by the
adjustment in [[app/parametros-costos-dinamicos]]). Nothing from the previous
round is inherited: no bots, no mutations, no energy. The cycle counter goes
back to 0 in the rounds of an F1 contest; in the rounds of [[param:opt:90]] it
keeps counting from where it was.

There are two ways for a new round to start: with [[param:opt:90]], when the
animals go extinct, or with [[param:opt:91|F1 mode]].

## How an F1 contest is decided {#f1}
<!-- gamemodes.hpp Countpop: censo cada SampFreq = 10 ciclos; SpeciesLeft == 1 → Wins + 1; Maxrounds; Wins > Sqr(MinRounds) + MinRounds/2 al llegar a MinRounds, si no MinRounds + 1; i18n/es/competir.json competir.regla.* -->

With F1 mode on, when the simulation starts the engine takes note of the
species that are not vegetables, and every 10 cycles it counts how many bots
each one has left. When only one is left, that species wins the round and
another begins. The contest ends in one of two ways:

1. **By win cap.** If [[param:opt:98|the cap on rounds won]] is greater than 0, the first
   species to win that many rounds takes the contest right away.
2. **By margin.** When [[param:opt:97|the minimum rounds]] are completed (call that
   number N), the species with **more than √N + N/2** victories wins. If none
   gets there, it is a statistical tie and one more round is played, with the
   same count for N + 1.

The margin rule is demanding on purpose: with N = 5 you need all 5
victories; with N = 8, 7 out of 8; with N = 10, 9 out of 10. With N below 5,
winning them all is not enough, so, unless someone reaches the win cap first,
the contest lasts at least 5 rounds. A 4–1 lead after 5 rounds keeps the
contest going, and it is settled only in the eighth round if the leader wins the
next three.

When there is a winner, the simulation stops in the final world.

:::parametro opt:90
<!-- robots.hpp:2105: totnvegs == 0 && Restart && !F1 → StartAnotherRound -->
If the bots that are not vegetables run out, the app starts a new round with a
new seed and the same species as at the start. It is useful for leaving a long
search running: if a seed goes badly and the animals go extinct, another one is
tried without you having to restart by hand. With [[param:opt:91]] on it does
nothing, because the contest handles its own rounds.
:::

:::parametro opt:91
<!-- gamemodes.hpp FindSpecies (al arrancar si ContestMode; una sola especie → se apaga; más de 2 con topes → 99 y 100 a 0) -->
Turns on the round-based contest described above. It needs at least two
species that are not vegetables: with only one, the engine turns the mode off.
The contest is set up when a new simulation starts; turning it on in a
simulation that is already running does not start it (the parameter's note
says so). Species are told apart by their name, so two species with the same
name count as one. With the F1 rules the costs are usually on
([[app/parametros-costos#atajos]]), but this mode does not touch them.
:::

:::parametro opt:97
<!-- set_opt 97 escribe MinRounds y optMinRounds; Countpop: MinRounds + 1 en empate -->
The rounds after which the app checks whether someone won by margin (the N in
the rule √N + N/2). It is 5 by default, the minimum with which the rule can be
met. More rounds make the result more reliable, because a species that got
lucky on one seed is not enough. Each statistical tie adds 1 to it during the
contest. Writing it also writes [[param:opt:101]].
:::

:::parametro opt:98
<!-- Countpop: Wins > Maxrounds − 1 → ganador, en cada censo -->
If it is greater than 0, the first species to win this many rounds takes the
contest, without waiting for the margin rule. With 0 (the default) only the
margin counts. It is useful with three or more species, where reaching the
margin can take many rounds.
:::

:::parametro opt:99
<!-- Countpop: optMaxCycles; TotRunCycle > tope → mata a la especie con menos bots (solo PopArray 1 y 2); extensión adaptativa cada 1000 ciclos; FindSpecies: > 2 especies → 0 -->
A cycle cap per round, meant for duels: when the round goes past this many
cycles, the species with fewer bots dies out entirely and the other one wins the
round. If they are tied, nothing happens. The cap can stretch on its own: every
1000 cycles, if the losing species has been growing faster than the other one,
the engine gives it more time. With more than two species the engine turns it
off at the start. Compete matches do not use it: they have their own cap, which
works for any number of species.
:::

:::parametro opt:100
<!-- Countpop: si pop1 o pop2 > MaxPop, mata a los de menos nrg + body×10 de las dos, en proporción -->
Another control for duels: if one of the two species goes over this number of
bots, the engine kills the weakest ones (those with the least energy, counting
the body) of both, in proportion: the one that went over ends up below the cap
and the other loses the same fraction. It keeps a duel from getting stuck with
thousands of bots. With more than two species it is turned off at the start,
like [[param:opt:99|the cycle cap]].
:::

:::parametro opt:93
<!-- sim.hpp DisqualifyAction (== 2); ties.hpp give/take nrg/body a otra especie (== 1); shots.hpp newshot −7 al fabricar el virus (1 o 2), info shot (2); robots.hpp mkshell/slime/venom/poison, maketie, sexual, delgene (2); dreason mata a la especie; solo con F1 (o x_restartmode 1) -->
Forbids certain actions during the contest. A species that does a forbidden
action is **disqualified**: all its bots die on the spot. It only acts with
[[param:opt:91]] on, or with [[param:opt:92]] set to 1 (the seeding mode of
[[app/parametros-evolucion]]).

| Level | Disqualifies the species that… |
|---|---|
| 1 | makes a virus ([[.mkvirus]]), or passes energy or body to a bot of another species through a tie, or takes them from it |
| 2 | makes a virus, shell, slime, venom or poison; ties with [[.tie]]; shoots at another bot's memory (a positive shot); attempts sexual reproduction ([[.sexrepro]]); or deletes a gene ([[.delgene]]) |

Level 2 does not repeat level 1's tie rule, but since it forbids tying, only
birth ties are left, and those join bots of the same species. It is useful for
tournaments of “clean” bots, which compete only by eating and moving.
:::

:::parametro opt:101
<!-- gamemodes.hpp declareWinner: if x_restartmode == 0 → MinRounds = optMinRounds -->
The value that [[param:opt:97]] goes back to when a contest ends, since
statistical ties keep raising it. Since writing the minimum rounds writes this
one too, you almost never need to touch it separately.
:::
