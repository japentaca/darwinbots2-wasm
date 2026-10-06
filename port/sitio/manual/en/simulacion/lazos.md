---
titulo: Ties and multicellular bots
resumen: "How one bot gets tied to another, how the tie behaves like a spring, what travels through it and how, and how, with stiffened ties, several bots form a multicellular organism."
etiquetas: [ties, tie, multicellular, spring, sharing, communication]
estado: revisada
---
A _tie_ joins two bots. Physically it is a spring that keeps them at a certain
distance; it is also a channel: through it each bot senses the other, writes to
its memory and passes resources to it or takes them from it. With stiffened ties,
several bots stop being loose individuals and form a _multicellular_ organism
(_multibot_): one that shares energy, holds its shape and moves as a single
thing.

This page describes the mechanism as a whole. Each memory cell has its own
page in the reference, grouped in [[sysvars/lazos]].

## Two ways to have a tie {#tipos}
<!-- 34-TIES §1 (caminos de creación: .tie last −20, nacimiento last 100) -->

| | Birth tie | Tie made with [[.tie]] |
|---|---|---|
| When | Every birth ties the parent to the child | When the bot asks for it |
| How long it lasts | Breaks by itself at 100 cycles | Until it is cut or breaks |
| Stiffens | Never | At 19 cycles |
| Who creates it | The parent | The bot that wrote `.tie` |

## How a tie is created {#crear}
<!-- 34-TIES §0.1, §0.3, §0.5, §1; core robots.hpp FireTies (P5, al final de las acciones; fallback padre si age < 2, si no lasttch; DisableTies solo frena .tie); maketie (length ≤ 1.5·c, deflect Random(2,92) < slime, slime −20, TIECOST/(numties+1)) -->

You write a number other than 0 to [[.tie]] and, at the end of the actions phase,
the engine tries to tie you to the bot you are looking at (the same one that
[[.refeye]] and company describe). If you don't see anyone, in your first two
cycles of life it tries your parent, and otherwise the last bot that touched you.
The parent shortcut is reliable early in a simulation; later on, once bots have
been born and died many times, it may not find it, so it is best for the child to
be looking at it.
<!-- core FireTies: rob(.parent) indexa con el número absoluto del padre como si fuera su lugar (se replica el original; solo coincide en sims jóvenes) -->
The command is always cleared, whether it succeeds or not.

For the tie to form:

- The other one has to be a bot, not a scenario shape, and be close: about 400
  from edge to edge at most.
- Its slime ([[.slime]]) can deflect the attempt: the engine draws a number
  between 2 and 92 and, if the other's slime is greater, there is no tie. With
  more than 92 slime nobody can tie it. Every attempt, successful or not, uses up
  20 of slime.
- Neither of the two can already have 9 ties, which is the maximum.

<!-- core ties.hpp maketie: TIECOST / (numties + 1), con numties ya actualizado si el lazo salió; robots.hpp: el lazo de nacimiento pasa por maketie -->
Every attempt on someone within range costs energy: the cost of tying
([[param:cost:22]]) divided by the number of ties you have after the attempt plus
one. The first tie costs half, the second a third, and an attempt that fails with
no ties costs the full price. The birth tie charges it too: the parent pays it (in
sexual reproduction, the mother) at every birth.
If there was already a tie between those two bots, the new one replaces it: it
starts counting from zero again and becomes a `.tie` tie.

The app's [[param:opt:70]] option turns `.tie` off for everyone; birth ties still
form as usual. In contests, the disqualification option ([[param:opt:93]]) can
forbid tying to a rival or passing resources to one through a tie.

## Tie ports: what each tie is called {#puertos}
<!-- 34-TIES §0.2 (Port = mem(tie) para el creador; slot para el receptor); comprobado con probar-adn: el hijo que se ata con 7 tiene .tiepres 7 y el padre .tiepres 1 -->

A bot can have several ties, so each one has a number, its _tie port_. The important
thing is that **each end calls it by a different number**:

```
   child: wrote 7 .tie                          parent: received the tie
   calls it 7   ●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━●  calls it 1
   (the number it set)                           (its order number: it is its first tie)
```

