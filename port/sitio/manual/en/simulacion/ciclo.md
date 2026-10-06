---
titulo: The cycle and the order of actions
resumen: "What the world does in each cycle and in what order, why the senses arrive one cycle late, and how each bot's slot number, dynamic costs and mutation oscillation come into play."
etiquetas: [cycle, phases, order, senses, dynamic costs, mutations]
estado: revisada
---
The simulation moves in discrete steps: the _cycles_. In each one, the world always does the same things in the same order: it lets every bot think, moves the shots, computes forces, moves everyone, carries out what each bot asked for, makes the right bots be born and die, and hands out the sunlight. Understanding that order is half of programming a bot: it explains why what you see always arrives a little late and why what you ask for happens right away.

## The eight phases {#fases}
<!-- 10-CICLO §2 (pasos 10, 12, 14, 16, 19-21), §5 (pasadas P1-P6) -->

One cycle, from end to end:

```
  DNA ─────► senses ────► shots ──► forces ───► movement ──► actions ───► births ─────► the sun
             cleared                and collisions                        and deaths
  (thinks)  └──────────────────────── the world responds ─────────────────────────────────┘
```

| Phase | What happens |
|---|---|
| **DNA** | Every living bot runs its whole DNA, top to bottom. It reads its senses and writes its commands to memory. Corpses don't think. |
| **Senses cleared** | Contact, shot flavors and the data about the bot you were facing are set to 0: what you already read doesn't carry over to the next cycle. The eyes are not cleared here. |
| **Shots** | Shots that were already in flight hit whatever is in front of them and move forward. A hit writes to the memory of the bot that was hit (its flavor, or the value the shot carried). |
| **Forces and collisions** | Upkeep is charged (body, DNA length, age), the forces are added up (friction, gravity, ties, and the thrust you asked for with [[.up]] and friends) and collisions between bots are resolved, which write the contact senses. Ties pass messages to each other. |
| **Movement** | Ties share energy and matter, the bot turns as much as it asked, and all the accumulated forces are applied at once: speed and position change. [[.vel]] and the mass are published. |
| **Actions** | Each bot does what it left requested: it mutates if it's its turn, makes its defenses (shell, slime, venom, poison), shoots, handles chloroplasts and body, and requests reproduction. Then it **looks**: the eyes sweep the world with the positions already moved. At the end it ages and, if it ran out of energy, becomes a corpse or is marked to die. |
| **Births and deaths** | All the requested children are born, and then all the bots marked to die die. |
| **The sun** | The world's chloroplasts are counted, new vegetables are seeded if needed, and the light feeds the ones that photosynthesize. |

The details of each phase are on its own page: [[simulacion/disparos]], [[simulacion/fisica]], [[simulacion/vision]], [[simulacion/reproduccion]], [[simulacion/muerte]] and [[simulacion/cloroplastos]]. The sysvar profiles use these same phase names to say who writes and who clears each address.

## Why you see late and act right away {#atraso}
<!-- 10-CICLO «Flujo de datos de los sentidos entre ciclos»; 21-MEMORIA §0.3 -->

The DNA runs **first** and the world responds **afterwards**. That has two sides.

