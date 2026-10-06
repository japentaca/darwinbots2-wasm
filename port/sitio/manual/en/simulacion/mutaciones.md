---
titulo: Mutations
resumen: "How DNA changes by chance, during life and at birth: the mutation types, what they do to instructions, how to read the rates, and how to turn them on or off."
etiquetas: [mutations, evolution, rates, inheritance, mrepro]
estado: revisada
---
Mutations are the engine of evolution: random changes to the DNA that get
passed on to the children. Most of them break something, some change nothing
you can notice, and every once in a while one comes out better than the
original. If that bot leaves more children than its neighbors, the change
stays.

In DarwinBots the DNA changes at two moments: **during life**, little by
little, and **at birth**, when the parent's DNA is copied (or mixed, in sexual
reproduction) for the child.

## Who mutates {#quien-muta}
<!-- 40-MUTACIONES §1 (gates: Mutables.Mutations por bot y DisableMutations global); core mutations.hpp mutate; dbcore_api.cpp db_sim_add_species (SetDefaultMutationRates y Mutations = True, como OptionsForm.frm:3290-3296) -->

For a bot to mutate, two things have to hold:

1. **The simulation's mutations are on**: this is the app's
   [[param:base:mutations]] switch. With it off, nobody mutates, no matter
   what.
2. **The bot's own mutation table is on.** Every bot carries a table with a
   rate for each mutation type, which it inherits from its parent. A type
   with rate 0 never happens.