Whoever creates the tie calls it by the number they wrote to `.tie`. Whoever
receives it calls it by its order number among their ties: 1 if it is the first, 2
if it is the second. When a tie forms, each one's [[.tiepres]] is set to the name
that bot gives it.

With that number you choose which tie each command acts on: [[.tienum]] for
writing and transferring, [[.readtie]] for reading, [[.deltie]] for cutting. If
you leave `.tienum` at 0, most commands use the tie in `.tiepres`.

## The birth tie {#nacimiento}
<!-- 34-TIES §1 (nacimiento: last = 100, Port = 0 del lado del padre), §4.3 (puerto 0); core robots.hpp maketie(n, nuovo, …, 100, 0); DoGeneticMemory (Ties(1).last > 0); comprobado con probar-adn: el lazo dura 99 ciclos, el hijo escribe en la memoria del padre por el puerto 1 y el padre no puede escribirle; re-atarse con .tie corta la memoria genética -->

Every birth ties the parent to the child. It is a soft tie that never stiffens,
and it breaks by itself at 100 cycles (to be exact, the counter starts at 100
and the tie disappears 99 cycles after the birth). It has an oddity: the parent
creates it with port 0, and a 0 is no use for choosing ties. So:

- The **child** sees it as its tie 1 and can use it for everything: writing to the
  parent, giving it or taking energy from it, cutting it with `1 .deltie store`.
- The **parent** can't write or transfer through it, or cut it. It does sense it:
  its [[sysvars/tref|tref]] cells describe the child from the cycle after the
  birth.

