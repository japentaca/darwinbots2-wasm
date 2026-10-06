---
titulo: Tournament bots
resumen: "How to design a bot that wins F1 league matches: what is really charged, what is worth spending, and the virtues that set the Bestiary's champions apart."
etiquetas: [tournaments, f1 league, efficiency, compete, bestiary]
estado: revisada
---
[[app/competir]] covers the formats, the rules and the Elo; this page is the
other half: how to think up a bot that makes the most of them. A match is not a
free simulation. Costs are really charged, the dead leave no food, mutations
come switched off and the round is won by whoever lasts. Tournament strategy
is, before anything else, economics.

<!-- opciones.js ajustesF1 (btnSetF1_Click): F1_COSTOS, F1_OPTS y F1_NOMBRADAS; port/README «Ajustes F1» -->

## A different court, different rules {#economia}

The world of a match with the **F1 base** is small and without corners: a
9237 × 6928 field with both axes connected (no walls to hide behind), floor
with friction, a maximum speed of 180 and no day or night. Two details that
change the whole design:

<!-- opciones.js F1_OPTS (2=1, 3=1, 11=180, 16=0.6, 17=0.4, 19=2, 33=0, 40=1, 50=0); F1_NOMBRADAS (fieldW 9237, fieldH 6928, mutations 0, maxEnergy 40, minVegs 10, maxPopulation 25) -->

- **Corpses are switched off** ([[param:opt:50]] at 0): a bot that dies
  disappears with its energy. You eat only by shots or by ties; killing for
  fun leaves no prize.
- **Mutations are switched off and the DNA is frozen when you enter**: what you
  submit is exactly what runs, match after match. There's no evolution inside
  the league; the selection is something you do in the workshop.

The pantry is finite too: each round starts with 15 algae of 3000, and
repopulation only tops up if they fall below 10, so the energy that enters the
world is bounded. With the tournament's default values (5 bots per species,
3000 to start, a cap of 5000 cycles), what decides the round is how you
manage yours.

<!-- partido.js ALGA_ARRANQUE (qty 15, nrg 3000; el alga de arranque de la liga) y F1_NOMBRADAS (minVegs 10); competir.md valores por defecto (LG_FMT_DEFAULT: qty 5, nrg 3000, cap 5000); opciones.js F1_NOMBRADAS -->

What the league charges, with the multiplier at 1:

| Action | Price |
|---|---|
| A comparison (even if the gene doesn't fire) | 0.004 |
| A [[op:store|store]] | 0.04 |
| Pushing, per unit | 0.05 |
| Turning | free |
| A shot | 2 |
| A tie attempt | 2 |
| A new chloroplast | 0.2 |
| Living one cycle (age + 1000 of body) | 0.02 |

<!-- opciones.js F1_COSTOS (5=0,004; 7=0,04; 20=0,05; 21 ausente = 0; 23=2; 22=2; 8=0,2; 30=0,00001; 31=0,01; 54=1; el resto en 0: números, lecturas, aritmética, lógica, control de flujo, giro, copia del ADN). El mantenimiento se cobra en la fase de fuerzas y choques (10-CICLO §5 P1). Precios de las defensas: [[estrategias/defensivos#precio]] -->

Numbers, memory reads and all arithmetic come free, and so does turning:
scanning by spinning around costs nothing; what costs is moving, writing and
shooting. Measured with these settings: a bot standing still pays 0.02 per
cycle, one that pushes flat out (40 of thrust) pays about 2 and runs dry
before 1500 cycles, and one that searches in little nudges pays 0.34 and
reaches the 5000 cap with energy to spare. Swimming flat out is the most
expensive way to find nothing.

<!-- probado con probar-adn.mjs con los ajustes de la liga F1 (--campo 9237x6928 --opt 11=180,19=2,16=0.6,17=0.4,2=1,3=1,50=0,33=0,40=1,13=0,56=10000,63=0.5,60=1,62=1,21=0 --cost 5=0.004,7=0.04,23=2,20=0.05,22=2,26=0.01,27=0.01,28=0.1,29=0.1,8=0.2,30=0.00001,31=0.01,54=1 --maxe 40): inerte (cond start stop end) 3000 → 2998,01 en 100 ciclos (0,02/ciclo); nadador (40 .up por ciclo) 3000 → 2794,00 en 100 (2,06/ciclo); el buscador de más abajo 3000 → 2932,49 en 200 (0,34/ciclo) -->

## The champion's virtues {#virtudes}

**Efficiency before bravery.** I ran a standalone duel between two bots with pedigree,
_Russia_ and _Teriyaki_, on the league field: in 800 cycles they never crossed
paths even once (both hunt by waiting), but at that pace one was left with 2750
energy and the other with 580. If the round reaches the cycle cap and is
decided on energy, whoever spent less wins. And mind the most treacherous
detail in the table: comparisons are charged even if the gene doesn't fire.
A DNA with dozens of conditions pays for all of them, every cycle: _Russia_
asleep, doing absolutely nothing, pays 0.31 per cycle, almost all of it on the
roughly 65 comparisons in its conditions.

<!-- probado (ajustes de la liga F1, campo 9237x6928): Russia_F1_League (qty 1) vs Teriyaki_F1 (otro), 800 ciclos: no se encuentran, Russia 3000 → 2747 (hibernando, 0,31/ciclo), Teriyaki 3000 → 584 (2,9/ciclo manteniendo 500 de toxina). Russia sola con 2500: 51=hibernate en 1, gasta 0,314/ciclo (65 tokens de comparación × 0,004 + un store de un gen que siempre corre + 0,02 de upkeep) -->

**Robustness: don't depend on a single channel.** My first searcher had a single
eye and a free lesson: when a relative got in front of it, it stayed staring at
it forever. It saw something (so it didn't search), but it wasn't food (so it
didn't hunt it): stuck, spending without advancing. Tournament bots spread out
their gaze: _Russia_ uses eight wide-open eyes for the perimeter and one fine
one for aiming, so no distracted relative blocks off its world. The minimal
version of the fix is to make “I see nothing _or_ I only see family” count the
same.

**Social behavior: don't cannibalize.** In the league your five starting bots
are your team, and a team whose members charge each other loses twice: it loses the energy
and it loses bots. The cheapest way to tell your own apart is the signature in
[[.refeye]] against [[.myeye]] (see [[tutoriales/reconoce-especie]]);
_Russia_, _Teriyaki_ and the searcher further down use it. I measured it with
three copies of _Russia_ (200 cycles) and two of the searcher (400): zero
friendly losses. And there's an extra reason: against a conspecific your venom
and your poison do nothing, so biting it is spending for nothing
([[estrategias/defensivos]]). The counterexample is _Singula_, further down:
it drains whatever it looks at without asking, and its swarm makes it pay for it.

<!-- probado (ajustes de la liga F1, campo 1500x1000): Russia qty 3, nrg 2500, 200 ciclos, 3 vivos, kills 0 en todos; buscador qty 2, 400 ciclos, 2 vivos -->

**Knowing how to refuse a fight.** The rules reward the one who lasts: the round
is won by the last species standing and, at the cycle cap, by the one with the
most bots or the most energy. Always fighting is not a strategy: each shot
costs you 2, the rival absorbs it or not, and against one that absorbs your
blows or wins the exchange, all you're doing is financing your own defeat.
Before biting, look at how it's equipped ([[.refshell]], [[.refpoison]],
[[.refvenom]]): that's what _Paranoia_ does to choose whom to hunt
([[estrategias/defensivos]]). And if the exchange doesn't suit you, don't
accept it: moving away costs the same as moving closer, and in the duel above,
the bot that never fought was ahead.

<!-- competir.md #conceptos (ronda: la gana la última especie; al tope, más bots o más energía nrg + body×10); duelos medidos más arriba; Paranoia: defensivos.md (elige presa según .refshell/.refpoison) -->

## Three with pedigree, verified {#bestiario}

Bestiary names with league wins come cheap: there are real champions and bots
that merely call themselves champion. These three run and do what's said here;
each run used the league settings and no mutations.
<!-- probar-adn.mjs con los ajustes de la liga F1 (opciones.js ajustesF1), sin mutaciones (el harness las trae apagadas); robots F1: Russia_F1_League_By_Spike43884_11-19-2014.txt, Teriyaki_F1_Spike43884_11-05-2014.txt, Singula_Haloculus_2_F1_bacillus_21.04.08.txt -->

### Russia sleeps, Russia charges {#russia}

_Russia_ (`Russia_F1_League_By_Spike43884_11-19-2014.txt`, by Spike43884, Russia
2014 league) is a hunter that waits. Its signature is hibernation: when born
(on the first cycle all the senses read 0) and whenever it sees nothing and
runs short of energy, it shuts down completely and pays 0.31 per cycle; it
wakes as soon as a lateral eye sees something. The gene that shuts it down:

```adn
def hibernate 51

' I sleep if I see nothing (or if it's family) and am low on energy
cond
 *.eye1 0 =
 *.eye2 0 = and
 *.eye3 0 = and
 *.eye4 0 = and
 *.eye5 0 = and
 *.eye6 0 = and
 *.eye7 0 = and
 *.eye8 0 = and
 *.eye9 0 = and
 *.refeye *.myeye = or
 *.nrg 3000 < and
 *.hibernate 0 = and
start
 1 .hibernate store
stop
```

When it sees something, it hunts with a fine sight and a wide periphery, standing next to the
target and stealing its energy with [[.shoot]] at −1. And whoever bites it, it
pays back with venom: the sting writes 128 into the turn every cycle, so the
thief spends its life spinning in circles instead of going on stealing.
Against a lone alga it emptied it in about 20 cycles and went from 3000 to
over 6000. Awake and idle, it veers at random (turning is free) and only
breeds at 20000: each child is a bet that only pays with a full pantry.

<!-- probado (ajustes de la liga F1, campo 1500x1000): Russia vs alga de arranque de la liga (engine/partido.js ALGA_ARRANQUE, nrg 3000): kills=1 al ciclo 20, 3000 → 6085 (los −2 de vuelta llegan un ciclo después de la muerte); re-corrido: kills=1 antes del 20, 3000 → 6055. Russia sola nrg 2500: hibernate=1, quieta, 0,314/ciclo en regimen (0,33 promediando el arranque); nrg 4000: duerme al nacer igual (el primer ciclo lee todo 0) y luego despierta, quieta, 0,354/ciclo. Trio: sin bajas -->

### Teriyaki spits and won't be bitten {#teriyaki}

_Teriyaki_ (`Teriyaki_F1_Spike43884_11-05-2014.txt`, by Spike43884 with a fix
by Shadowgod2) is the opposite: it pays a salary for going around armed. It
maintains 500 of poison with a two-line gene:

```adn
' Doesn't taste like chicken: poison while it's lacking
cond
 *.poison 500 <
start
 50 .strpoison store
stop
```

That costs it about 2.9 per cycle (poison loses 2% per cycle, so replenishing
500 is a permanent expense), but whoever bites it gets the blow back poisoned.
It attacks mixing −1 and −6: the −6 also takes body, so from a single alga
that came in with 3000 and 1000 of body it ended up taking more than 8000.
It shoots sperm at rich relatives and breeds sexually; and if it goes over
100 of waste, it relieves itself by shooting it backwards. A complete bot,
with a complete bot's price: in the duel with _Russia_ it was the one that ran
dry.

<!-- probado (ajustes de la liga F1): Teriyaki sola: poison 0 → ~500 y oscila (505, 500, 497…, rearma a 539), 2,79-2,95/ciclo. Vs alga (campo 1500x1000): alga 3000/1000 → 261/447 y muerta al ~70; Teriyaki 3000 → 11069. El .txt tiene dos avisos del lint (.backshoot y -8!= pegado); los fragmentos citados están limpios -->

### Singula Haloculus 2: one gene and a demographic bomb {#singula}

_Singula Haloculus 2_ (`Singula_Haloculus_2_F1_bacillus_21.04.08.txt`, by
bacillus, 2008) answers why the simplest one sometimes wins: it is _a single
gene_, always on, and it won leagues all the same. It does three things at
once. It breeds without brakes: it asks for a child with more than 200 energy,
and in 30 cycles a single copy had become twelve. It keeps its body small, at
a third of its energy, with the prettiest line in the Bestiary:

```adn
' Body at a third of the energy: surplus, I store; shortfall, I give back
cond
start
 *.nrg 3 div *.body sub dup .strbody store - .fdbody store
stop
```

And it feeds by tying whatever it's looking at and sucking 1000 per cycle out
of it through the tie ([[.tieloc]] at −1, [[.tieval]] at −1000), without
asking what species it is: in a run without food its own swarm drained itself
down to four. The cherry on top: its shot is a memory shot, at the address of
the other's [[.shootval]], and it leaves −32000 written there. A hunter that
charges with −1 and has its .shootval broken kills itself with its own shot:
against _Singula_ the tutorial's hunter woke up with its .shootval at −32000
and didn't get far; and a hunter with its .shootval forced to −32000 fell all
on its own, with the alga target untouched. No wonder its header says it kills
bots that feed by shooting.

<!-- probado (ajustes de la liga F1): Singula sola (campo 9237x6928): 1 → 12 bots al ciclo 30, se estabiliza en ~4 con cuerpo ~nrg/3. Vs cazador del tutorial (campo 1500x1000): el cazador amanece con shootval=-32000 y muere; Singula sobrevive. Cazador con --set shootval=-32000 contra un alga: el cazador muere solo antes del ciclo 25, el alga intacta. La línea del disparo usa floor=max(a,b) para elegir la dirección del store (spec 20-VM §6.4) -->

## Test it before you enter it {#prueba}

Here's a minimal, complete league bot to start from: it searches cheaply,
hunts whatever isn't its species, breeds with a full pantry and doesn't eat its
siblings.

```adn
' Minimal league bot: hunts algae and strangers, doesn't touch its own
cond
 *.robage 0 =
start
 100 .eye5width store
stop

' When I see nothing (or only family): a cheap little nudge
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 5 .up store
stop

' I see a stranger: I close in on it
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 *.refveldx .dx store
 *.refvelup 30 add .up store
stop

' Accompanied by the target up close: I ask it for energy
cond
 *.eye5 50 >
 *.refeye *.myeye !=
start
 *.refveldx .dx store
 *.refvelup .up store
 -1 .shoot store
stop

' With energy to spare, children
cond
 *.nrg 5000 >
start
 50 .repro store
stop
end
```

With the league settings it does what it promises: it searches at 0.34 per
cycle sweeping the whole field, empties an alga in about 60 cycles and with the
gains throws its first child, and two copies together don't cross a single
blow in 400 cycles. Against an ordinary hunter of the same style it holds its
own: it's numbers and breeding. What it lacks is defenses: against an armed
bot it has nothing to say; that's what [[estrategias/defensivos]] is for.

<!-- probado (ajustes de la liga F1): solo (campo 9237x6928) 3000 → 2932,49 en 200 ciclos, cruza el campo de punta a punta. Vs alga (campo 1500x1000): kills=1 al ciclo 60, cría (padre 3444 + hijo 2658) y ambos siguen buscando. Qty 2: 400 ciclos, 2 vivos. Qty 3 vs 1 cazador del tutorial (campo 1500x1000): a los 200 ciclos el cazador en 1283 y los tres arriba, uno ya criado -->

For the real tests, in the app:

- **The F1 match scenario** (in [[app/escenarios]]) gives you the league's
  world with three species inside: seed yours next to them and watch the
  energy in the inspector.
- **Experiment** with the **F1 league** base (and the **F1** costs in the
  panel, [[app/experimentar]]) for your own test bench.
- **Compete**: a ⚡ quick match against Bestiary bots is the entrance exam. If
  a result bugs you, **↻ Replay** runs it again with the same seed and
  **Replay and analyze** opens it as a run in [[app/analizar]] so you can see
  where your energy went. How seeds behave is covered in
  [[tecnico/semillas]].

And remember the fine print of the rulebook: the DNA is frozen when you enter,
so enter the version you want to run, not the one you're about to fix.

## What to try next {#despues}

<!-- competir.md (#conceptos: el Elo histórico acumula de temporada en temporada); opciones.js F1_NOMBRADAS (mutations 0: la liga apaga las mutaciones) -->

- **Enter it and watch the Elo**: a whole season says much more than a single
  match, and the tournament's historical Elo accumulates from season to season
  ([[app/competir]]).
- **Evolve in your workshop, not in the league**: the league switches
  mutations off and freezes the DNA; do the selection yourself in your own
  world, with your own judgment, and enter the winner
  ([[tutoriales/evolucion]]).
- **Give it defenses**: in the league, where whoever can't be bitten lasts for
  free, a well-placed shell or poison pays for itself
  ([[estrategias/defensivos]]).
- **Face it against a swarm**: your tidy bot against the demographic bomb of
  all time ([[estrategias/enjambres]]).
