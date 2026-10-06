---
titulo: Energy, body and waste
resumen: "Where a bot's energy comes from and where it goes in each cycle: costs, upkeep, the body as a reserve, waste and shock."
etiquetas: [energy, body, waste, costs, upkeep, shock]
estado: revisada
---
Everything a bot does costs energy, and almost nothing creates it. This page explains
how that accounting works: the bot's three reserves (energy, body and waste), at what
point in the cycle each thing is charged, how much it costs to live even if you do
nothing, and what happens at the extremes. The data for each sysvar is in the
reference ([[sysvars/cuerpo]], [[sysvars/ganancias]]); here is the mechanism as a
whole.

## Three reserves {#reservas}
<!-- 31-ENERGIA §0.3, §3 -->

| Reserve | Sysvar | What it is for |
|---|---|---|
| Energy | [[.nrg]] | It is the one that gets spent. If it runs out, the bot dies. |
| Body | [[.body]] | A slow reserve: it is worth 10 energy per point, makes the bot bigger and heavier ([[.mass]]) and, if it drops below 0.5, kills it too. |
| Waste | [[.waste]] and [[.pwaste]] | It is good for nothing: it is what's left over from certain activities and, if it piles up, it poisons the bot. |

Energy and body are exchanged at 10 to 1: [[.strbody]] stores energy in the body and
[[.fdbody]] takes it out, at most 100 energy per cycle. The exchange carries no fee.

## Where it comes from and where it goes {#flujo}
<!-- 31-ENERGIA §0.3, §1 (libro mayor); 33-SHOTS (takenrg 95/4/1); 50-MUNDO §2.2-2.3 -->

In DarwinBots, energy **enters the world** in two ways: the sun, which feeds bots with
chloroplasts, and the new vegetables that repopulation seeds (see
[[simulacion/cloroplastos]]). Everything else passes it from one bot to another,
converts it or spends it.

```
  in                                      out
  ──                                      ───
  sun (chloroplasts) ──┐            ┌──► DNA, moving, turning, shooting
  eating others ───────┤            ├──► upkeep (age, body, DNA)
  body (.fdbody) ──────┼──► ENERGY ─┼──► defenses ──► waste
  digested waste ──────┘            ├──► body (.strbody), chloroplasts
                                    └──► the child, or food for another
```

<!-- core takenrg: nrg + 0,95·E, body + 0,004·E, waste + 0,01·E; Reproduce: padre −0,1 % y hijo ×0,999 de la parte -->
When a bot eats with a shot, of the energy it receives 95% goes to its energy, the
equivalent of 4% comes in as body (0.4 points of body for every 100 of energy) and 1%
turns into waste (see [[simulacion/disparos]]). When reproducing, the child takes its
share and in the transfer 0.2% of that share is lost, half on each side (see
[[simulacion/reproduccion]]).

## When each thing is charged {#por-fase}
<!-- 31-ENERGIA §0.2, §1 (tabla por fase); 10-CICLO §2, §5 (P1, P3, P5, P6) -->

The order matters, because a phase sees what the previous one left. With the phase
names from [[simulacion/ciclo]]:

| Phase | What is charged or credited |
|---|---|
| DNA | Each instruction executed ([[adn/ejecucion]]). |
| Shots | What is eaten or lost through shots that arrive. |
| Forces and collisions | Upkeep (age, body and DNA length) and the thrust from [[.up]], [[.dn]], [[.sx]] and [[.dx]]. |
| Movement | Turning, what passes through the ties ([[simulacion/lazos]]) and making viruses. At the end, energy is clipped to ±32000. |
| Actions | Making defenses, waste, shooting, buying chloroplasts, converting energy and body, shock, tying and, at the end, publishing the senses and deciding who dies. |
| Births and deaths | The split with the child and the DNA copy. |
| The sun | Photosynthesis. |

