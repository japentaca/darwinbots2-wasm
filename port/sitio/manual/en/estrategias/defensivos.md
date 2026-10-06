---
titulo: Defensive bots
resumen: "How to live armed: which defense works against which enemy, how much energy it costs to keep it up, and the Bestiary bots that really use it."
etiquetas: [defenses, shell, slime, poison, venom, bestiary]
estado: revisada
---
[[simulacion/defensas]] left a promise for this page: the mechanisms are over
there (how each substance is made, what it absorbs and what it bounces), and
the strategy is here. If you're coming from [[tutoriales/dispara]], you already
know what a hunter does to a still bot with a −1 or a −6. Here you take the
side of the one on the receiving end: when each defense pays off, how much it
costs to keep it on, and how real Bestiary bots use it.

<!-- The_Shell_Maker_F1_darksleeper_-22.08.07.txt; probado: probar-adn, --qty 2 --ciclos 40: .shell en 0 los 40 ciclos, .vtimer 40 → 10 (fabrica y dispara virus; no hace caparazón); re-corrido: idéntico -->
:::nota
Bestiary names guarantee nothing. _The Shell Maker_
(`The_Shell_Maker_F1_darksleeper_-22.08.07.txt`) doesn't make a single point of
shell: over a 40-cycle run its [[.shell]] stayed at 0 while the clock for its
viruses counted down. The “shell” in the name, according to its own header, is
the empty husks it leaves behind for the other species. Before copying a
strategy, look at the DNA, not the name.
:::

## Which one against which {#cual}

<!-- 33-SHOTS §5 (releasebod: el caparazón absorbe ÷20, y el −6 le roba energía y cuerpo; releasenrg: si poison > power → rebote −5, poison −= 0,9·power); 31-ENERGIA §0.3 (1 de energía = 10 caparazón = 10 baba = 1 veneno = 4 toxina); opciones.js F1_COSTOS (cost:26 = 0,01, cost:27 = 0,01, cost:28 = 0,1, cost:29 = 0,1, × cost:54 = 1) -->

Each defense works against a different enemy, and none works against all of
them:

| Defense | Works against | Doesn't stop | Price per 100 (F1 league) | Evaporates |
|---|---|---|---|---|
| Shell | body theft (−6) and venom (−3) | −1, memory, viruses | 10 (20) | no |
| Slime | ties and viruses | all shots | 10 (20) | 2 % per cycle |
| Poison | energy theft (−1), memory shots and tie drains | −6 | 25 (26) | 2 % per cycle |
| Venom | nothing: it's ammunition, it punishes whoever gets close | — | 100 (101) | no |

Read as strategy:

