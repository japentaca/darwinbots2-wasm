---
titulo: Death and corpses
resumen: "When a bot dies (out of energy, out of body, from a shot, from shock or from memory pressure), what a corpse is, how it decays and what happens to its ties."
etiquetas: [death, corpse, energy, decay, ties]
estado: revisada
---
In DarwinBots there is no old age or disease: a bot dies because it runs out of
something. Almost always it is energy; sometimes the body, a shot that empties it
all at once, or a rule of the world that prunes the population. What is left
depends on how it died and on the configuration: a _corpse_ that stays around as
food, or nothing.

This page describes the causes of death, at what point in the cycle they happen,
what a corpse is and how it disappears.

## The causes {#causas}
<!-- 31-ENERGIA §1 (ManageDeath, Shock); 33-SHOTS §5 (-1/-6: Dead); 10-CICLO §5 P4, §6, §8; core robots.hpp ManageDeath, UpdateCounters; port/README A1-1, A1-3; probado: alcancia.txt con y sin opt:50, cazador.txt contra quieto.txt, shock.txt -->

| Cause | When | Leaves a corpse? |
|---|---|---|
| Out of energy | [[.nrg]] below 15, with [[param:opt:50]] on; below 0.5 if it is off | Yes, if corpses are turned on |
| Out of body | [[.body]] below 0.5 | No |
| A shot that empties it | an energy (−1) or body (−6) shot leaves it with 0.5 or less of energy or body | No |
| Shock | it loses more than half its energy in one cycle and still has more than 3000 left | Yes: the energy it had left goes to the body |
| Memory pressure | the DNA of the whole world together goes over 4 million words | No |

### Out of energy {#sin-energia}

This is everyday death. Everything costs energy (see
[[simulacion/energia]]), and the accounting has no floor: within a cycle the
energy can end up negative, even though your DNA never reads a number below 0. At
the end of the cycle, if it ended up below 15, the bot turns into a corpse.

This bot moves its energy into its body 100 per cycle with [[.strbody]], without
checking how much it has left:

```adn
' Moves all its energy into its body, 100 per cycle
cond
start
 100 .strbody store
stop
end
```

Seeded with 350 energy, it ends cycle 3 with 50 and cycle 4 with −50: in that
cycle it turns into a corpse, with 1040 of body. If [[param:opt:50]] is off, in that
same cycle 4 it disappears without leaving anything.

### Out of body {#sin-cuerpo}

A living bot whose body drops below 0.5 dies even if it has plenty of energy, and
it leaves no corpse: there is nothing to leave.

### Killed by a shot {#muerto-por-un-disparo}

When an energy or body shot leaves the victim with 0.5 or less of energy or body,
the engine marks it as dead, adds one death to the shooter's [[.kills]] and, at the
end of the cycle, removes it from the world **without a corpse**. In one test, a
hunter that approached a motionless bot with 300 energy firing −1 landed two shots
on it in the same cycle: the first took 198 from it and the second, the rest. The
bot disappeared in that cycle and the hunter was left with `.kills` at 1.
<!-- comprobado con probar-adn: quieto.txt (300 de energía) contra cazador.txt, campo 1500x1500, opt:50=1: muere en el ciclo 20 y el cazador gana 305,8 = 0,95·(220 + 102) -->

A bot that is left thin but above that line (between 0.5 and 15 of energy) does
end up as a corpse at the end of the cycle.

### Shock {#shock}

