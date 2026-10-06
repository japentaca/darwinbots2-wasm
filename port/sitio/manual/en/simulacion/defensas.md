---
titulo: Defenses
resumen: "Shell, slime, venom and poison: how they are made with energy, what they cost, which ones wear off on their own, and what they do to whoever attacks you."
etiquetas: [defenses, shell, slime, venom, poison, paralysis]
estado: revisada
---
A bot can turn energy into four substances: _shell_, _slime_, _venom_ and _poison_.
All four are made the same way, but each one works against something different. This
page explains how they work; the sysvars that handle them are in
[[sysvars/defensas]].

| Substance | Made with | Read from | Per 1 of energy | Cap per cycle | Wears off on its own | Works against |
|---|---|---|---|---|---|---|
| Shell | [[.mkshell]] | [[.shell]] | 10 | 100 | no | body shots (−6) and venom shots (−3) |
| Slime | [[.mkslime]] | [[.slime]] | 10 | 200 | 2% per cycle | ties and viruses |
| Venom | [[.strvenom]] | [[.venom]] | 1 | 100 | no | it is ammunition: it paralyzes |
| Poison | [[.strpoison]] | [[.poison]] | 4 | 100 | 2% per cycle | energy shots (−1), memory shots and steals through a tie |

<!-- 31-ENERGIA §0.3 (1 nrg = 10 shell = 10 slime = 1 venom = 4 poison; topes 100/200/100/100), §1 (slime y poison ×0.98 en P1); 33-SHOTS §5 -->

## Making them {#fabricar}
<!-- 31-ENERGIA §0.3 y §1 (coste de transacción a Waste); 10-CICLO §5 P5 (MakeStuff antes de Shooting); core robots.hpp storevenom/storepoison/makeshell/makeslime (nrg > 0; Delta topado por nrg/tasa y por 100/200; Cost/(numties+1) solo shell y slime si Multibot; Waste += Cost entero); probado: los cuatro a 100 cuestan 145 sin costos y 167 con los costos F1, con 22 de desecho -->

The DNA writes how much it wants to add in the command for each substance. The
engine makes it in the _actions_ phase of the same cycle, before the shots (so
venom that was just made can already be shot in that cycle), and sets the command
back to 0. To keep making more you have to write it again.

The price has two parts:

- **The conversion**, fixed: 1 of energy for every 10 of shell or slime, for every
  1 of venom or for every 4 of poison.
- **A transaction cost**, set by the scenario per unit made
  ([[param:cost:29]], [[param:cost:28]], [[param:cost:26]] and
  [[param:cost:27]], multiplied by the [[param:cost:54]]). That energy isn't
  lost: it becomes waste ([[.waste]]).

This bot makes 100 of each in its first cycle:

```adn
' A hundred of each defense at birth
cond
 *.robage 0 =
start
 100 .mkshell store
 100 .mkslime store
 100 .strvenom store
 100 .strpoison store
stop
```

Without transaction costs it costs 145 energy (10 + 10 + 100 + 25). With the costs
of the F1 preset it pays 22 more, and those 22 show up in its waste.

A few details:

- If you ask for more than your energy can pay, the engine makes as much as it
  can. With energy at 0 or less, the command isn't carried out and stays written.
- A negative number dismantles the substance, but doesn't give energy back: it is
  charged too.
- In an organism of several tied bots ([[.multi]]), the transaction cost of shell
  and slime is divided by the number of ties plus one. Venom and poison get no
  discount.
- Inside an organism, shell and slime can be shared through the ties, and venom can
  be injected through a tie (see [[simulacion/lazos]]).

## What wears off on its own {#decaimiento}
<!-- 31-ENERGIA §1 (Upkeep P1: slime y poison ×0.98, suelo 0.5 → 0, publicados); 10-CICLO §5 P1; probado: 100 de baba y de toxina bajan a 49 en 35 ciclos; caparazón y veneno quedan en 100 -->

Slime and poison lose 2% per cycle, at the start of the _forces and collisions_
phase. A reserve that isn't topped up is cut in half in about 35 cycles. If you
top up the same amount every cycle, the reserve settles near 50 times that amount:
with 200 of slime per cycle, near 10000; with 100 of poison, near 5000.

Shell and venom don't wear off on their own: they stay until shots eat them, you
shoot them, or you dismantle them.

## Shell {#caparazon}
<!-- 33-SHOTS §5 (releasebod: shell absorbe ÷20, ShellEffectiveness = 20; takeven: ×25 VenumEffectivenessVSShell); core shots.hpp; 30-FISICA CalcMass (shell/200); probado: un −6 de 510 baja el caparazón de 100 a 74; 30 de veneno lo bajan de 100 a 62 sin paralizar -->