- **The shell is the only insurance you pay for just once.** It doesn't wear
  down on its own: 100 of shell withstands almost four −6 shots from a hunter
  with 1000 body ([[simulacion/defensas#caparazon]]). The fine print is the
  weight: it makes you slower ([[simulacion/fisica]]).
- **Slime doesn't stop any shot.** It's insurance against the ones that tie and
  against viruses: if your slime beats the draw, the tie isn't formed
  ([[simulacion/defensas#baba]]). It pays off if your world has swarms or tie
  feeders, and it's a fixed expense: it always evaporates.
- **Poison is the shield of whoever has energy.** It bounces the −1 as long as
  your reserve exceeds the force of the hit, and the bounce poisons the shooter
  with your [[.ploc]] and [[.pval]] ([[simulacion/defensas#toxina]]). A hunter
  with 1000 body hits with 220: against that, 100 of poison isn't enough.
- **Venom doesn't defend: it punishes.** You paralyze whoever gets near you and
  write a command into its memory; you've already seen the complete recipe
  (a paralyzed bot that gives away energy) in _Alga Toxicus_
  ([[simulacion/defensas#veneno]], [[simulacion/defensas#ejemplo]]).

Shell and poison complement each other: one stops what the other doesn't. A bot
with both leaves the ordinary hunter neither the −6 nor the −1.

## The price of going armed {#precio}

<!-- probado: Massed_Hunter_with_poison_and_shell_and_slime_F2_rayz_02-04-.txt, probar-adn --nrg 1000 --ciclos 80 --cost 26=0.01,27=0.01,28=0.1,29=0.1,23=2,54=1: 1000 → 888 al ciclo 10 (armado 66 + una recarga 46), luego 888 → 842 → 796, una recarga cada ~35-40 ciclos; caparazón queda en 100 sin costo; re-corrido: idéntico (888/842/796, shell en 100, recargas de 46) -->

Making things always costs the conversion (10 energy per 100 of shell or slime,
25 per 100 of poison, 100 per 100 of venom), and on top of that the scenario can
charge you a transaction fee per unit. In the app's F1 league that fee doubles
the price of shell and slime (0.1 per unit, [[param:cost:29]] and
[[param:cost:28]]) and barely touches poison and venom (0.01,
[[param:cost:27]] and [[param:cost:26]]), all multiplied by
[[param:cost:54]]. In the built-in scenarios, except the F1 match, the costs
are 0 and you only pay the conversion.

What really costs is upkeep. Slime and poison lose 2 % per cycle
([[simulacion/defensas#decaimiento]]): keeping both above 100 means topping up
one recharge of each about every 35 cycles. Measured on the bot that follows,
with F1 league costs: **66 energy to arm 100 of each, and then 46 every ~35
cycles (about 1.3 per cycle)**. The shell, after the first payment, never costs
anything again. Added to the dues of being alive
([[simulacion/energia#mantenimiento]]), going armed is a salary, not a
purchase.

## Always armed: _Massed Hunter_ {#de-pie}

_Massed Hunter_
(`Massed_Hunter_with_poison_and_shell_and_slime_F2_rayz_02-04-.txt`) pays for
the full insurance while it can: it's a hunter (nine eyes covering the whole
front, −1, −6, ties) that also keeps all three defenses topped up with three
twin genes:

```adn
' While it has energy to spare: shell, slime and poison topped up
cond
 *.shell 100 <
 *.nrg 750 >
start
 100 .mkshell store
stop

cond
 *.slime 100 <
 *.nrg 750 >
start
 100 .mkslime store
stop

cond
 *.poison 100 <
 *.nrg 750 >
start
 100 .strpoison store
 7 .ploc store
stop
```

Note the two details that make the policy:

<!-- Massed_Hunter_with_poison_and_shell_and_slime_F2_rayz_02-04-.txt (umbral *.nrg 750 en los tres genes gemelos; .ploc 7, .pval 0); probado: --nrg 1300 con los costos de la F1, se parte en dos de ~616: debajo del umbral la baba se evapora sin volver (67 → 11), la toxina se apaga (85 → 14) y el caparazón queda en 100 -->
- **The 750 threshold.** With energy below it, it stops paying. In a run that
  started split into children (about 600 each), the slime evaporated and didn't
  come back, the poison faded out and the shell stayed: with no money, it keeps
  only what doesn't wear down on its own. Defending yourself is a luxury this
  bot refuses to pay for with its last reserves.
- **[[.ploc]] at 7 with [[.pval]] at 0** (address 7 is [[.shoot]]) is the trap
  from [[simulacion/defensas#toxina]]: whoever bites it when the poison bounces
  the hit has its shoot command wiped every cycle. But with 100–200 of poison it
  only disarms small thieves: against a −1 of 220 the poison is pierced without
  bouncing (measured: the big hunter was never poisoned). Against big hunters
  the reserve has to be much higher, as in the hedgehog further down.

## Armed on demand: _Paranoia_ {#a-pedido}

_Paranoia_ (`Paranoia1_F1_Eight_-02.09.04.txt`) pays nothing until danger
appears, and then it pays just enough. It has two triggers.

**It sees a bot that knows how to tie.** [[.reftie]] doesn't measure ties in
place: it counts how many times the tie command appears in the DNA of the bot
it's looking at. If it sees someone with that command (and it isn't its own
species), it arms slime and poison, and warns its own kind by smell so they arm
too:

```adn
' If I saw a bot that knows how to tie: slime, and I warn by smell
cond
 *45 0 >
 *.slime 100 <
 *.nrg *.slime >
start
 50 .mkslime store
stop

cond
 *45 0 >
start
 .out1 inc
stop

' And whoever sees the warning arms too
cond
 *.in1 0 >
start
 45 inc
stop
```

<!-- probado: Paranoia1_F1_Eight_-02.09.04.txt contra un bot que solo ata lazos (sin disparos), --ciclos 100: baba 0 → 112 → 115, toxina 0 → 100 → 103 (se estabilizan apenas encima de 100); de paso Paranoia lo caza por lazo (3000 → 5138; el atacante, cadáver al ciclo 40); re-corrido: idéntico (baba 112→115, toxina 100→103, 5138.92 al 40, atacante cadáver) -->

In the run against a bot that only tied, slime and poison went up and stayed
just above 100 (it makes 50 when it drops below 100). And along the way
_Paranoia_ ate it: it also knows how to hunt through ties, and the attacker
ended up a corpse at cycle 40.

**A shot hits it.** The bot knows what hit it and from which side: the flavor is
in [[.shflav]], and [[.shup]], [[.shdn]], [[.shsx]] or [[.shdx]] depending on
the angle. A −6 triggers the healing, in four twin genes (one per side; the one
for the back also answers back):

```adn
' Body hit from behind: new shell and body rebuilt
cond
 *.shdn -6 =
 *.body *.nrg !%=
start
 50 .mkshell store
 50 .strbody store
 -1 .backshot store
 5 .up store
stop
```

<!-- probado: Paranoia1 contra un cazador de -6, --ciclos 120: caparazon 0 → 149 (ciclo 45) → 527; cuerpo 1000 → 1022,51; energia 3000 → 1098; el cazador gana igual, 3000 → 4454; Paranoia vivo al 120. Contra un cazador de -1: vaciado antes del ciclo 60 -->

Each healing costs 55 energy (5 for the 50 of shell, 50 for the 5 of body that
[[.strbody]] gives back) plus whatever the hit stole: the −6 takes part of the
energy and of the body. Over 120 cycles against a −6 hunter, _Paranoia_ went
from 0 to 527 of shell, ended with _more_ body than it started with (1023
against 1000) and stayed alive, paying about 1900 energy; the hunter won anyway
(1454), but more slowly. The version for the −1 (its twin with [[.fdbody]])
managed less: against the tutorial's hunter it was drained before cycle 60.
Reacting heals; preventing, like the hedgehog below, doesn't even let you get
hurt.

## Dodging and answering back, without substances {#esquivar}

<!-- Untitled_defensive_shooter_Testlund_2012.txt; probado: contra el cazador del tutorial (campo 1500x1000, semilla 2), --ciclos 150: recibe el -1 al ciclo 25, esquivando; cadáver antes del ciclo 75, el cazador pasa a 6092 y se reproduce -->

The last bot makes none of the four: _Untitled defensive shooter_
(`Untitled_defensive_shooter_Testlund_2012.txt`) reads the shot it receives and
reacts. A −1 makes it jump at random (with a separate gene); and any hit that
isn't a gift turns it toward the shooter, throws it backward at full speed and
answers back with waste:

```adn
' Any hit that isn't a gift: I turn toward the shooter,
' back off and answer back with waste
start
 *.shflav 0 !=
 *.shflav -2 != and
 0 .shflav store
 *.aim *.shang sub .setaim store
 *.maxvel .dn store
 -4 .shoot store
 *.waste .shootval store
stop
```

[[.shang]] is the angle of the shot that hit you: with `*.aim *.shang sub` the
bot orients itself toward where it came from. It's an elegant, free defense…
until the enemy insists: in the run, against the same −1 that couldn't beat the
hedgehog, it jumped at random with every hit received, drained away anyway and
ended up a corpse before cycle 75. The reaction always arrives one cycle late;
poison that is already up bounces the hit in the same cycle it's thrown at you.

## A minimal hedgehog {#erizo}

Here's the minimal version of “poison while I have energy to spare,” complete
and ready to seed:

```adn
' Poison hedgehog: whoever bites it goes mute
cond
 *.robage 0 =
start
 .shoot .ploc store
 0 .pval store
stop

' Poison while it has energy to spare
cond
 *.poison 1000 <
 *.nrg 500 >
start
 100 .strpoison store
stop
end
```

The reason for 1000: poison only bounces hits smaller than itself, and a −1 from
a hunter with 1000 body hits with 220. Keeping 1000 up costs about 5 energy per
cycle (25 for each 100 refill, plus the 2 % that evaporates; with F1 league
costs, 5.2), as long as there's energy to spare.

<!-- probado: erizo-toxina contra el cazador del tutorial (campo 1500x1000, semilla 1), --ciclos 200: tres mordidas en los primeros ciclos, el cazador queda .poisoned 438 → 263 y con .shoot borrado; su energia clavada en 3000 (2994 con --cost de la F1: 3 disparos × 2); erizo 3000 → 1600. El mismo cazador contra un blanco quieto: cadaver antes del ciclo 40, cazador 3000 → 6163; re-corrido: idéntico (poisoned 438 → 263, cazador en 3000, erizo 3000 → 1600) -->

Against the tutorial's hunter, over 200 cycles: the hunter bit it three times in
the first cycles, each bounce added ~146 cycles of poisoning to it, and with its
[[.shoot]] wiped cycle after cycle it never shot again. Its energy stayed pinned
at 3000: zero gain. The hedgehog spent 1400 on staying toxic and came out whole.
The same hunter against a still target left it a corpse before cycle 40, with
6163 energy.

The shell variant, against a −6 hunter:

```adn
' Shell hedgehog: the shell eats the -6 shots
cond
 *.shell 1000 <
 *.nrg 500 >
start
 100 .mkshell store
stop
end
```

<!-- probado: erizo-caparazon contra un cazador de -6 (campo 1500x1000, semilla 1), --ciclos 200: caparazon oscila alrededor de 1000, cuerpo 1000 intacto, energia 3000 → 2440 (~2,8 por ciclo); cazador clavado en 3000. El blanco quieto contra el mismo cazador: cadaver antes del ciclo 60, cazador 3000 → 14871 -->

Since the shell doesn't evaporate, this hedgehog only repairs what the shots eat
away: about 2.8 energy per cycle under fire. Over 200 cycles it ended with its
body intact and the hunter having gained nothing. Without shell, the target
ended up a corpse before cycle 60 and the hunter went from 3000 to 14871.

## What to try next {#despues}

<!-- 21-MEMORIA/conespecífico (veneno y toxina absorbidos entre parientes, [[simulacion/especies#especie]]); sysvars refshell/refpoison/refvenom -->

- **Combine them.** Shell + poison close off the −6 and the −1; add slime if
  there are bots that tie. Then measure how much sooner the same bot runs dry in
  the F1 league by raising [[param:cost:54]].
- **Look at the other bot's defenses** before attacking it: [[.refshell]],
  [[.refpoison]] and [[.refvenom]] tell you how it's equipped (it's what
  _Paranoia_ does to decide whom to hunt).
- **Take it to a tournament**: where all that matters is lasting, a bot nobody
  can bite pays for itself — [[estrategias/torneos]].
- **And watch out for your own species**: a conspecific absorbs venom and poison
  without harm, so against a cannibal of your own species they don't defend you
  — [[estrategias/canibales]].
