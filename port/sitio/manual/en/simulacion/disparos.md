---
titulo: Shots
resumen: "How a shot is born, how far it travels, who it hits, and what each type does on arrival: steal energy or body, give, poison, dirty, fertilize or write to the other bot's memory."
etiquetas: [shots, attack, energy, senses, range]
estado: revisada
---
A shot is a particle that a bot throws forward and that travels on its own through
the world until it hits another bot or runs out of range. It is how almost every bot
that isn't a vegetable eats, and also how they attack, give away energy, paralyze or
write to another bot's memory. This page explains the mechanism from end to end; the
sysvars that handle it are in [[sysvars/disparos]].

## From .shoot to the shot {#crear}
<!-- 33-SHOTS §2.1-2.2; 10-CICLO §0 (shots creados en P5 no se mueven hasta el updateshots siguiente), §5 P5 Shooting; core shots.hpp robshoot/newshot (Random(-20,20)/200 rad; pos + dir·radius; actvel + dir·40) -->

The DNA requests a shot by writing a number other than 0 to [[.shoot]]. The engine
launches it later, in the _actions_ phase of that same cycle, and sets `.shoot` and
[[.shootval]] back to 0. The shot is born at the edge of the bot, on the side it
faces ([[.aim]]), and goes out:

- with a small random deviation, up to 20 angle units (about 6 degrees) to each
  side;
- at 40 units per cycle, plus the speed the bot itself was carrying;
- backward if [[.backshot]] was set, or deflected if you wrote
  [[.aimshoot]].

A newly created shot doesn't move in the cycle in which it is born: it starts in the
_shots_ phase of the next cycle. If your energy is 0 or less, nothing goes out.

Each type has a different cost. All of them use the scenario's
[[param:cost:23|cost of shooting]], multiplied, like all costs, by the
[[param:cost:54]]:

| Shot | What the shooter pays |
|---|---|
| −1 and −6 (steal) | the cost of shooting, divided by the number of ties plus one |
| −1 and −6 with [[.shootval]] greater than 4 or less than −4 | that value multiplied by the cost of shooting |
| −2 (gift) | what it gives away, plus the cost of shooting divided by ties plus one |
| −3 and −4 (venom and waste) | the cost of shooting divided by ties plus one; the venom or waste comes out of its reserve |
| positive (memory) and −8 (sperm) | the whole cost of shooting |

## How far it travels {#alcance}
<!-- 33-SHOTS §2.2 (vbody > 10: nrg = Log(vbody)·60·rngmult, Range = (nrg+41)\40, nrg = Range·40; si no, Range = rngmult), §3.4 y §3.7 (decaimiento Atn; muere con age > Range); core shots.hpp newshot/updateshots; constants.yaml radio(1000 body) ≈ 114 -->

Range is measured in cycles of flight and depends on the shooter's body (in a tied
organism, on the body of the whole organism; see [[simulacion/lazos]]). It grows
slowly, like a logarithm:

| Shooter's body | Cycles of flight | Approximate distance from its edge |
|---|---|---|
| 10 or less | 1 | 40 |
| 100 | 7 | 280 |
| 1000 | 11 | 440 |
| 5000 | 13 | 520 |
| 32000 | 16 | 640 |

A negative [[.shootval]] on a −1 or −6 shot stretches the range: −8 doubles it and
−16 triples it, and it is charged as shown in the table above.

The shot doesn't hit equally hard along the whole path. While it flies it loses
force, very little at the start and suddenly at the end:

| Part of the path already covered | Force it has left |
|---|---|
| half | 98% |
| 80% | 94% |
| 90% | 86% |
| the last cycle | none |

So at exactly the edge of the range the shot arrives with no force: it pays to shoot
at what is close. The energy gift (−2) can be exempted with [[param:opt:54]] and the
waste shot (−4) with [[param:opt:55]].

:::nota
With 1000 body, in a test with the shooter standing still, targets about 500 units
away center to center lost energy on every shot, and those more than 800 away showed
up in [[.eye5]] but received nothing. To measure the distance, add the radii: a bot
with 1000 body is about 114 across.
:::

At the edges, a shot passes to the other side if the world is toroidal and bounces
if there is a wall. It bounces off a shape too, unless the scenario has
[[param:opt:82]]. Shots don't collide with each other.