If a bot that isn't a vegetable loses more than half of the energy it had in a
single cycle, and still has more than 3000 left, it suffers a _shock_: all the
energy it had left is moved into its body, at a rate of 10 to 1, and it is left at
0. Since that leaves it below 15, it turns into a corpse in the same cycle. A bot
with 20000 energy that spends 12000 at once on a shot ends up as a corpse with 1800
of body (it had 1000, plus 8000 / 10). How it worked in the original, and another
example, in [[simulacion/energia#shock]].

### No old age and no giants {#ni-vejez-ni-gigantismo}

There is no maximum age. What there can be is a cost per age, which grows with
[[.robage]] and ends up starving the bot: [[param:cost:31]], starting from
[[param:cost:32]] cycles of life, constant, logarithmic ([[param:cost:51]]) or
linear ([[param:cost:60]], with slope [[param:cost:33]]).

The code also has a rule for killing giants (an enormous body with few
chloroplasts, or more than five victims), but its threshold is a body greater than
32100, and the body never goes over 32000: in practice it never fires, in the
original or in the port.

## Memory pressure {#memoria}
<!-- 10-CICLO §8; core master.hpp MemoryPressureKill; port/README A1-3 -->

The last step of each cycle adds up the DNA length of all the bots in the world,
corpses included. If it goes over 4,000,000 words, the engine kills the poorest
ones in one go: it looks for the bot with the least energy plus ten times its body,
removes it, and repeats. How many depends on the population and the average DNA
length: with an average DNA of 425 words it is about 1500, and fewer if the average
DNA is longer.

It is a rule so that the simulation doesn't run out of memory, but it is also
selective pressure: in a huge world it punishes the poor just when the
population's genome grows. It happens in very populated, long simulations, with
thousands of bots.

## At what point in the cycle {#momento}
<!-- 10-CICLO §5 (P2, P5 ManageDeath, P6 ReproduceAndKill), §6 consecuencias; port/README «Conservados» A1-7 -->

The phases of the cycle (see [[simulacion/ciclo]]) are: DNA → senses cleared →
shots → forces and collisions → movement → actions → births and deaths → the sun.
Death touches several of them:

- **Shots** mark the victim they empty as dead, but don't remove it yet.
- At the end of **actions**, every living bot ages one cycle and is checked: if it
  has less than 15 energy it turns into a corpse, and if it is marked as dead (or
  has no body) it is put on the list to leave.
- In **births and deaths**, first all the cycle's children are born and then all
  the dead leave.

Something unintuitive follows from this: a bot that dies in this cycle **can still
have a child**, because its reproduction request is handled before its death. A bot
marked by a shot even runs its actions for that cycle (it shoots, it reproduces)
before leaving. It is the same in the original, and evolved bots were able to take
advantage of it.

A corpse leaves the world when its body reaches 0, in the count that is done
between forces and collisions and movement: in the same cycle if it was finished
off by being eaten with a shot, or in the next one if it ran out through decay or
through a tie.
<!-- core robots.hpp UpdateCounters (P2: corpse con body <= 0 → KillRobot; si no, Decay), ManageDeath no corre para cadáveres -->

## Corpses {#cadaveres}
<!-- core robots.hpp ManageDeath (Corpse: FName, occurr, DisableDNA, CantSee, VirusImmune, chloroplasts 0, ojos a 0); 30-FISICA §9.5 (colisionan); 32-VISION §2 notas; 33-SHOTS §5 (solo −6 afecta a corpses; ×4) -->

A corpse is a bot that has stopped living but is still in the world. It keeps its
body, its position, its velocity and its ties, and loses everything else:

- It doesn't run its DNA, doesn't move on its own, doesn't see (its eyes are left
  at 0) and doesn't age.
- It is left with 0 energy and no chloroplasts. If it was a vegetable, it stops
  being one: the sun no longer feeds it.
- It is named `Corpse`: it doesn't count toward its species' population (see
  [[.totalmyspecies]]) and viruses don't infect it.
- It is still a physical body: it collides, it is pushed and gravity drags it.

The others see it like any bot. [[.refbody]] brings its real body, but [[.refnrg]]
is 0 and so is its whole signature ([[.refeye]] and company): facing a corpse,
`*.refeye *.myeye !=` gives true, as if it were another species (see
[[sysvars/my]]).

### Eating a corpse {#comerse-un-cadaver}

What a corpse is worth is its body, and the only way to take it is through the
body: with −6 shots (see [[.shoot]]), which against a corpse yield four times more
than against a living bot, or by sucking body out of it through a tie (see
[[simulacion/lazos]]). An energy shot (−1) takes nothing from it, because it has no
energy left.

_Ursus Detrivoris_, from the Bestiary, has a gene for that, commented “eat
corpses (or harmless bots)”: if what it sees doesn't shoot (its [[.refshoot]] is
0, like the signature of every corpse), it shoots at the body.
<!-- Ursus_Detrivoris_F2_Jerry_-07.05.04.txt, gen «eat corpses» -->