Between one phase and the next the energy can end up **negative**: the DNA and the costs
are subtracted without looking at the balance. Only in actions is it decided whether the
bot died (with [[param:opt:50]] turned on, below 15 it becomes a corpse; otherwise,
below 0.5 it dies; see [[simulacion/muerte]]). What you read in [[.nrg]] is what was
left when the senses were published, never less than 0. Since the sun comes later,
what a vegetable gains in cycle _N_ shows up published at the end of _N+1_.

## Staying alive costs {#mantenimiento}
<!-- 31-ENERGIA §1 (Upkeep: edad, body·BODYUPKEEP, (DnaLen−1)·DNACYCCOST, ×COSTMULTIPLIER); core Upkeep; comprobado: cuerpo 1000 con 0,001 → −1/ciclo; ADN de 4 con 1 → −3/ciclo; edad 2 desde 5 → cobra desde robage 7 -->

Even when it executes nothing useful, a bot pays three upkeep fees every cycle. All
of them are multiplied by the [[param:cost:54]]:

| Fee | How much | Parameters |
|---|---|---|
| Age | A fixed amount per cycle from a given age on. | [[param:cost:31]], [[param:cost:32]] |
| Body | A fraction for each point of [[.body]]. | [[param:cost:30]] |
| DNA | An amount for each instruction in the genome, not counting the `end`. | [[param:cost:24]] |

For example, the bot `cond start stop` (three instructions and the `end`) with 1000 body
loses 1 per cycle if the body costs 0.001, and 3 per cycle if the DNA costs 1, even
though its genes do nothing.

The age fee comes in three forms. The basic one always charges the same amount once the
age has passed [[param:cost:32]]. With [[param:cost:51]] it grows with the logarithm of
the cycles that have passed since that age; with [[param:cost:60]] it grows in a straight
line, at a rate of [[param:cost:33]] per cycle. It is the way to make old bots make room.

With the configuration the app starts with, all costs are at 0 and living is free. The F1
rules charge 0.00001 per point of body and 0.01 for age from the first cycle: a bot with
1000 body pays 0.02 per cycle, little next to what it spends moving (0.05 per unit of
thrust) or shooting (2 per shot). The prices and how to change them are in
[[app/parametros-costos]]; the automatic adjustment of the multiplier, in
[[app/parametros-costos-dinamicos]].

## The body {#cuerpo}
<!-- 31-ENERGIA §3; core storebody/feedbody (sin chequeo de saldo, tope 32000); comprobado: 250 de energía y 100 .strbody por ciclo → cadáver al tercer ciclo -->

The body is the bot's piggy bank, and the way to store energy without losing it all in
one blow. It is also what makes it big: more body means more radius, more mass and
harder to move. If the simulation charges upkeep for the body, the piggy bank has a cost.

Conversions don't check the balance. `100 .strbody store` charges 100 energy even if the
bot has 50: a bot with 250 energy that stores 100 per cycle is down to 50 in the second
cycle and is a corpse in the third. Both commands, with an example of a piggy bank, are in
[[sysvars/cuerpo]].

## Waste {#desechos}
<!-- 31-ENERGIA §2 (fuentes y sumideros, HandleWaste); core HandleWaste, altzheimer, feedveg2, defacate; shots −4 (0,99 y 1/100) -->

Waste ([[.waste]]) shows up in three ways:

- **Making defenses.** The extra cost of [[.mkshell]], [[.mkslime]],
  [[.mkvenom]] and [[.mkpoison]] (see [[simulacion/defensas]]) doesn't vanish: it
  becomes waste, one for one.
- **Eating.** 1% of what comes in through a shot or a tie.
- **Receiving another bot's**, with a −4 shot or through a tie with [[.sharewaste]].

In each cycle, in the actions phase, the engine processes it in this order:

1. If the bot has chloroplasts, it digests a little: with 16000 chloroplasts, half a
   unit of waste per cycle, which is converted into some energy and body.
