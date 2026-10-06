---
titulo: A multibot
resumen: "Step by step: a multi-celled organism whose cells are born tied together, share energy, hold their shape and walk as one."
etiquetas: [multibot, ties, multicellular, sharing, organism]
estado: revisada
---
In [[tutoriales/alimentador]] you used a tie to suck the energy out of another
bot, and in [[tutoriales/reconoce-especie]] you learned to tell your own kind
apart. Now we go further: instead of _using_ ties, we're going to _live_ in them.

## What a multibot is {#que-es}

<!-- 34-TIES §3 (Multibot = True en la primera tie endurecida; False sin lazos); .multi -->
A _multibot_ (or multicellular) is an organism: several bots joined by ties that
share energy and hold themselves in shape. A bot becomes multicellular
([[.multi]] is 1) when a tie made with [[.tie]] reaches 19 cycles and stiffens,
and it happens to both ends at once. The whole tie mechanism (spring,
stiffening, ports, sharing) is in [[simulacion/lazos]]; here we use it to build
one from scratch.

The usual recipe is simple: each child ties itself to its parent as soon as it's
born, and the organism grows birth by birth. For it to work as an organism and
not as a handful of bots hooked together, three things are left to solve: who's
in charge, how to share the pantry, and how to walk without falling apart.

## Step 1 · Be born tied {#nacer-atado}

<!-- 34-TIES §1 (nacimiento: last = 100, Port = 0 del lado del padre); lazos.md §nacimiento -->
Every birth ties the parent to the child with a _birth tie_. It's a temporary
tie: it never stiffens and it breaks by itself after 100 cycles. It also has a
quirk: the parent calls it 0, and a 0 is no use for anything, so through that tie
the parent can't write to the child or pass it resources; the child, on the other
hand, calls it 1 and can.

That's why the recipe goes like this: as soon as it's born, the child ties itself
again with [[.tie]], and the new tie overwrites the birth tie. After 19 cycles
that tie stiffens and both become multicellular.

<!-- 34-TIES §1 (fallback del padre en los primeros ciclos); comprobado con probar-adn: a los 0 de edad el hijo ya tiene .numties 1 y el .tie encuentra al padre -->
And how does a bot know it was born from a parent, so it can tie itself? Through
the birth tie: it's already in place in its first cycle of life, so [[.numties]]
is 1. A founder, a bot seeded on its own, starts with 0. That difference is
enough to tell who's who, and we keep it in a free memory cell
([[adn/memoria]]):

```adn
def cuerpo 60

' I was born from a parent: I'm body
cond
 *.robage 0 =
 *.numties 1 =
start
 1 .cuerpo store
stop

' just born, I tie myself to the parent with port 7
cond
 *.robage 0 =
 *.cuerpo 1 =
start
 7 .tie store
stop
```

[[.tie]] doesn't need to see the parent: if you don't see anyone, in your first
cycles the engine tries your parent. The 7 is the _port_: the name the child will
use for that tie; the parent will call it 1, because for the other end the tie is
named in order of arrival. And the founder doesn't ask for it: it has no one to
tie to, and a failed attempt still charges the tie cost
([[param:cost:22]]).

What you should see: seeded alone, nothing yet: the founder doesn't ask for the
tie. The observable part comes with the first birth (the reproduction gene comes
in the next step): the child is born with `.numties 1`, in its first cycle it
already calls its tie 7, and `.multi` only becomes 1 in both of them 19 cycles
after the tie is made.

:::cuidado
Tying yourself right away overwrites the birth tie, and the deliveries of
_genetic memory_ (the parent's cells 976 to 990) arrive through that tie: the
ones still missing never arrive. This bot doesn't use them, but if your species
does, let the 15 cycles of deliveries go by before you tie yourself (see
[[adn/memoria]]).
:::

## Step 2 · Grow: give birth without letting go {#crecer}

An organism that never reproduces never gets past the first generation. Any cell
with energy and body to spare can give birth: the child inherits the DNA, appears
in front and, as we already know, ties itself.

```adn
' with energy and body to spare, I reproduce
cond
 *.nrg 3000 >
 *.body 500 >
start
 30 .repro store
stop
```

<!-- 36-REPRO §2 (todo parto crea lazo de nacimiento; reparto 30 %; el hijo nace delante del padre, a la suma de los radios, y mirando al revés: su rumbo es el del padre + media vuelta; impuesto de una milésima del traspaso por lado); .repro persiste hasta el éxito, colisión en el punto de parto; comprobado con probar-adn: 3498.50/1498.50 de 5000, el hijo aparece delante del padre -->
Two details of the birth that work in our favor here. First, the [[.repro]]
command isn't used up when it fails: if the birth spot is occupied, it's retried
cycle after cycle. Second, that spot is in front of the bot, where it's pointing,
at the sum of the two radii, and the child is born facing backwards, back to back
with the parent. As long as the cells stay close, the newborn child takes up the
spot of the next birth and production stalls there: a still organism doesn't
raise more than one daughter cell. In step 4, when the ties stretch the cells
apart, the spot is free again and the factory starts up again.

What you should see: with a single cell seeded and energy to spare, after a while
there are two; the child is born with 30% of the parent's energy and body (minus
a thousandth of the transfer that each side pays). And since the child also has
the gene from step 1, it ties itself and the organism already has two cells.