Shell stands between some shots and the bot. Each hit eats the shell first, and
only what's left reaches the bot.

- **Against body stealing (−6).** Each point of shell stops 20 of force. A −6 from a
  shooter with 1000 body hits with 510, so it eats 25.5 of shell: 100 of shell,
  which cost 10 energy, withstand almost four of those shots without the bot
  losing anything.
- **Against venom (−3).** It is less effective: each point of shell stops 0.8 of venom. In
  the test, a shot with 30 venom dropped the shell from 100 to 62 and didn't
  paralyze.

It doesn't stop energy shots (−1), memory shots, waste shots or viruses. For the
first two there is poison.

The hidden cost is weight: every 200 of shell weigh the same as 1000 of body
([[.mass]]), and a heavier bot accelerates less with the same thrust (see
[[simulacion/fisica]]).

## Slime {#baba}
<!-- 34-TIES §0.5 (deflect = Random(2,92); slime del objetivo −20 por intento); 35-VIRUS / 33-SHOTS §5 (−7 addgene); README B3b-2 -->

Slime doesn't stop energy, body or venom shots (see [[simulacion/disparos]]). It
works against two things:

- **Ties.** When another bot tries to tie to you, the engine draws a number between
  2 and 92; if your slime is higher, the tie doesn't form. With more than 92 nobody
  can tie to you. Each attempt, whether it succeeds or not, eats 20 of your slime.
  See [[simulacion/lazos]].
- **Viruses.** A virus shot has to get through the slime first, and it is used up
  in the attempt. See [[simulacion/virus]].

Since it evaporates, a layer of slime has to be topped up every cycle.

## Venom {#veneno}
<!-- 33-SHOTS §2.1 (−3: min(|shootval|, venom) o venom/20), §5 (takeven: conespecífico absorbe; shell ×25; Paracount += power, tope 32000; Vloc/Vval del shot); 21-MEMORIA §4.3, §6; 10-CICLO §5 P1 (Poisons después del ADN y antes de las acciones); probado: veneno.txt contra blanco.txt (30 de veneno: parálisis de unos 30 ciclos; la víctima regala el 1 % de su energía por ciclo y pierde 781) -->

Venom is a weapon: it is shot with `-3` in [[.shoot]]. The shot carries
whatever [[.shootval]] says (unsigned and never more than you have) or, if it is
0, a twentieth of your [[.venom]]. Besides the venom itself, it costs the
[[param:cost:23|cost of shooting]] like every other shot.

When it hits a bot of **another species**:

1. Its shell stops as much as it can (see above).
2. The venom that gets through is turned into cycles of paralysis: each point of
   venom, one cycle, added to whatever it already had (up to 32000).
3. The victim receives your [[.vloc]] and [[.venval]] pair, just as they were when
   you shot, and it replaces the one from any earlier hit.

As long as it has cycles of paralysis left, the engine writes the `.venval` into the
victim's `.vloc` cell every cycle. It does this at the start of the _forces and
collisions_ phase, after its DNA has run and before the actions, so the command you
set is carried out in that same cycle and its DNA can't correct it. Apart from that,
the paralyzed bot keeps working: it moves, shoots and runs its DNA. The victim sees
how many cycles it has left in [[.paralyzed]].

If it hits one of **your own species**, it doesn't paralyze it: the venom is added
to its reserve.

```adn
' At birth: my venom makes the victim give away energy
cond
 *.robage 0 =
start
 .shoot .vloc store
 -2 .venval store
 100 .strvenom store
stop

' I look for something to look at
cond
 *.eye5 0 =
start
 40 .aimdx store
stop

' I shoot 30 venom at it, just once
cond
 *.eye5 0 >
 *.venom 30 >
 *50 0 =
start
 30 .shootval store
 -3 .shoot store
 1 50 store
stop
```

In the test, against a stationary bot, the target ended up paralyzed for about 30
cycles. In each one it shot a gift with 1% of its energy and ended up 781 down. Since
the target wasn't looking at the shooter, those gifts were lost into the void.

Venom can also be injected through a tie (see [[simulacion/lazos]]).

