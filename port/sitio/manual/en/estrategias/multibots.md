---
titulo: Multibots
resumen: "Why it pays to be many: what the Bestiary's organisms pay and what they gain, with three championship recipes dissected."
etiquetas: [multibot, ties, organism, bestiary, gait]
estado: revisada
---
In [[tutoriales/multibot]] you built an organism from scratch: the children tie
to the parent, the pantry is shared, the head pushes and the body goes along
for the ride. Here we take one step further and read the ones that already
came out as champions: the Bestiary holds about 80 bots with “MB” in the name,
and in them ties stop being a trick and become a way of life. The full
mechanism is in [[simulacion/lazos]]; the tutorial teaches you to build it;
this page teaches you to read someone else's organism the way you read a
rival's play.

## The bet {#apuesta}

<!-- 34-TIES §1 (costo de atar, lazo de nacimiento cobrado al padre), §2.1 (1 % del reparto, tope por body), §3 (multibot: costos divididos, vbody); 30-FISICA §2/§6 (un bot fijo no recibe fuerzas y su velocidad es 0) -->
Being many costs. Every tie attempt charges the tie cost
([[param:cost:22]]), and even the birth tie is charged to the parent at every
birth. Sharing isn't free either: you have to ask for it every cycle, whoever
asks pays 1% of what moves, and in one cycle no more energy travels than your
own body holds ([[simulacion/lazos#recursos]]). And an organism walks slower
than a loose bot: it drags along cells that each push toward their own front.
<!-- tutoriales/multibot (medido ahi: ~33 unidades por ciclo contra ~40 de un bot suelto con el mismo empuje) -->

What all that buys:

- **One shared pantry.** One cell that eats feeds all of them: with
  [[.sharenrg]] the energy evens itself out along the chain, and the same goes
  for shell, slime and waste (how energy enters and leaves a bot is covered in
  [[simulacion/energia]]).
- **Mass.** Being multicellular, shots that take energy or body hit with the
  strength of the whole organism, and making shell and slime costs the amount
  divided by the number of ties plus one
  ([[simulacion/lazos#multicelulares]]). In competition this is the whole
  business: a loose predator thinks twice before biting something bigger than
  itself.
- **Redundancy.** If the organism breaks, the cells stay alive and each piece
  can start over. A swarm loses individuals; a multicellular organism loses
  limbs.
- **New gaits.** Anchoring yourself with [[.fixpos]] (an anchored bot receives
  no forces: it's an anchor) and stretching the tie with [[.fixlen]] gives you
  ways of moving that a loose bot doesn't have, and that grip where the thrust
  of [[.up]] doesn't reach.

:::cuidado
In a tournament, read the rules first: automatic disqualification
([[param:opt:93]]) can forbid tying to a rival or passing resources to one
through a tie.
:::

## Caterpillar: the accordion {#caterpillar}

<!-- Caterpillar_Peter_F2_MB_04-11-08.txt (Peter); probado: --qty 1 y --qty 3, 6000 de energia, campo 6000x4000: parejas con .multi 1 a los ~25 ciclos, .fixpos alternado y complementario, .tielen oscilando entre 22 y 290, energia pareja clavada en 702/702, y avance de 2644 unidades en 225 ciclos (~12 por ciclo) hasta la pared; re-corrido (--qty 2): multi 1 al 25, 702/702 clavada, tielen 22-275, avance ~11 por ciclo -->
Peter's _Caterpillar_ lives in pairs: a head and a body joined by a single stiff
tie ([[.stifftie]] at maximum). It doesn't push with `.up`: it walks like a
wind-up toy caterpillar, folding and stretching.

The head is the clock. Each cell computes the phase from the head's age (the
body feels it through the tie with [[.trefage]], the head knows it from its
own [[.robage]]) and they alternate every seven cycles: in one half, the body
anchors and the tie stretches to the maximum, with the head loose; in the
other, the head anchors, the tie shortens to 1 and the body drags itself up to
it.

```adn
def time 100
def head 101
def move 102
def maxlengh 972

' body: high phase of the clock, I anchor and order the tie to stretch
cond
 *.move 1 !=
 *.head 0 =
 *.trefage *.time mod *.time 2 div >
start
 *.maxlengh .fixlen store
 1 .fixpos store
stop

' body: low phase, I let go and accordion: the tie to 1
cond
 *.move 1 !=
 *.head 0 =
 *.trefage *.time mod *.time 2 div <
start
 1 .fixlen store
 0 .fixpos store
stop
```

<!-- Caterpillar_Peter_F2_MB_04-11-08.txt, gen «MB-sharing»; probado: la energia de la pareja queda clavada e igual (702/702) mientras viven ambos -->
The sharing has a lock. Every living Caterpillar increments a public counter
every cycle ([[.tout1]]), so the age I feel in the other one has to match the
counter that reaches me ([[.tin1]]): if the tied bot is a corpse (which no
longer increments) or a stranger, it shares nothing.

```adn
def stiftie 973

' I only share if the tied bot is a living Caterpillar
cond
 *.numties 1 =
 *.trefage *.tin1 =
start
 .tienum inc
 *.stiftie .stifftie store
 50 .sharenrg store
 50 .shareshell store
 50 .shareslime store
 100 .sharewaste store
 *.tiepres .readtie store
stop
```

When it hunts, it aims with [[.setaim]] and picks the shot according to the
victim's defense: body (`-6`) against those that rely on poison, energy
(`-1`) against those that rely on shell ([[simulacion/disparos]]). And it
carries a liftoff gene: with more than 5000 energy and 2000 body, it cuts the
tie with [[.deltie]]; each half is left alone, and a lone cell gives birth to a
new head. In our runs without food it never got that far, but in a world that
feeds it, this is how it multiplies.

<!-- Caterpillar_Peter_F2_MB_04-11-08.txt: guarda maxlengh (972) y stiftie (973) en la memoria genetica instantanea (971-975, copiada al nacer); 21-MEMORIA; el bot define «time» en la 100, «head» en la 101 y «move» en la 102 -->
One detail worth stealing: it keeps its configuration (the maximum length, the
stiffness) in the instant genetic memory cells, so every offspring is born
with the same values without writing them again ([[adn/memoria]]).

:::nota
Even champions ship with typos that the editor flags. This one has a `=>`
that isn't any operator, and a `head` without `*` that compares a 1 against
address 101: that condition is always false and the gene that announced “enemy
nearby: anchor yourself” is dead. Always run what you write.
:::

## Tribolis: the worm with jobs {#tribolis}

<!-- Tribolisv1.0_F2MB_Bacillus_51008.txt (Bacillus); probado: --qty 1, 15000 de energia, 400 ciclos: el fundador se declara cola (celda 999 = 3) y pare una cabeza (999 = 1) que empuja con .velup clavado en 40; --qty 2, 15000: gusano estable de tres celulas (999 = 3 cola con un lazo, 999 = 2 tramo con dos), energia pareja en las celulas; y al romperse el gusano, cada pedazo refundo su propio gusano; re-corrido (--qty 1): gusano de tres celulas estable, energia pareja ~4590, velup 40 en la cabeza -->
Bacillus's _Tribolis_ is a worm with a hierarchy. Each cell declares itself in
one of its memory cells: 1 head, 2 segment, 3 tail. All are born as heads; the one
left without ties demotes itself to tail and gives birth; and a head that
gathers energy to spare demotes itself to segment and gives birth to a new
head, so the worm grows from the front. Here it is dissected in its version
**1.0** (`Tribolisv1.0_F2MB_Bacillus_51008.txt`); the one in the tutorial
[[tutoriales/multibot]] is **0.1** (`Tribolis_0.1_MB_Bacillus_-21008.txt`), an
earlier sketch of the same design.

```adn
def type 999
def head 1
def middle 2
def tail 3

' born: I tie to the parent, publish the signature and declare myself head
cond
 *.robage 0 =
start
 2 .tie store
 654 .out1 store
 .head .type store
 654 .tout1 store
stop

' lone cell with energy: I demote myself to tail and found the worm
cond
 *.numties 0 =
 *.nrg 2000 >
 *.eye5 40 <
start
 .tail .type store
 60 .repro store
stop
```

Each job has its own genes. The head pushes flat out (in the run, [[.velup]]
stayed pinned at 40, the speed cap, [[param:opt:11]]) and takes the tie to 628
with [[.fixang]], the body hanging behind. The segments push more slowly so
they don't lose the chain, and they dump waste. And the tail is the one that
handles the prey: it doesn't kill it, it steers it.

```adn
def type 999
def tail 3

' tail: I write a 1 into its .fixpos and the prey is left anchored
cond
 *.type .tail =
 *.in1 *.out1 !=
 *.eye5 30 >
 *.reffixed 0 =
start
 .shootval inc
 .fixpos .shoot store
stop

' tail: if the prey is paralyzed, I make it spin
cond
 *.type .tail =
 *.in1 *.out1 !=
 *.memval 0 >
 *.eye5 30 >
start
 *.refxpos *.refypos angle 628 add .shootval store
 .setaim .shoot store
stop
```

<!-- Tribolisv1.0_F2MB_Bacillus_51008.txt: disparos de memoria (.fixpos, .setaim) y cola con veneno; 33-SHOTS §2 (valor >= 0: escritura de memoria con shootval) -->
The trick is the memory shot: [[.shoot]] with a positive value writes your
[[.shootval]] into that cell of the target ([[simulacion/disparos]]). The tail
writes into the prey's `.fixpos` (it's left anchored) and even into its
[[.setaim]] (it turns it half a turn). Between that and its venom, the prey
arrives docile at the head's mouth.

Defense belongs to the whole organism too: each cell publishes through the tie
how much shell and poison it is maintaining, and adopts its neighbor's level if
it's higher. If one cell gets shot, the whole worm armors up.

<!-- Tribolisv1.0_F2MB_Bacillus_51008.txt, genes «Relay shot info»; probado: con 15000 inicial el gusano de tres celulas aguanta 400 ciclos con la energia pareja entre celulas visibles (~4590 cada una) -->
And if the worm breaks, it isn't lost: each piece keeps walking and the one
left alone founds again. In our runs, a worm that was cut gave two new
organisms, each with its own tail and head.

## Inchworm: the head drives by remote control {#inchworm}

<!-- Inchworm_MB_PY_-18.10.04.txt (Purple Youko, liga de multibots 2.33); probado: --qty 2, 8000 de energia, 150 ciclos: parejas cabeza (celda 50 = 1) y cola (50 = 2) con .multi 1 a los ~30 ciclos, .fixpos siempre complementarios (1/0 y 0/1), .tielen oscilando entre 5 y 237, energia pareja; avance de ~230 unidades en 120 ciclos (~2 por ciclo) -->
Purple Youko's _Inchworm_ is the minimalist: a head and a tail, nothing more.
Its charm is how the head talks to the tail. The step lasts ten cycles, marked
by a counter: at one count, the head anchors and orders the tail to let go; at
another, it lets go itself and writes “stay still” directly into the tail's
`.fixpos` cell, through the tie. Then it shortens the tie to 120 (the tail
drags itself up to the anchored head) and stretches it to 360 (the head is
pushed out, with the tail as an anchor).

```adn
def type 50
def counter 51
def fix 54

' head, counter 1: I anchor myself and order the tail to let go
cond
 *.type 1 =
 *.counter 1 =
start
 1 .fixpos store
 1 .tienum store
 2 .tieval store
 .fix .tieloc store
stop

' head, counter 6: I let go and write stay-still into it
cond
 *.type 1 =
 *.counter 6 =
start
 0 .fixpos store
 1 .tienum store
 1 .tieval store
 .fixpos .tieloc store
stop
```

<!-- Inchworm_MB_PY_-18.10.04.txt; 34-TIES §2 (tieportcom: escritura remota en la fase de fuerzas y choques, el otro la lee al turno siguiente); probado: el .fixpos de la cola alterna exactamente con el contador de la cabeza; el adn del archivo pasa el lint sin avisos -->
Note the difference between the two orders. The first writes into a data cell
of the tail (its `fix`), and the tail reacts with genes of its own. The second
goes straight in: writing into its [[.fixpos]] is writing it an _order_, and
the engine carries it out on its turn. The write travels in the forces and
collisions phase, so today's order is obeyed tomorrow
([[simulacion/lazos#comunicarse]]). Measured: the tail's `.fixpos` changes
exactly when the head's counter says so.

It's slow (in the run, barely a couple of units per cycle) but it never falls
apart: each step anchors one of the two first, so the organism is never left
loose.

## A design tip {#consejo}

<!-- Caterpillar: reloj compartido (.trefage del cuerpo y .robage de la cabeza, ambos la edad de la cabeza), probado en la marcha; Inchworm: escritura remota de .fixpos, probado: el .fixpos de la cola cambia exactamente con el contador -->
From these runs I'd keep two ways of synchronizing a gait. If the
choreography is periodic, don't send orders: share a clock. _Caterpillar_
doesn't order the body to do anything: both cells read the head's age (one
through the tie, the other from its own memory) and each works out its own
step; there's no message that can get lost. And if the order is a one-off,
don't publish it and wait: write it into the other one's memory with
[[.tienum]], [[.tieloc]] and [[.tieval]], like _Inchworm_ with its remote
`.fixpos`. Publishing to [[.tout8]] and having the other one read [[.tin8]]
requires the other one to have the gene that listens; direct writing doesn't.

## The opportunists {#oportunistas}

<!-- W6_a_verry_strong_multibot.txt (Peterb): publica la posicion del enemigo en .tout1/.tout2 y la lee cada 10 ciclos por .tin1/.tin2; probado: --qty 3 en campo 6000x4000 no se ata ni se reproduce (sus genes de repro piden poblacion enemiga); --qty 12 en 1500x1000, 400 ciclos: lazos transitorios (1 a 3) y solo parejas pasajeras con .multi 1 -->
Not every “MB” lives in organisms. Peterb's _W6_ (an enormous genome full of
tactics) ties when it suits it and cuts loose when it doesn't: it publishes
through the ties where it saw the enemy and builds chains depending on how
much population there is. In our runs it never got past passing pairs: a tie,
a while of `.multi` 1 and on to something else. The organism, for it, is just
one more tactic, not an identity. Seed it dense and sparse and you'll see the
difference.

## What to try next {#despues}

<!-- 34-TIES §3 (.sharechlr solo entre parientes cercanos); 36-REPRO §2 (todo parto ata al padre); 33-SHOTS §2 (disparos de memoria) -->
- **A farm organism.** Split the jobs using chloroplasts: some cells
  photosynthesize and others hunt, and the pantry travels through sharing
  ([[simulacion/cloroplastos]]; watch out: [[.sharechlr]] only works between
  close relatives).
- **The head's fragility.** Kill the head of a _Tribolis_ and see what
  happens: the corpse stays tied for a good while ([[simulacion/muerte]]),
  nobody pushes, the worm is stalled. Write the gene it's missing: have the
  oldest segment take over.
- **Multibot against swarm.** Run your organism against the same DNA without
  ties and compare: without a common pantry or a mass bonus, each loose bot is
  just a bot ([[estrategias/enjambres]]).
- **Go steal genes.** _Caterpillar_'s sharing lock (don't feed corpses or
  strangers) and _Tribolis_'s tail that steers prey (memory shots) combine well
  with the tie feeder you built in [[tutoriales/alimentador]].
- **Go compete.** Set up a league with these three and yours, with the
  disqualification rules properly configured ([[estrategias/torneos]]).