## Step 3 · A single pantry {#compartir}

<!-- 34-TIES §2.1 (sharenrg: solo el creador, se borra cada ciclo, tope por body, 1 % al iniciador); comprobado con probar-adn: 3498.50/1498.50 pasan a 2493.47/2493.48 -->
In an organism, energy belongs to everyone. With [[.sharenrg]] you write what
percentage of the total you want to keep with each tie partner; with 50 they
end up even. Three conditions, always the same:

- Only the one that created the tie can ask for it; since here the child is the
  one that ties itself, each cell asks for its share toward its own parent.
- The engine clears the command every cycle, so you have to ask for it every
  time.
- In one cycle no more energy moves than the body itself ([[.body]]), and
  whoever asks pays 1% of what was moved.

```adn
' as long as I'm multicellular, I share energy evenly
cond
 *.multi 1 =
start
 50 .sharenrg store
stop
```

<!-- comprobado con probar-adn (bot de este paso, 5000 de energia inicial): 3498.50/1498.50 pasan a 2493.47/2493.48 y quedan clavadas; con tres celulas, ~1650 cada una -->
What you should see: with the parent at 3498 and the child at 1498 (seeded with
5000 energy), as soon as `.multi` is 1 the two figures converge and stay pinned
at ~2493 each: even, minus the 1% for the trip. In longer chains the sharing
goes in pairs, but since every cell asks for it, the pantry evens out by itself.

## Step 4 · Hold the shape {#forma}

<!-- 30-FISICA §3.1 (muelle con zona muerta), §3.2 (TieTorque: impulso en ambos bots, holgura 5°); 34-TIES §0.4 (regang fija ángulo y largo) -->
A tie is a spring: it remembers a rest length and pulls or pushes to get back to
it. Once stiffened, it also accepts geometry commands: [[.fixlen]] sets the rest
length and [[.fixang]] sets the angle at which the partner has to end up
relative to where you're pointing. With the angle fixed, the tie works like an
arm: if the partner drifts out of place, the engine pushes both of them
sideways and straightens them.

We ask for a length of 300, edge to edge, and an angle of 314: a quarter turn, so
each child ends up at the parent's side and the chain doesn't pile up.

```adn
' with the tie stiffened, I give it shape
cond
 *.multi 1 =
start
 300 .fixlen store
 314 .fixang store
stop
```

<!-- comprobado con probar-adn: el tirón inicial pasa de 400 (llega a ~470) y a los ~25 ciclos hay tres células; la distancia se asienta cerca de 330 -->
What you should see: the birth leaves the cells almost touching; when the tie
stiffens, the request for 300 stretches them: the initial pull goes over 400 and
after a few dozen cycles the distance settles near 330. And a happy effect: as
the bots stretch apart, the birth spot is free again and the cells give birth
again: by ~25 cycles there are already three.

## Step 5 · March: the head decides {#marcha}

<!-- 30-FISICA §2.1 (el empuje .up es por bot), §3.1 (la fuerza del muelle viaja por el lazo), §3.2 (torque en ambos); 34-TIES §2 (geometría solo multibot) -->
The last thing is moving, and here it helps to know what the engine does and what
it doesn't. Each bot pushes in _its own_ direction with [[.up]]; the engine
doesn't split your thrust among the tied bots. What does travel through the tie
is the spring force: if you move away, it drags your partner along. And with
the angle fixed, the torque that corrects the shape pushes both.

So the simplest march is that of real worms: only the head decides. The founder is
the only cell that didn't mark `cuerpo`, so it always pushes; the rest let the
spring carry them.

```adn
def cuerpo 60

' the head pushes, the body follows
cond
 *.cuerpo 0 =
start
 10 .up store
stop
```

And the whole bot ends up like this:

```adn
def cuerpo 60

' I was born from a parent: I'm body
cond
 *.robage 0 =
 *.numties 1 =
start
 1 .cuerpo store
stop

' just born, I tie myself to the parent with port 7
cond
 *.robage 0 =
 *.cuerpo 1 =
start
 7 .tie store
stop

' with energy and body to spare, I reproduce
cond
 *.nrg 3000 >
 *.body 500 >
start
 30 .repro store
stop

' as long as I'm multicellular, I share energy evenly
cond
 *.multi 1 =
start
 50 .sharenrg store
stop

' with the tie stiffened, I give it shape
cond
 *.multi 1 =
start
 300 .fixlen store
 314 .fixang store
stop

' the head pushes, the body follows
cond
 *.cuerpo 0 =
start
 10 .up store
stop
```