**The senses arrive one cycle late.** Contact is written in forces and collisions; the eyes, in actions; the flavors, in the shots phase. All of that happens _after_ the DNA, so your DNA in cycle _N_ reads what the world wrote during cycle _N−1_. When a bot sees another one in [[.eye5]], it is seeing it where it was at the end of the previous cycle. The table in [[adn/ejecucion#retraso]] shows it with [[.vel]]: the speed the DNA records is always one step behind the real one.

**Commands are carried out in the same cycle.** What you write to [[.up]], [[.shoot]] or [[.repro]] sits in memory immediately, and the phases that come after read it in that same cycle. On top of that, almost all commands are _consumed_: the phase that carries them out sets them back to 0. This bot reads its own commands before giving them:

```adn
' Reads its own commands before giving them
cond
start
  *.up 50 store
  *.shoot 51 store
  10 .up store
  -1 .shoot store
stop
end
```

Cycle after cycle, 50 and 51 stay at 0, even though the bot always pushes and shoots: the thrust was applied (and [[.up]] was cleared) in movement, and the shot went out (and [[.shoot]] was cleared) in actions, both before the DNA ran again. If you want to repeat a command, you have to give it again every cycle. The [[sysvars/movimiento]] and [[sysvars/disparos]] groups say, sysvar by sysvar, who clears it and when.

Putting the two sides together: a bot that pushes in cycle _N_ has already moved by the end of that cycle, but its DNA only finds out in _N+1_.

### Two more delays {#demoras}
<!-- 10-CICLO §4 (shots quietos hasta el updateshots siguiente), §3 y §6 (recién nacidos) -->

- **A new shot waits one cycle.** The shot is created in the actions phase, but the shots phase of that cycle has already passed: it doesn't move or hit until the next cycle. That's why the order between shooters in the same cycle doesn't matter.
- **A child only thinks in the next cycle.** It is born in births and deaths, when that cycle's DNA has already run. Its first DNA runs in the next cycle, with [[.robage]] at 0.

This bot counts its cycles in position 50 and requests a child when it reaches 3:

```adn
' Counts its DNA cycles and requests a child on the third
cond
start
  *50 1 add 50 store
stop

cond
  *50 3 =
start
  50 .repro store
stop
end
```

| At the end of the cycle | Parent: 50 | Child: 50 | Child: `.robage` |
|---|---|---|---|
| 3 | 3 | 0 (just born) | 0 |
| 4 | 4 | 1 | 1 |
| 5 | 5 | 2 | 2 |

The child is born in cycle 3 but doesn't run its DNA until 4. That's why so many Bestiary bots open with a `*.robage 0 =` gene: it is the gene that runs only once, in the first cycle of life. 4-d_Swarmer, for example, uses it to orient its eyes with [[.eye1dir]] and friends.

## The order between bots {#orden-entre-bots}
<!-- 10-CICLO §0 (efectos de orden 1-5 y lo que no depende del orden), §6 (posto) -->

Each bot has a numbered _slot_ in the world, and within each phase the engine goes through them in order, from slot 1 onward, changing the state as it goes. Each phase finishes with all the bots before the next one starts: the number matters _within_ a phase, not between phases.

For your DNA this is barely noticeable, because while a bot thinks it only touches its own memory and its own energy. What does depend on the order:

| What | How the number matters |
|---|---|
| Random numbers | There is a single generator for the whole world. What [[op:rnd]] gives you depends on how many numbers were drawn before you, in your DNA or in others', and every birth or death shifts that count. |
| Collisions | Each pair of bots is resolved once, when the engine reaches the lower-numbered one, and pushes both right then. The higher-numbered one gets the push before computing its own forces. |
| Ties | Messages through ties are written straight into the other bot's memory ([[simulacion/lazos]]). In a chain of tied bots, whether a value advances one link or several in the same cycle depends on each bot's number. |
| Vision | When they look, everyone is already in their final position; but the lower-numbered ones have already done their actions for the cycle (shot, changed shell or body) and the higher-numbered ones haven't yet. |
| Births | Children are created in the order of their parents and each one takes the lowest free slot. Low-numbered parents get low slots for their children. |

## Births and deaths: births come first {#nacimientos-y-muertes}
<!-- 10-CICLO §6 (ReproduceAndKill: primero rep, después kil; muertes inmediatas P2/P4); port/README A1-5, A1-7 -->

During actions, bots only _request_: reproducing or dying are noted down in two lists. In the births and deaths phase, the whole list of births is processed first and then the whole list of deaths. Two rules follow from that:

- **A bot that dies this cycle can still have its child.** If in the same cycle it requested reproduction and ran out of energy, the child is born and then the parent dies.
- **A child never takes the slot of a bot that dies in the same cycle**: the deaths come afterwards.

Not all deaths wait for this phase: a corpse that has run out of body disappears right after forces and collisions finishes, before movement ([[simulacion/muerte]]).

:::nota
In the original DarwinBots a bot could be noted down twice in the same cycle, once to reproduce alone and once with a partner. In the port it is noted down only once: if sexual reproduction goes ahead, asexual reproduction waits.
:::

## Where energy is paid {#energia}
<!-- 31-ENERGIA §0.2 y §1 (libro mayor por fase) -->

Expenses have their phase too: instructions are charged while the DNA runs, upkeep and thrust in forces and collisions, turning in movement, defenses and shots in actions, DNA copying in births and deaths, and photosynthesis comes in with the sun. Between one phase and the next the energy can go negative; only in actions is it decided whether the bot ran out of it. The full table is in [[simulacion/energia#por-fase]], and all the prices are multiplied by the [[param:cost:54]].

## Dynamic costs: the price follows the population {#costos-dinamicos}
<!-- 10-CICLO §2 pasos 6-7; core master.hpp DynamicCostsStep (cero-costes fuera del gate) -->

Before the DNA runs, the engine can adjust the [[param:cost:54]] to steer the population toward a target. It is turned on with [[param:cost:56]] and configured in [[app/parametros-costos-dinamicos]].

The population that counts is the bots that aren't vegetables (with [[param:cost:61]], vegetables too), according to the engine's latest count. In each cycle:

- If the population is above the [[param:cost:53]] plus its [[param:cost:57]] and has also grown compared with about a hundred cycles ago, the multiplier **goes up**: life gets more expensive.
- If it is below the target minus its [[param:cost:58]] and has also dropped, the multiplier **goes down**.
- If the population has sat at exactly the same value as a hundred cycles ago for ten cycles, it is adjusted anyway, even if it neither grows nor drops.
- Inside the band, nothing changes.

Each adjustment is small: 0.0000001 × (bots outside the band) × [[param:cost:55]]. With the target at 100, margins at 0, sensitivity at 50 and 200 bots, the multiplier goes up 0.0005 per cycle: half a point every thousand cycles. It's a slow thermostat, meant for long runs. The multiplier doesn't go below 0 unless you turn on [[param:cost:62]].

Separately there is an emergency brake that works even when the adjustment is off: if the population falls below [[param:cost:52]], the multiplier goes to 0 (nothing costs anything) until the population exceeds [[param:cost:59]], and then the value it had comes back. With −1 in the first one, the brake never kicks in.

Since the adjustment is made at the start of the cycle, that same cycle's DNA already pays the new price. A bot has no direct way to read the multiplier: it notices it in how fast its [[.nrg]] drops.

## The oscillation of the mutations {#oscilacion}
<!-- 10-CICLO §2 paso 4; 40-MUTACIONES (rate/MutCurrMult); core master.hpp paso 4, sim.hpp MutOscill=false -->

Also at the start of the cycle, the engine can raise and lower the mutation rates of all the bots at once, alternating periods of lots of change with periods of calm. The oscillation has two stretches that repeat: a _rise_ of a certain number of cycles and a _fall_ of another.

- **Stepped**: during the rise stretch mutations are 16 times more likely than each rate says; during the fall stretch, 16 times less likely.
- **Wave**: the factor goes from 1 up to 20 and back to 1 over the rise stretch, and from 1 down to 1/20 and back to 1 over the fall stretch.

Each bot's heritable rates don't change: the factor is applied on top, at the moment each mutation is drawn ([[simulacion/mutaciones]]).

The oscillation is off by default and the app has no control to turn it on: it only acts if you load a saved simulation that has it turned on.

## At the end of the cycle {#cierre}
<!-- 10-CICLO §2 pasos 18-21 y 24, §8; port/README A1-3 -->

There are two more things that aren't bot phases. Between births and deaths and the sun, the shapes and teleporters move ([[simulacion/mundo]]). And after the sun there is a safety rule: if the sum of the lengths of all the genomes in the world goes over 4 million instructions, the engine eliminates, all at once, a batch of the poorest bots (those with the least energy plus ten times their body), a bigger batch the more bots there are. It only happens with huge populations of very long genomes, but it is real pressure against weak bots in long evolution runs.