## How it hits {#impacto}
<!-- 33-SHOTS §3 (orden por shot: colisión antes de mover, flash, muerte por edad), §4 (swept-sphere, dentro en t=0); README B3-1, B3-2, B3-5; core shots.hpp ShotFromBot, NewShotCollision, updateshots (inmunidad filial age <= 1) -->

In the _shots_ phase of each cycle, the engine looks at the stretch each shot is
about to cover in that cycle and finds the first bot it crosses along it. If there
is one, the shot hits it right there, takes effect and disappears. If not, it
moves on and ages one cycle; when it exceeds its range, it vanishes.

Some rules about who it hits:

- **Never the one that shot it**, as long as that bot is still alive.
- **Any other bot, your own species included.** There is no friendly-fire protection: a
  −1 on a sibling steals its energy all the same.
- **Not the shooter's newborn child**, during its first two cycles of life: that way
  a parent that is shooting doesn't hit the offspring it just had.
- **Yes, corpses.** The shot is used up all the same, even though almost no type
  does anything to a corpse (see below).

:::nota
In the original DarwinBots 2.48.32, the newborn protection compared the bots'
numbers wrongly and almost never worked; the shots of a dead bot, besides, couldn't
hit the bot that took its place in the list; and if two bots crossed in the same
stretch, the one earlier in the list won, not the one that was closer. The port fixes
all three: the protection works, any orphan shot hits, and the earliest hit wins. See
[[tecnico/diferencias]].
:::

## What each type does {#tipos}
<!-- 33-SHOTS §5 (tabla take*/release*, power = value·nrg/(Range·40)), §2.1; core shots.hpp releasenrg/takenrg/releasebod/takewaste/takesperm/takeven/takepoison; probado: tira.txt contra blanco.txt (-198 nrg y -2.2 body; +209 nrg y +0.88 body), tira6.txt (-102 nrg, -40.8 body; +484.5) -->

Each shot goes out with a _value_ (the force it was thrown with) and arrives with
that value reduced by what it lost on the way. We call that the _force of the hit_.

### −1: steal energy {#energia}

The value is 20 plus a fifth of the shooter's body: with 1000 body, 220. A
[[.shootval]] of 8 doubles it, of 16 triples it (between −4 and 4 it changes
nothing). When it hits a living bot:

- the victim loses 90% of the force in energy and 1% in body;
- from the point of the hit, a gift shot (−2) with the full force comes out, back
  toward the shooter, and with double the range.

That gift coming back is the food. If another bot crosses its path, that bot eats it
instead. When it arrives it is shared out like any −2 (see below). In the test, with
1000 body, the target lost 198 energy and 2.2 body, and the shooter gained 209
energy and 0.88 body.

If the victim doesn't have enough energy, it loses all it has and the gift goes out
with that. If it is left with 0.5 of energy or body, it dies, and the shooter adds a
death to [[.kills]]. A −1 takes nothing from a corpse, which no longer has energy.