<!-- comprobado con probar-adn, --qty 1 y --qty 3, 5000 de energia, sin costos ni mutaciones; crucero del organismo ~33 por ciclo contra ~40 de un bot suelto con el mismo .up; reverificado: 991 unidades en 30 ciclos (~33), .tielen oscila entre 233 y 406 en la marcha, .multi pasa a 1 en los dos extremos el mismo ciclo, y la variante con todas las celulas empujando se hace un nudo y avanza ~5 unidades por ciclo (menos de un tercio) -->
To check it, seed several founders and see how they do. What we measured with
three, at 100 cycles:

| What we look at | Result |
|---|---|
| Cells per organism | 3 from each founder with room to give birth (one that ended up stuck to the corner of the field got no children: its birth spot fell outside) |
| Ties | The head with 2, the rest with 1, and none broken |
| Relative positions | The length oscillates around the 300 requested (while marching it goes from ~200 to ~430) and the angle holds near the quarter turn: the chain walks without folding up |
| Progress | The organism that walked freely covered ~2500 units in its first 90 cycles; at cruising speed that's about 33 per cycle (a loose bot with the same thrust cruises at ~40): dragging cells costs something, but not much |
| Energy | Even: ~1650 per cell, out of the 5000 at the start |

## In the Bestiary {#bestiario}

<!-- Caterpillar_Peter_F2_MB_04-11-08.txt (Bestiario): comparte nrg/shell/slime/waste, camina alternando .fixpos y .fixlen 1/1000, se corta con .deltie al engordar -->
There are real multibots in the Bestiary, with years of tournaments behind them.
Peter's _Caterpillar_ walks like a caterpillar: it pins down its head, shortens
the tie to 1 with `.fixlen` to drag the body along, stretches it again to 1000
and repeats; it shares energy, shell and slime by halves (and passes the waste on
whole), and when it has gathered too much energy it cuts itself with
[[.deltie]] so that each section founds a new organism.

<!-- Tribolis_0.1_MB_Bacillus_-21008.txt (Bestiario): celda type (head/middle/tail); todas nacen cabeza; la que queda sin lazos se marca cola y reproduce; la cabeza con nrg de sobra se degrada a tramo y pare una cabeza nueva; la cabeza empuja y fija 628 .fixang; los tramos empujan más despacio; la cola aturde presas con venom -->
Bacillus's _Tribolis_ is a worm with a hierarchy: each cell declares itself head,
section or tail in a free cell. All are born declaring themselves head; the one
left without ties (the founder, or one that lost them) declares itself tail and
reproduces to found the worm; and the head that gathers energy to spare demotes
itself to section and gives birth to a new head, so the body grows longer. While
marching, the head is in charge: it pushes and fixes its tie at 628, with the
body hanging behind; the sections push more slowly so they don't fall behind, and
the tail stuns prey with venom.

<!-- W6_a_verry_strong_multibot.txt (Bestiario): publica la posición del objetivo por tout/tin, se conecta según la población -->
And Peterb's _W6_, a tactical multibot with a huge genome: it publishes through
the ties where it saw the enemy and builds chains of different sizes depending on
how large the population in the field is.

## What to try next {#despues}

<!-- 21-MEMORIA §3 (tin1 = tout1 del atado, vía ReadTRefVars); 34-TIES §2 (tieportcom: escritura remota de memoria); core ties.hpp DeleteTie (el cadáver sigue atado); sysvars .fixpos (latch: fija la célula) -->

- **Divide up the jobs.** Instead of every cell doing everything, mark them like
  the _Tribolis_ and go further: some hunt ([[tutoriales/dispara]]) and others
  photosynthesize ([[simulacion/cloroplastos]]), with energy traveling through
  the sharing. To choose who does what, the usual route is the tie channels
  ([[.tout1]] publishes it, [[.tin1]] listens) or a cell written by the neighbor
  with [[.tienum]], [[.tieloc]] and [[.tieval]].
- **Change the march.** Try having all the cells push: you'll see that the
  organism covers less ground, because each one pushes toward its own front and
  it ties itself in a knot (in the test, less than a third of what the head's
  march achieves). The _Caterpillar_'s inchworm gait (pinning a cell with
  [[.fixpos]] and shortening the tie) does better in tight spaces.
- **Put it to the test.** Challenge the organism with a predator and see what
  happens if the head falls: the corpse stays tied for a good while
  ([[simulacion/muerte]]), nobody pushes and the organism is stopped. After that
  blow, which gene would have to change so that a body cell takes command?

For multibot strategies in competition, see
[[estrategias/multibots]].
