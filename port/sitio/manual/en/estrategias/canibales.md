---
titulo: Cannibals
resumen: "Eating your own: what a bot that shoots its own species gets out of it, how it decides whom to spare, and three real Bestiary cannibals taken apart."
etiquetas: [cannibalism, species, shots, recognition, genetic memory]
estado: revisada
---
A cannibal is a bot that has its own species on the menu. There are two kinds:
the ones that shoot anything that moves because they never learned to tell
things apart, and the ones that choose by rules. Both do fine in a world with
food; in a world without food, the only bot that survives is the one that turns
on its brother first.

This page looks at cannibals as a strategy: what they buy with each shot and
what they pay, and how they solve the one hard problem, which isn't killing but
_aiming_.

## The cannibal's math {#cuenta}

<!-- core shots.hpp releasebod (Shots.bas:599-719: 20 % nrg / 8 % body, cadáver ×4, regalo −2 con la fuerza entera) y takenrg (95 % al tirador); 33-SHOTS §5; 21-MEMORIA (conespecífico: veneno y toxina absorbidos, [[simulacion/especies#especie]]); port/README B3-1 (inmunidad filial: el padre, dos ciclos); probado (re-corrido): Cannibot contra su clon, 4 copias, 60 ciclos, semilla 1: ni un disparo -->

What it gains is simple: a population is a strip of food that also walks around
and reproduces by itself. Stealing its body with a −6 is the most profitable
trade in the game: the target pays for it mostly with its body—at ten energy per
unit—and the shooter keeps almost everything it steals, already converted into
its own energy (see [[simulacion/disparos#cuerpo]]). Against a corpse it hits
with four times the force and takes everything out of its body: even the
family's remains are worth something ([[simulacion/muerte]]). When the tank runs
out of vegetables, the cannibal doesn't starve along with everyone else: it
recycles. And it regulates the population along the way: if there are too many
mouths and too few targets, the scarcity itself corrects the number.

What it pays isn't in energy but in demographics. Every brother eaten is a
relative who won't go hunting, or defend the species, or have children: the
bot's energy balance looks great, but its species shrinks
([[simulacion/especies]]); the full economics of cannibalism are in
[[simulacion/energia]]. And there are two exemptions worth keeping in mind:

- a relative's venom and poison do nothing to another relative: against your
  own kind those shots are absorbed and never hit ([[simulacion/especies]]);
- a newborn is only protected from _its parent's_ shots, and only during its
  first two cycles ([[simulacion/disparos#impacto]]): from the rest of the
  family, not a single cycle of grace.

An unfiltered cannibal, then, can't use venom against its own, but it can—and
it pays to—use −1 and −6. That's why almost all of them shoot to eat rather
than to paralyze.

## The problem of aiming {#apuntar}

The engine doesn't mark anyone as “one of yours” for shots: that decision is
yours. In [[tutoriales/reconoce-especie]] you saw the two classic signals—the
DNA signature ([[.refeye]] against [[.myeye]]) and the public password
([[.out1]]/[[.in1]]). The Bestiary's cannibals use two others:

- **spying on the other bot's genetic memory**: with [[.memloc]] you point at
  cell 971 of the bot you see and read it in [[.memval]]; since 971 is
  inherited ([[sysvars/mem-971-975]]), what you're reading is its _lineage_;
- **size**: [[.refbody]] against [[.body]], without looking at species or
  signature: it eats the smaller one and runs from the bigger one.
<!-- 21-MEMORIA §5 (971–975 se copian al nacer; 976–990 de a una); sysvars refbody/myeye; tutoriales/reconoce-especie -->

On to the bots.

## Cannibot: the tattooed lineage {#cannibot}

abyaly's _Cannibot_ (`Cannibot_abyaly_2006.txt`, 2006) is the thoughtful
cannibal. Its theory is in the file's own comments: it attacks its own species,
but only distant relatives, because “a cannibal that also attacks its close
relatives won't have anyone to defend it from its cousins.”

The trick is a family marker in cell 971 that gets inherited and drifts:

```adn
' At birth: set the marker and delete this gene
cond
 *.robage 0 =
start
 50 971 store
 .delgene inc
stop

cond
 *.robage 0 =
start
 971 .memloc store
stop

' At 2 cycles: add -1, 0 or 1 to the inherited marker
cond
 *.robage 2 =
start
 *971 2 rnd add 1 sub 971 store
stop
```

Gene 1 runs only once in a lifetime: it writes 50 to 971 and **deletes itself**
with [[.delgene]]. That deletion is the masterstroke: children receive an
instant copy of the parent's 971 ([[adn/memoria#memoria-genetica]]) and, since
the gene is no longer in the DNA, they don't overwrite it with 50 again—they
inherit the value the family had been carrying. At 2 cycles each bot adds −1, 0
or +1 at random ([[op:rnd]]): every branch drifts a little differently.
After that, the marker never changes again.

And how does it use it? By spying: [[.memloc]] on 971 makes [[.memval]] bring
back the marker _of the other bot_. The comparison is by family: [[op:%=]]
accepts a difference of up to 10%.

```adn
' Close relative (or nobody): wander
cond
 *.eye5 0 =
 *.memval *971 %= or
start
 5 .up store
 314 rnd .aimdx store
stop

' Distant and in sight: chase it
cond
 *.eye5 0 >
 *.eye5 40 <=
 *.memval *971 !%=
start
 *.refvelup 10 add .up store
 *.refveldx .dx store
stop

' Distant and close: steal its body
cond
 *.eye5 40 >
 *.memval *971 !%=
start
 -6 .shoot store
 *.refvelup .up store
stop
```
<!-- probado: Cannibot_abyaly_2006.txt, 4 clones, campo 600x600, 60 ciclos, semilla 1: ni un disparo, energia intacta en 3000, marcadores 49/50 derivando; re-corrido: idéntico -->

It works in the three cases that matter:

1. **Between clones** (same DNA, drifted markers 49 and 50): not a single shot in
   60 cycles. They pass each other, spy on each other, and each goes its own way.
2. **Against a stranger** (a still, peaceful bot): it hunts it down, bleeds it
   and kills it before cycle 30, finishing at 14875 energy from the starting
   3000. Its 971 starts at 0 and nobody wrote to it: 0 is more than 10% away
   from 50, so it's food.
   <!-- probado: contra un blanco quieto, campo 300x300, 90 ciclos, semilla 3: muerto antes del 30, kills=1, el Cannibot en 14875 -->
3. **Against a distant cousin**: an identical copy with the initial marker at 90
   instead of 50. Forty units of difference: the two attack genes see it as “not
   one of mine” and they hunt each other with the same cold blood as a stranger.
   The markers were 51 against 89: the 89 fell before cycle 30, while the two
   with marker 51 never fired a shot at each other.
   <!-- probado: copia con "90 971 store", campo 300x300, semilla 3: el "primo" muerto antes del 30 (kills=1 en uno de 51); los otros dos, intactos -->

And the inheritance shows in the children: in a long run, a founder with marker
49 had a child with 48 (it inherited 49 and drifted down), and another with 51
had a child at 51. If the deleted gene had survived, the children would all
have gone back to 50.
<!-- probado: Cannibot_abyaly_2006.txt, --nrg 30000, 130 ciclos: 7 bots al 125; hijos con 971=48 (padre 49) y 971=51 (padre 51) -->

How far does a branch have to drift to stop being family? A 10% tolerance on a
marker that starts at 50 is about 5 units: by adding ±1 per generation, two
branches that haven't crossed paths for a few dozen generations end up outside
each other's margin—and that's where the war between cousins begins. The author
says as much: it's a bot designed for _old populations_.

## Evolved cannibot Elite: cannibalism without a filter {#elite}

_Evolved cannibot Elite_ (`Evolved_cannibot_Elite_2006.txt`, 2006) is the
opposite: an evolved bot—its genes carry machine comments, with `stop`
positions—whose whole hunting brain is a gene and a half. The hunting gene,
verbatim:

```adn
cond
  *.eye5  0 !=
start
 -1  .shoot store
stop
```

If it sees something, it shoots it. No signature, no password, no marker: its
species doesn't exist for it. The rest of the DNA chases what it sees, turns at
random when there's nothing, reproduces with more than 10000 energy, and has
one stray gene that writes junk to unnamed cells—evolution's noise.

In practice it's a perfect cannibal and a strategy that sustains itself: four
copies alone in a small world started bleeding each other right away, and by 60
cycles one was down to 412 energy while another climbed to 6000. In 300 cycles
with no other food, the population held between 3 and 5: the ones that kill
eat, the ones that don't stay on the menu. Children are born, yes—with little
body, and with no protection beyond the parent's first two cycles—so the brood
is meat too.
<!-- probado: Evolved_cannibot_Elite_2006.txt, 4 copias, campo 600x600, 300 ciclos, semilla 1: al 60 uno en 412 y otro en 6042; al 120 quedaban 3; al 180, 5 (con hijos nuevos); al 300, 4, con .kills de 2 y 3 en los supervivientes -->

It's a demonstration of what happens when you don't solve the aiming problem:
the species survives, but spends its life biting its own tail.

## Sneaker: the one that eats the smaller one {#sneaker}

Testlund's _Sneaker Cannibalistic_
(`Sneaker_Cannibalistic_F3_Testlund_9-12-2014.txt`, 2014) doesn't even look at
species: it looks at the scale. Its three combat genes, condensed:

```adn
' Hunt the ones that never shoot
cond
 *.eye5 0 >
 *.reftype 1 !=
 *.refshoot 0 =
start
 -6 .shoot store
stop

' Eat the smaller one, whoever it is
cond
 *.eye5 0 >
 *.reftype 1 !=
 *.refbody *.body <
 *.refbody *.body !%=
start
 16 .shootval store
 -6 .shoot store
stop

' Run from the bigger one that fights back
cond
 *.eyef 0 >
 *.refshoot *.myshoot >=
 *.refbody *.body >
start
 628 .aimdx store
 *.maxvel 64 add .dn store
stop
```

The three criteria complement each other: one that has no [[.shoot]] in its DNA
([[.refshoot]]) is easy prey; one with less body than you—more than 10% less
([[op:!%=]])—is prey even if it's your clone; and one with more body _and_ that
shoots as much as you do is a problem: about-face and off the other way. With
[[.shootval]] at 16, the shot against the small ones goes out with triple the
force ([[simulacion/disparos#cuerpo]]).

The result with its own brothers depends on size:

- **clones of the same size**: not a single shot in 120 cycles. Their bodies
  march in step and the difference never exceeds 10%, so the attack gene never
  switches on.
  <!-- probado: Sneaker_Cannibalistic_F3..., 4 copias, campo 600x600, 120 ciclos: cuerpos identicos (1029, 1059...), kills=0 -->
- **an uneven family**: I tested it by adding a gene that makes it reproduce
  early, so that real offspring appear with the original hunting genes. The
  first parent to hand out body ended at 506 body, while its neighbor, intact,
  was still at 1009—and hunted it down. Of the five bots in the run, by cycle 30
  two were left: the two largest, with two and three kills of their own in
  [[.kills]] each.
  <!-- probado: variante con "50 .repro store" a los 5 ciclos (unico cambio), campo 1200x1200, semilla 1: 5 bots al 20, 2 al 30; el padre chico (506) muerto, kills=2 y 3 en los supervivientes -->

The cost of this policy is visible in that same run: **reproducing turns you into
the prey**, because giving birth hands out body, body is the weapon of the −6,
and the smaller one always loses. A Sneaker that wants children is putting
itself on its neighbors' menu.

It has plenty more material: a gene that gives itself a push every 128 cycles,
another that reacts to the shots bleeding it ([[.shflav]] and [[.shang]], see
[[simulacion/disparos#sentir]]) by writing [[.setaim]] and accelerating, and a
peculiar birth rule: it only reproduces when energy and body both drop at the
same time to near 2000, 4000, 8000… ([[op:%=]] with thresholds that keep
doubling).

## A minimal cannibal {#minimo}

I wrote this cannibal for this page, and it's the usual hunting skeleton
([[tutoriales/dispara]]) with the species filter from the tutorial
([[tutoriales/reconoce-especie]]) and the −6 from the bots above:

```adn
' minimal cannibal: eats strangers and spares its own
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 5 .up store
 314 rnd .aimdx store
stop

' stranger in sight: chase it, copying its speed
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 *.refveldx .dx store
 *.refvelup 30 add .up store
stop

' stranger close: steal its body
cond
 *.eye5 50 >
 *.refeye *.myeye !=
start
 -6 .shoot store
stop

' with a full stomach, have children
cond
 *.nrg 6500 >
start
 30 .repro store
stop
```

Note the condition of the first gene: it turns and advances if it sees nothing
**or if what it sees is a brother**. That `or` isn't decoration: in an earlier
version that only checked `*.eye5 0 =`, two brothers who passed each other got
stuck face to face forever—no gene switched on—with the front eye reading more
than 20000 and the energy intact for 40 cycles.
<!-- probado (re-corrido): el mismo bot sin el «or», dos copias, campo 200x200, semillas 1 a 6: al cruzarse quedan clavadas frente a frente (eye5 en 32000, energía intacta en 3000) del ciclo ~10 al 40 -->

What you should see:

1. **Four copies alone**: not a single shot, everyone turning on their own,
   energy sitting at 3000 without moving.
   <!-- probado: canibal.txt, --qty 4, campo 1200x1200, 60 ciclos, semilla 1: kills=0, nrg 3000 en los cuatro -->
2. **Two copies against a still bot**: one of them hunts it down with −6 shots,
   and whoever reaches 6500 energy divides; the child is born with the same
   DNA—that is, the same signature—so the stranger's loot feeds the family
   without a single shot slipping out between them.
   <!-- probado: canibal.txt, --qty 2 contra un blanco quieto, campo 600x600, semilla 3: muerto antes del 40 (kills=1), el cazador en 14866, se reprodujo: hijo de 4458/315; re-corrido: cadáver antes del 30, cazador en 14875 al 30, hijo de 4458/315 -->

## What to try next {#despues}

**Famine cannibalism.** The minimal cannibal lacks a hunger threshold: always
shoot strangers, but shoot brothers only when you're starving. Give it a
separate gene that shoots without a filter when energy is below a minimum—and
think about where to put that minimum so it doesn't pay to pretend to be
starving.

**The price of family.** Seed only cannibals, no vegetables, and watch in
[[app/analizar]] how the population and total energy move. Then turn on the
league costs ([[param:cost:23]]) and run the same simulation again: with every
shot charged for, the bottom of the tank comes sooner.

**The league fence.** If you enable the restriction [[param:opt:71]] (“No
asexual reproduction”), none of the bots on this page breed: _Cannibot_,
_Elite_, _Sneaker_ and the minimal cannibal all give birth through [[.repro]].
In the F1 league the restriction comes switched off, so there anything goes.
<!-- opciones.js opt:71 (DisableTypArepro: solo los vegetales repobladores se clonan); ADN de los cuatro bots: solo .repro (sin .sexrepro ni .mrepro); F1_OPTS 71 = 0 -->

**No shots.** Some cannibals eat through ties, draining the energy of the tied
victim instead of shooting it: the way there is in [[tutoriales/alimentador]]
and the full school is in [[estrategias/multibots]].

**Poisoned kinship.** Remember that venom and poison don't work against
relatives: they're absorbed. Your own kind is something you can only really
eat. The ones that live by writing to another bot's body without killing it
belong to another chapter: [[estrategias/parasitos]].

And if you still feel like evolution: _Evolved cannibot Elite_ is, by its name,
a cannibal that came out of evolution, not from a programmer. Turn the minimal cannibal into the starting
population of an experiment from [[tutoriales/evolucion]] and see whether
selection invents some of the rules of this page's bots all on its own.