If the victim has a lot of poison, poison goes out toward the shooter instead of a
gift: see [[simulacion/defensas#toxina]].

### −6: steal body {#cuerpo}

The value is 10 plus half the shooter's body (510 with 1000 body), with the same
[[.shootval]] as the −1. The victim's shell stops it first (see
[[simulacion/defensas#caparazon]]). What happens:

- from a living bot it takes 20% of the force in energy and 8% in body (if one
  isn't enough, the other pays the difference);
- it hits a corpse with four times the force and everything comes out of its body;
- in both cases a gift with the full force goes back toward the shooter.

It is the most profitable shot and the one for eating corpses. In the test, against
a target with 1000 body and no shell, the target lost 102 energy and 40.8 body and
the shooter gained 484.5 energy.

### −2: give energy {#regalo}

The shooter sends whatever [[.shootval]] says (unsigned and never more than it has;
with 0, 1% of its energy). The receiver keeps 95% as energy, a little more as body
(the equivalent of 4%) and 1% turns into waste. If it goes over 32000 energy, 10% of
the excess goes to the body. Corpses can't make use of it.

### −3: venom {#veneno}

It sends venom from the shooter's reserve ([[.venom]]): whatever [[.shootval]]
says, or a twentieth if it is 0. It paralyzes the victim and makes it write to its
memory what you chose. The whole mechanism is in
[[simulacion/defensas#veneno]].

### −4: waste {#desechos}

It sends waste: whatever [[.shootval]] says (unsigned, up to what you have) or a
twentieth of your [[.waste]] if it is 0. The shooter gets rid of 99% of what it
sends: 1% stays in its [[.waste]] and, besides, another 1% goes to its
[[.pwaste]], which can't be thrown away. The victim adds the force of the hit to its
waste, up to 32000.
<!-- core robshoot −4: Waste −= 0,99·value; Pwaste += value/100; takewaste con tope 32000 (port/README B3-6) --> More waste than it can handle
writes garbage into its memory (see [[simulacion/energia]]). The engine also expels waste
this way on its own when a bot has too much.

### −8: sperm {#esperma}

It carries a copy of the shooter's DNA. On hitting, it leaves the victim fertilized
for about 10 cycles ([[.fertilized]]) with that DNA, ready for sexual
reproduction; if it was already fertilized, the new DNA replaces the old one. See
[[simulacion/reproduccion]].

### Positive: write to memory {#memoria}

A positive number in `.shoot` is an address: the shot writes your
[[.shootval]] to that address in the victim's memory. It is taken modulo
1000 (1050 writes to 50), 340 ([[.delgene]]) is protected and an exact
multiple of 1000 gives a sperm shot. What is written stays in the other bot's
memory, and its DNA reads it in the next cycle.

Poison stops it: if the victim has at least half the shot's energy in
[[.poison]] (220 for a shooter with 1000 body), nothing is written and poison goes
out toward the shooter.

### Viruses and poison {#otros}

Viruses (−7) don't come out of `.shoot`: they are built with [[.mkvirus]] and
launched with [[.vshoot]] (see [[simulacion/virus]]). Poison (−5) doesn't either: it
is only born as a response from a toxic bot (see [[simulacion/defensas#toxina]]). The
other negatives don't shoot anything.

### With fixed exchange {#fijo}
<!-- 33-SHOTS §5 (EnergyExType/EnergyProp/EnergyFix); core releasenrg/releasebod -->

Everything above holds with the proportional [[param:opt:60]], the default. With the
fixed one, every −1 or −6 always hits with the [[param:opt:61]] (200 by default),
regardless of the shooter's body, its [[.shootval]] or the distance. With the
proportional one, the [[param:opt:62]] multiplies the force of those two types.

## What the receiver feels {#sentir}
<!-- 32-VISION §5 (taste: shflav, shang = dang·200, shup/shdn/shdx/shsx); 10-CICLO §2 (EraseSenses antes de updateshots); core shots.hpp updateshots (taste en todo golpe); probado: responde.txt contra tira.txt (gira en el ciclo 9 y en el 11 ya le devuelve el fuego) -->

Each hit leaves a _flavor_ in the victim, whether it did damage or not (a shot that
the shell stops is felt too):

- [[.shflav]]: the type of the shot (−1, −2, −6…; for a memory one, the
  address; −5 if it is poison).
- [[.shang]]: the angle it came from, measured like [[.aimdx]].
- [[.shup]], [[.shdn]], [[.shdx]] and [[.shsx]]: the type, in the one that
  matches the side of the hit.

The engine writes them in the _shots_ phase, so your DNA reads them in the next
cycle, and clears them after it has run. If several hit you, the last one remains.
Watch out: a bot that hunts with −1 also feels its food, because the gift coming back
marks −2 on it.

This bot, if its energy is stolen, turns toward the shooter and returns fire:

```adn
' If my energy is stolen, I turn toward the shooter and return fire
cond
 *.shflav -1 =
start
 *.shang .aimdx store
stop

cond
 *.eye5 0 >
start
 -1 .shoot store
stop
```

In the test, against a hunter that hit it in cycle 8, the bot turned in 9, already
had it in [[.eye5]], and from 11 on the two were stealing energy from each other.

## A minimal hunter {#ejemplo}
<!-- Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (dispara con *.eye5 50 > y *.refeye *.myeye !=) -->

_Animal Minimalis_, from the Bestiary, sums up everything above in one gene: it
shoots −1 only when what it sees is close (`*.eye5 50 >`) and isn't its own species
(`*.refeye *.myeye !=`, see [[sysvars/ref]]), and meanwhile it accompanies the
target by copying its velocity ([[.refveldx]], [[.refvelup]]).

```adn
' From Animal Minimalis's attack gene
cond
 *.eye5 50 >
 *.refeye *.myeye !=
start
 -1 .shoot store
 *.refveldx .dx store
 *.refvelup .up store
stop
```

The step-by-step guide to writing a hunter of your own is in
[[tutoriales/dispara]].