## Poison {#toxina}
<!-- 33-SHOTS §3.4 (tipo positivo: bloqueo si poison >= nrg/2, rebote −5, poison −= 0.9·nrg/2, waste += 0.1·nrg/2), §5 (releasenrg: poison > power → createshot −5 con power, poison −= 0.9·power; takepoison: conespecífico absorbe, Poisoncount += power/1.5, Ploc/Pval), §2.3 (createshot toma mem(834) y mem(839) del emisor); 34-TIES §2; probado: tira.txt contra toxico.txt (el mordedor queda con .poisoned 145, el mordido no pierde energía y su toxina baja 198), memshot.txt contra toxico.txt (la 52 no se escribe), tira.txt contra toxico2.txt (200 ciclos sin ganar energía) -->

Poison isn't shot: it is a passive defense that acts when you get bitten.

- **Against a −1.** If your poison exceeds the force of the hit, you don't lose
  energy. Instead of the gift going back, a poison shot with that same force goes
  out toward the attacker, and your poison drops by 90% of that force.
- **Against a memory shot.** If your poison reaches half the shot's energy, nothing
  is written and poison also goes out toward the shooter.
- **Against a steal through a tie.** If energy or body is sucked out of you through
  a tie, something similar happens (see [[simulacion/lazos]]).

It doesn't stop −6 shots: that's what shell is for.

The poison shot travels like any other, with your [[.ploc]] and your
[[.pval]] from that moment. When it hits a bot of another species, it adds cycles
of poisoning: the force of the hit divided by 1.5 (up to 32000). In the test, the
bite from a bot with 1000 body (220 force) left it with 145 cycles of poisoning. For
as long as they last, the engine writes your `.pval` into its `.ploc` cell every
cycle, at the same moment as paralysis. The poisoned bot sees how many cycles it has
left in [[.poisoned]].

If the poison hits one of your own species, it is added to its reserve and doesn't
poison it. So biting a toxic sibling doesn't feed you either, but it doesn't poison
you.

A very effective use is to point `.ploc` at [[.shoot]] with `.pval` at 0: the poisoned
bot has its shoot command cleared every cycle and can't bite again.

```adn
' Whoever bites me stops shooting: their .shoot stays at 0
cond
 *.robage 0 =
start
 .shoot .ploc store
 0 .pval store
stop

cond
 *.poison 1000 <
start
 100 .strpoison store
stop
```

In the test, a hunter that kept shooting −1 went 200 cycles without gaining any
energy. Every time its poisoning ran out it went back to biting, and the poison
stopped it again.

## Where venom or poison writes {#celda}
<!-- 21-MEMORIA §6 ((memloc−1) Mod 1000 + 1; 340 → mem(0); ≤ 0 → Random(1,1000) sin 340); core robots.hpp Poisons (cuenta −1 por ciclo; < 1 termina y borra Vloc/Vval); shots.hpp takeven/takepoison -->

The rules for [[.vloc]] and [[.ploc]] are the same:

| Value | Victim's cell |
|---|---|
| 1 to 1000 | that cell |
| greater than 1000 | taken modulo 1000, like an address (1050 is 50) |
| 0 or negative | a random one on each hit |
| 340 ([[.delgene]]) | none: it is protected |

They are configuration: the engine doesn't clear them, but a newborn starts with
everything at 0. That's why many bots set them with `*.robage 0 =`. Each cycle the
paralysis or poisoning count drops by 1, and when it runs out the engine stops
writing. A bot can be paralyzed and poisoned at the same time, and then the engine
overwrites two cells.

## A Bestiary bot {#ejemplo}
<!-- Bestiario: Alga_Toxicus.txt; probado: alga.txt contra tira.txt (el cazador queda paralizado, .poisoned siempre 0, de 3000 a 935 en 120 ciclos) -->

_Alga Toxicus_ uses venom and poison in three genes. At birth it points both cells at
[[.shoot]] and chooses `-2` for its venom. Then it shoots venom every cycle toward a
random side and, when it has energy to spare, it reproduces and tops up both
reserves:

```adn
cond
 *.robage 0 =
start
 .shoot .ploc store
 .shoot .vloc store
 -2 .venval store
stop

cond
start
 120 rnd .aimdx store
 -3 .shoot store
stop

cond
 *.nrg 1000 >
start
 50 .repro store
 100 .strpoison store
 100 .strvenom store
stop
end
```

Whoever gets paralyzed gives away energy every cycle, and whoever bites it ends up
unable to shoot, because its `.pval` is 0. In a test against a hunter that shoots −1
at everything it sees, the hunter was paralyzed almost immediately: since its
`.shoot` received −2 every cycle, it never got to bite, and in 120 cycles it went
from 3000 to 935 energy.

What another bot has of each substance can be seen by looking at it, in
[[.refshell]], [[.refvenom]] and [[.refpoison]] (see [[sysvars/ref]]). The
strategies that live off these defenses are in [[estrategias/defensivos]].