While it lasts, the _genetic memory_ arrives through this tie: cells 976 to 990 as
the parent had them at the moment of birth reach the child one per cycle, during
its first 15 cycles (see [[adn/memoria#memoria-genetica]]).

:::cuidado
If the child ties itself to the parent with `.tie` right after being born (the
usual recipe for a multicellular bot), the new tie **replaces** the birth tie and
the genetic memory deliveries that were still pending never arrive.
:::

## Tie physics {#fisica}
<!-- 30-FISICA §3.1 (muelle con zona muerta 20; k/b blando 0.01/0.02, hueso 0.05/0.1; rotura > 1000 + radios), §3.2 (TieTorque: holgura 5°); 34-TIES §0.4 (regang fija ángulo y largo actuales, solo el lado no-back fija ángulo) -->

A tie is a spring with a damper. It remembers a _rest length_ (the distance
between the two bots at the moment it formed) and, if the bots move too far apart
or too close together, it pulls or pushes to get back to that length, damping the
oscillations at the same time. It tolerates about 20 units of difference without
exerting force, so tied bots tend to end up swaying near the requested length.

A tie is born **soft** and, if it was made with `.tie`, it **stiffens** at 19
cycles:

| | Soft | Stiffened |
|---|---|---|
| Spring strength | low | about five times higher |
| Rest length | the distance when it formed | the distance when it stiffened |
| Angle | free: the bots rotate around each other | fixed, as seen from the bot that created the tie |
| Can be adjusted | no | yes: length, angle and stiffness |

The fixed angle turns the tie into something like an arm: the partner has to stay
in a given direction relative to where the bot points ([[.aim]]). If it strays from
there, the engine turns the bot and pushes the partner sideways until it is back in
place, with a 5-degree slack that it doesn't correct.

On a stiffened tie you can change all three things, from either end:

- [[.fixlen]] changes the rest length, measured from edge to edge.
- [[.fixang]] changes the angle, or releases it with a negative value. For the
  first four ties, [[.tieang1]] to `.tieang4` and [[.tielen1]] to `.tielen4` also
  work, and they can be read and written.
- [[.stifftie]] changes the stiffness, from 1 to 100. A freshly stiffened tie is
  equivalent to 20; a soft one, to 4.

For measuring: [[.tieang]] and [[.tielen]] give the direction and distance of the
partner on the `.tiepres` tie.

A tie breaks by itself only if the bots end up more than 1000 apart from edge to
edge, and it is deleted if the other bot disappears from the world. A partner that
dies and is left as a corpse **stays tied** until the corpse decays.

This two-cell organism separates to 300 and puts the partner at its side as soon
as the tie stiffens:

```adn
' Two cells: the child ties itself to the parent and, once the tie is stiff, shapes it
cond
 *.robage 5 =
 *.numties 0 =
start
 50 .repro store
stop
cond
 *.robage 1 =
start
 7 .tie store
stop
cond
 *.multi 1 =
start
 300 .fixlen store
 314 .fixang store
stop
```

<!-- comprobado con probar-adn (campo 3000x3000): multi a los ~20 ciclos del lazo; tielen oscila entre 250 y 400 y se asienta cerca de 280-330; tieang ronda −300 en los dos -->
Running it, the distance oscillates at first between 250 and 400 and settles near
300; the partner ends up at an angle of about 314, a quarter turn. Both of them
ask for it, so both of them hold it.

## Stiffening: multicellular bots {#multicelulares}
<!-- 34-TIES §3 (Multibot = True en regang; False con numties 0; costes divididos; vbody); core robots.hpp makeshell/makeslime (÷ numties+1 si Multibot), shots.hpp robshoot (−1/−6 ×(nt+1) si Multibot; SHOTCOST ÷ (nt+1) siempre), newshot (vbody → alcance); Multibots.bas ReSpawn (30-FISICA §5) -->

When a `.tie` tie stiffens, **both bots** become multicellular: [[.multi]] is 1.
They stay that way as long as they have any tie left, even if it isn't the
stiffened one; with 0 ties, `.multi` goes back to 0. Since the birth tie doesn't
stiffen, parent and child are not a single organism just because they were born
together: one of them has to tie with `.tie`.

Being multicellular enables and cheapens things:

- **Sharing** resources with [[.sharenrg]] and its relatives (see below).
- **Shaping** the stiffened ties, as in the previous example.
- **Paying less.** Making shell ([[.mkshell]]) and slime ([[.mkslime]]) costs the
  normal amount divided by the number of ties plus one. The cost of an ordinary
  shot is divided the same way just by having ties, even if you aren't
  multicellular.
- **Hitting harder.** Shots that take energy or body ([[.shoot]] with `-1` or
  `-6`) calculate their strength as if your body were multiplied by the number of
  ties plus one, and the range of the shots grows with the body of the whole
  organism (see [[simulacion/disparos]]).

In a world with connected edges, when a cell crosses the edge the engine
moves the whole organism, up to 50 connected cells, so that it isn't split in two
(see [[simulacion/fisica#bordes]]).

## Communicating through the tie {#comunicarse}
<!-- 34-TIES §2 (tabla: tieportcom P1 con tienum ≠ 0 y tieloc 1..1000; readtie P1); 21-MEMORIA; páginas de referencia tref, entradas-salidas, tieloc -->

There are three ways, from the mildest to the most invasive:

| To | You write | The other one |
|---|---|---|
| Sense it, without doing anything | [[.readtie]] chooses the tie | Nothing: you read its [[sysvars/tref|tref]] (energy, age, position, signature…) |
| Publish a piece of data | [[.tout1]] … `.tout10` | Reads it in [[.tin1]] … `.tin10` if it listens to that tie |
| Write to its memory | [[.tienum]], [[.tieloc]] (1 to 1000) and [[.tieval]] | Finds the written value in that cell |

The third one is powerful: you can write to any cell of the other bot, even its
commands (someone else's [[.up]] or [[.shoot]]). It happens in the forces and
collisions phase, after everyone's DNA has run, so the other one reads it on its
next turn. To use it, `.tienum` has to be different from 0; `.tiepres` is not
enough.

```adn
' The child signals the parent through the birth tie
cond
 *.robage 5 =
 *.numties 0 =
start
 50 .repro store
stop
cond
 *.robage 1 =
 *.numties 0 >
start
 1 .tienum store
 60 .tieloc store
 1234 .tieval store
stop
```

<!-- comprobado con probar-adn: la celda 60 del padre pasa a 1234 al ciclo siguiente; el hijo usa el puerto 1 del lazo de nacimiento -->
The child, when its [[.robage]] is 1, writes 1234 to cell 60 of the parent through
port 1. The parent couldn't do the same through that tie: for it, the tie is called
0.

## Passing and sharing resources {#recursos}
<!-- 34-TIES §2 (transferencias tieloc negativo P3; sharing solo multibot y ties no-back), §2.1 (sharenrg: límite por body, 1 %, se borra cada ciclo); README B4-2 (el exceso sobre 32000 pasa al otro); comprobado con probar-adn: con 90 .sharenrg el hijo pasa de 1498 a 1993, 2488 y 2686, de a 500 (su body) por ciclo -->

There are two mechanisms, and it is best not to mix them up.

**One-off transfers.** With a negative [[.tieloc]] and an amount in [[.tieval]]
you give the other bot (positive) or take from it (negative) energy (`-1`),
venom (`-3`), waste (`-4`) or body (`-6`). It works with any tie, soft or
stiffened, and with any bot, whether or not it is of your species: it is the basis
of the parasites that tie themselves to their prey and drain it. The per-cycle caps
and what is lost along the way are on the `.tieloc` page.

**Sharing.** Only between multicellular bots. With [[.sharenrg]] you write a
percentage: for each tie, the engine adds your energy and your partner's and leaves
you that percentage of the total; the rest stays with it. [[.sharewaste]] (waste),
[[.shareshell]] (shell), [[.shareslime]] (slime) and [[.sharechlr]] (chloroplasts,
only between close relatives) do the same.
Three things to keep in mind:

- **Only the one that created the tie shares.** From the other end the command does
  nothing. In the usual recipe, the child ties itself to the parent, so it is the
  child that has to ask for the split.
- **You have to ask for it every cycle.** The engine clears the sharing commands on
  every bot in every cycle.
- **The split is gradual.** In one cycle no more energy moves than your body
  ([[.body]]), and whoever asks pays 1 % of what moved.

```adn
' Two-cell organism that splits its energy equally
cond
 *.robage 5 =
 *.numties 0 =
start
 50 .repro store
stop
cond
 *.robage 1 =
start
 7 .tie store
stop
cond
 *.multi 1 =
start
 50 .sharenrg store
stop
```

<!-- comprobado con probar-adn: los dos pasan a .multi 1 a los 21 ciclos del hijo; con 100 .sharenrg el padre queda en 0 y se vuelve cadáver atado -->
With 50 the two end up even. Watch out for the extremes: `100 .sharenrg store`
means “everything for me”. Tested with this same bot, the child leaves the parent
without energy in a few cycles and the parent becomes a corpse, which stays tied.

:::nota
In the original DarwinBots, if one of the two went over the 32000 cap during the
split, the excess was lost. In this version it goes to the other bot, up to its own
cap.
:::

## Cutting a tie {#cortar}
<!-- 34-TIES §1 (DeleteTie: ambos extremos; borrados automáticos); core Update_Ties (deltie compara con el puerto propio) -->

A tie disappears from both sides when:

- either of the two writes its port to [[.deltie]];
- the bots move more than 1000 apart from edge to edge;
- one of the two disappears from the world (a corpse doesn't count: it is still
  there);
- the 100 cycles are up, if it is a birth tie;
- either of the two ties itself to the other again with `.tie`, which replaces it.

When the tie that `.tiepres` pointed to is cut, that cell moves to the previous tie
in the list. [[.numties]] always says how many are left.

## In the Bestiary {#bestiario}
<!-- port/web/bots: Snap_Tie_bot.txt (.tie 1 rnd mult inc, 10000 .fixlen, -6 .tieloc con chequeo de dnalen por tmemloc, 100 .sharenrg); 190 bots del Bestiario escriben .sharenrg (grep) -->

About 190 bots in the Bestiary use [[.sharenrg]]. A small, curious one is
_Snap Tie bot_: it ties itself at random and asks for a length of 10000 with
[[.fixlen]], so the tie snaps and the jerk moves it.

To build one step by step, follow the tutorial [[tutoriales/multibot]]; for
strategies, [[estrategias/multibots]].