```adn
' Eats corpses (or harmless bots)
cond
 *.eye5 30 >
 *.refshoot 1 <
start
 -6 .shoot store
stop
```

## Decay {#descomposicion}
<!-- 33-SHOTS §5 (Decay); core robots.hpp Decay (body -= Decay/10, shot de min(Decay, body)); probado: alcancia.txt con opt:51=1000, opt:52=2 -->

If nobody eats it, a corpse can rot. Three parameters regulate it:

| Parameter | What it does |
|---|---|
| [[param:opt:51]] | How much it decays at each step. The corpse loses **a tenth** of this value in body. |
| [[param:opt:52]] | Every how many cycles it takes a step. |
| [[param:opt:53]] | Whether at each step it releases a shot, in a random direction: waste (−4) or energy (−2), with the value of the decay parameter (or the body it has left, if that is less). |

With decay 1000 and a pause of 2 cycles, the corpse from the first example loses
100 of body every two cycles: it goes from 1040 to 40 in about twenty cycles and
disappears shortly after. With the “energy shot” type, each step is also a small
ration that anyone passing nearby can eat; with the “waste shot” type, it dirties
the neighbors.

The default value of decay is 0: **corpses don't rot** and stay in the world until
someone eats them.

## Ties {#lazos}
<!-- core robots.hpp KillRobot (delallties) y ManageDeath (no toca las ties); probado: madre.txt con opt:51=2000, opt:52=1 -->

Turning into a corpse doesn't cut ties: the bot that was tied stays tied, and can
keep taking body out of it that way. Ties are cut when the bot leaves the world,
whether it is a living bot that dies without a corpse or a corpse that ran out of
body; at that moment the partner loses them and its [[.numties]] goes down.

In this bot the mother has a daughter at 3 cycles (who is born tied to her) and
then lets herself die; the daughter, since she already has a tie, does nothing:

```adn
' The mother has a daughter at 3 cycles and then lets herself die;
' the daughter is born tied to her and does nothing
cond
 *.robage 3 =
 *.numties 0 =
start
 50 .repro store
 1 50 store
stop
cond
 *50 1 =
start
 100 .strbody store
stop
end
```

With 1000 energy at the start, the mother is a corpse in cycle 9 and the daughter
keeps reading `.numties` at 1. With fast decay (2000, no pause), the corpse is used
up in cycle 13 and from then on the daughter reads 0.

When a bot leaves the world, the virus it had stored for shooting is also lost (see
[[simulacion/virus]]). Its shots that are already in flight, on the other hand,
keep going on their way.

## The parameters {#parametros}
<!-- engine/opciones.js opt:50-53, opt:111-112, cost:31-33/51/60 -->

| Parameter | What for |
|---|---|
| [[param:opt:50]] | Whether those that starve are left as corpses. |
| [[param:opt:51]], [[param:opt:52]], [[param:opt:53]] | Decay. |
| [[param:cost:31]] and the other costs per age | Death from old age, if you want it. |
| [[param:opt:111]], [[param:opt:112]] | Saving a profile of every bot that dies. |

In the world view the corpses are counted separately; in Analyze (see
[[app/analizar]]) there is a chart of corpses and another of bots with and without
them.