The app seeds every species with the table on and the factory rates
([[simulacion/mutaciones#tasas|see below]]), so in practice the switch is all
you need. An off table, or one with rates at 0, only shows up in the bots of a
saved simulation that came with it that way.

## The mutation types {#tipos}
<!-- 40-MUTACIONES §0.1 (dos familias y orden al nacer), §2, §3; core bot.hpp SetDefaultLengths; sunbelt apagado (sim.hpp) -->

| Type | When | What it does to the DNA | Typical span |
|---|---|---|---|
| Point | During life | Changes a short run of instructions | 3 (± 1) |
| Delta | During life | Doesn't touch the DNA: changes one of the bot's own rates | — |
| Copy error | At birth | Changes instructions | 1 |
| Insertion | At birth | Adds new instructions | 1 |
| Inversion | At birth | Reverses the order of a run | 3 (± 1) |
| Major deletion | At birth | Deletes a run | 3 (± 1) |
| Minor deletion | At birth | Deletes one instruction | 1 |

The _typical span_ is how many instructions each mutation touches: the engine
draws it around that value. The birth mutations are applied in the order of
the table, one pass of each type over the child's DNA. The during-life ones run
in the actions phase of every cycle (see [[simulacion/ciclo#fases]]).

The major and minor deletions are the same mechanism with a different span.

The engine has four more types that come switched off and that the app doesn't
turn on: a second point mutation, a second copy error, _translocation_ (moves
a run to another place in the DNA) and _amplification_ (duplicates it).

## What happens to an instruction {#que-cambia}
<!-- 40-MUTACIONES §4 (ChangeDNA: 80 % valor / 20 % tipo; saltos Gauss 94 y 7; |v| > 1000 escala v/10; comandos Random(1, Max) del mismo tipo), §0.4, §0.5 (end intocable; debugint/debugbool no se crean) -->

The point mutation and the copy error change instructions one by one. With the
factory settings, out of every five changes four touch the **value** and one
the **type**:

- **Changing the value of a number** (or of a read such as `*50`): shifts it a
  little. Half the time it's a big jump (a few tens or a couple of hundred)
  and the other half a small tweak of a few units. A number above 1000 moves
  in proportion: about 10%.
- **Changing the value of a command**: replaces it with another one from the
  same family. One operator for another operator ([[op:add]] for [[op:mult]],
  for example), one comparison for another, a `start` for a `cond`.
- **Changing the type**: the instruction becomes a different kind. A number
  becomes an operator, a comparison becomes a number, a read such as `*.nrg`
  becomes a store.

Since addresses are numbers, a value mutation on `.up` can leave you writing
to a different address: `10 .up store` turns into `10 .dn store`, or into a
number that isn't a sysvar and ends up as free memory.

There are two things no mutation does: touch the [[op:end]] that closes the DNA
and create a new one.

We saw these changes happen in children of a one-gene bot, starting from
`cond *.robage 5 > start … stop`:

```
cond *.robage 5 > 291 start …   insertion: a loose number before start
cond *.robage > start …         minor deletion: the 5 is gone
cond > 5 *.robage start …       inversion of the run “*.robage 5 >”
cond *.robage 5 > … stop        deletion of the start: the body became a condition
```

The last one is a good example of a lethal mutation: without `start`, the
gene's stores end up in the condition section and write nothing (see
[[adn/genes]]). That bot no longer reproduces.

## The rates {#tasas}
<!-- 40-MUTACIONES §0.2 (agenda geométrica 1/(1000·rate) para Point; Bernoulli 1/rate por token al nacer; DeltaMut 1/(100·rate)); core bot.hpp SetDefaultMutationRates (5000), que usa db_sim_add_species -->

Each rate is a number _N_ that reads as “**one in _N_**”: the bigger it is, the
rarer the mutation. The factory value is 5000 for all types, and it's what the
species the app seeds get.

| Type | Probability |
|---|---|
| Birth | One in _N_ per instruction of the DNA, at every birth, for each type. |
| Point | One in 1000 × _N_ per instruction, in every cycle of life. |
| Delta | One in 100 × _N_ per cycle of life. |

With the rates at 5000 and a 100-instruction DNA:

- Each birth type has a 2% chance of touching the child; adding up the five,
  about one child in ten is born with some change.
- A point mutation hits the bot about every 50000 cycles of life. During life
  almost nothing changes: evolution happens through births.

A longer DNA mutates more, because there are more instructions to draw on.

The rates are inherited, and the _delta_ mutation keeps moving them: when it
happens, it picks a type at random and changes its rate by a few hundred up or
down. That way a lineage can become more stable or more changeable over time.

:::nota
There's also a safety cap: with a very long DNA, the engine won't let a rate
drop below a certain value, proportional to the length, so that a giant bot
doesn't mutate on almost every instruction. In the original DarwinBots that cap
was written into the bot's table and inherited, so long lineages kept drifting
toward it. In the port it's applied on the spot and the table stays as it was.
:::

## Reproduce to explore: .mrepro {#mrepro}
<!-- 36-REPRO §2 (sin Delta2: tasas ÷10, 0 → 1000, Mutations forzado solo para ese parto); core robots.hpp Reproduce; comprobado con las tasas de fábrica y un ADN de 20 instrucciones, 3 semillas: .repro 5 a 7 hijos mutantes de unos 360, .mrepro 57 a 61 de unos 330, y 0 con las mutaciones apagadas -->

[[.mrepro]] works like [[.repro]], but the child is born with the mutation
table **divided by 10** for that birth only: each birth type is ten times more
likely. A type with rate 0 becomes 1000. The child also mutates even if its
table was off; the only thing that prevents it is turning off
[[param:base:mutations]].

After the birth the child goes back to the inherited table: during life it
mutates like its parent, and so do its own children born with [[.repro]].

With the factory rates, in a population of 20-instruction bots, about 1 child
in 60 was born with some change when reproducing with [[.repro]], and almost 1
in 5 with [[.mrepro]].

The idea is to save [[.mrepro]] for when it pays to try new things. The
Bestiary's Animal_Minimalis_mod_stress reproduces with [[.repro]] under normal
conditions and with [[.mrepro]] when it's in trouble. A minimal version, which
explores if it's been losing energy ([[.pain]]):

```adn
' If it has been losing energy, explore; otherwise, copy itself
cond
 *.nrg 4000 >
 *.pain 0 >
start
 33 .mrepro store
stop
cond
 *.nrg 4000 >
 *.pain 1 <
start
 33 .repro store
stop
```

## What else changes when a bot mutates {#efectos}
<!-- 40-MUTACIONES §1 (mutatecolors, NewSubSpecies, DnaLen/genenum, mem 336/339); port/README B6-7, B6-9 -->

- **The color**: each mutation shifts one of the three color channels a
  little, so mutating lineages gradually become distinguishable by eye.
- **The subspecies**: the bot becomes a new subspecies within its species (see
  [[simulacion/especies]]).
- **[[.dnalen]] and [[.genes]]** are updated on the spot.
- **The DNA signature** that [[sysvars/my|the my* sysvars]] read, and that
  others see with [[.refeye]], [[.refshoot]] and company, is rebuilt on the
  spot.
- **The mutation counter** of the bot goes up, and the child inherits it.

:::nota
Two differences from the original. There, a mutation during life didn't
rebuild the DNA signature: what others saw stayed the same as before until the
next birth. And an insertion counted two mutations per instruction added; in
the port it counts one.
:::

## The oscillation {#oscilacion}
<!-- 10-CICLO §2 paso 4; core master.hpp (MutOscill en false) -->

The engine can multiply the probabilities of all bots at once, alternating
periods of heavy change with periods of calm: up to 16 or 20 times more
mutations on the way up and as many times fewer on the way down. The
inheritable rates don't change; the factor is applied on top, at the moment of
each draw. It comes switched off and the app has no control to turn it on. The
details are in [[simulacion/ciclo#oscilacion]].

## How to turn them on and off {#encender}
<!-- opciones.js base:mutations (DisableMutations); 36-REPRO §2; sim.hpp (Delta2, epireset, EnableAutoSpeciation en false) -->

| You want | Do this |
|---|---|
| Nobody to mutate | Turn off [[param:base:mutations]]. It's the only way to stop [[.mrepro]] as well. |
| The children the bot picks to mutate more | Use [[.repro]] for the normal birth and [[.mrepro]] to explore: those children mutate ten times more. |
| Different children without mutations | Use sexual reproduction: the mixing already varies the DNA. |

The engine also has three mechanisms that come switched off and that the app
doesn't offer: an alternative regime in which each child's rates drift at
random at every birth, _self-speciation_ (a bot that has accumulated many
mutations founds a new species under another name) and the _epigenetic reset_
(a heavily mutated lineage stops inheriting the genetic memory, see
[[adn/memoria#memoria-genetica]]).