2. If the waste plus the permanent waste ([[.pwaste]]) goes over the limit of
   [[param:opt:56]] (400 if you didn't change it), the bot becomes intoxicated: the
   engine writes random numbers to random addresses in its memory, once for every 4
   units of excess.
3. If it goes over 32000, the bot expels it on its own: it drops to 31000 and a −4 shot
   of 500 goes out.

Intoxication is serious. In a test, a bot that made 100 shell per cycle without
discharging reached 1000 waste in ten cycles. By then it had almost all the addresses
from 52 to 60 full of garbage, and the next cycle it reproduced without meaning to: one
of the random writes had landed on [[.repro]]. Which addresses get dirtied is a matter
of luck, but any of them can be hit, commands included.

The normal way to get rid of it is a −4 shot. This bot builds itself 500 shell and
throws out the waste when it goes over 100:

```adn
' Builds itself a shell and throws out the waste before it becomes a nuisance
cond
 *.shell 500 <
start
 50 .mkshell store
stop
cond
 *.waste 100 >
start
 -4 .shoot store
 *.waste .shootval store
stop
```

With the shell cost at 1, each cycle of making costs it 55 energy (5 for the conversion
plus 50 for the cost) and leaves it 50 waste, which it discharges every two or three
cycles. In the end it has 500 shell, 0 waste and 5 permanent waste: from each discharge,
1% stays forever in [[.pwaste]]. That permanent waste can't be thrown away; it only gets
diluted on reproduction, because the child takes its share.

## The 32000 cap {#tope}
<!-- 10-CICLO §5 (P3 clamp nrg ±32000; P5 body, waste); core feedbody, takenrg (desborde al cuerpo), ManageBody; comprobado: 31950 + 100 .fdbody → 32000 y el cuerpo baja 10 -->

Energy, body, waste and chloroplasts are capped at 32000. What goes over the cap depends
on where it comes from:

- Eating: the energy that is left over goes to the body, at 10 to 1.
- [[.fdbody]] and the sun: what is left over is lost. A bot with 31950 energy that
  converts 100 ends up at 32000 and still pays the 10 of body.
- [[.strbody]] with a full body: the energy is charged and the body doesn't grow.

## Shock {#shock}
<!-- 10-CICLO §5 (Shock), §11.1; 31-ENERGIA §1; port/README A1-1; comprobado: 10000 de energía y 6000 .mkchlr a costo 1 → cadáver con 1400 de cuerpo; 9000 → sin shock -->

A bot that isn't a vegetable suffers a _shock_ if in a single cycle it loses more than
half of the energy it ended the previous one with and still has more than 3000 left. All
the energy it has left goes to the body, at 10 to 1, and it drops to 0, so it dies in that
same cycle (or becomes a corpse, with its body fattened).

```adn
' Bad deal: buys 6000 chloroplasts all at once
cond
 *.robage 5 =
start
 6000 .mkchlr store
stop
```

With 10000 energy and each chloroplast at 1, the purchase leaves it at 4000: it lost more
than half and has more than 3000 left. It ends up as a corpse with 1400 body (the 1000 it
had plus 400 from the converted energy). If it bought 9000, it would be left at 1000 and
there would be no shock: the rule only looks at those that still have a lot. A very strong
enemy shot or a big expense can trigger it; splitting off a child can't, because birth
doesn't count as a loss.

:::nota
In the original DarwinBots 2.48.32, shock set the energy to 0 _before_ passing it to the
body, so it was lost. The port converts it, as the code intended (see
[[tecnico/diferencias]]).
:::

## How the bot sees it {#sentidos}
<!-- sysvars.yaml .pain .pleas .bodloss .bodgain (WriteSenses P5) -->

Everything on this page reaches the DNA one cycle late. [[.nrg]], [[.body]],
[[.waste]] and [[.pwaste]] say how the bot ended up at the end of the previous cycle, and
[[.pain]], [[.pleas]], [[.bodloss]] and [[.bodgain]] say how much it changed in that
cycle, without saying why (see [[sysvars/ganancias]]). A freshly seeded bot reads all of
that as 0 in its first cycle, [[.nrg]] and [[.body]] included.
