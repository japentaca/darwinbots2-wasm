---
titulo: Parasites and viruses
resumen: "From the tie that latches on and sucks to the virus that rewrites someone else's DNA: three Bestiary bots dissected, with measured numbers, and a minimal recipe for contagion."
etiquetas: [parasites, viruses, ties, bestiary, epidemic]
estado: revisada
---
In [[tutoriales/alimentador]] you built a bot that ties its food and drains it.
For that bot it was a hunting technique; the ones on this page turn parasitism
into a way of life: they live stuck to another bot, or even live _inside_ its
DNA. You already know the mechanics (ties in [[simulacion/lazos]], viruses in
[[simulacion/virus]]), so here we go straight to the Bestiary's designs and to
what happens when you set them running.

## When each strategy pays {#cuando-paga}

A tie barely reaches: it only ties the bot you're looking at, and from close
up, about 400 from edge to edge. Tying is the easy part; holding on is the
very expensive one. The tie is born soft and stretches without holding back a
prey that runs (we measured it stretched to 490 without breaking; it only
snaps past 1000) and only at 19 cycles, if you haven't re-tied, does it
stiffen and become an arm. So it works against slow or still prey: vegetables,
bots stuck against a wall. And since sucking from a bot with poison poisons
you instead of feeding you ([[tutoriales/alimentador#comer]]), defenseless
victims are the ones that pay best.
<!-- 34-TIES §1 (alcance del FireTies, endurecimiento a los 19, rotura > 1000); probado: Leechbot con el huesped huyendo a vel 40, lazo blando estirado a ~490 -->

The virus is the opposite: it doesn't aim. It goes off in a random direction, flies
far and infects the first one it touches, so it pays in populated worlds and
with the prey far away. The other bot's slime makes it pay dearly: with about
20 units it stops any virus ([[simulacion/virus#infeccion]]). And it doesn't
tell species apart: your own offspring can get infected.

| | Tie parasite | Virus |
|---|---|---|
| What you take from the other | Energy, and with sharing, also shell and slime | Control of its DNA |
| How long you wait | The tie stiffens at 19 cycles; only then do you share | The gene incubates 2 cycles per word |
| Fails against | Fast prey; slime deflects the tie | ~20 of slime; corpses |

## Leechbot: sucking by sharing {#leechbot}

_Leechbot_ (Atutouato, 2013) is the tie parasite in its barest form. Its
hunting gene ties whatever it sees, without asking what species it is; the dirty
work is done by sharing:
<!-- Leechbot_F1_Atutouato_25.3.2013.txt (genes six, eight, 12, nine, 10, 11) -->

```adn
' Tie to what I see, up to three ties
cond
*.eye5 40 >
*.numties 3 <
start
1 .tie store
stop

' Multicellular: keep 99% of everything
cond
*.multi 1 =
start
99 .sharenrg store
99 .shareslime store
99 .shareshell store
.sharewaste inc
stop
```

The 99 in [[.sharenrg]] isn't a transfusion: it's “add your energy to mine and
leave me 99%”, every cycle, up to its body cap. It's a much more
profitable suction than the tutorial's `−1`, which loses 30% along the way;
here you only pay 1% of what's moved. It does the same to the tied bot's slime
and shell.
<!-- 34-TIES §2.1 (sharenrg: tope por body, 1 % al iniciador, se borra cada ciclo, solo el lado que creó el lazo); port/core ties.hpp tie_transfers (el −1 rinde 0,7) -->

Run against a walking target: tie on the first cycle, stiffening only at 53
(the hunting gene re-ties every time it sees the prey, and each re-tie restarts
the clock) and from there the host drained at a thousand per cycle (from 3000
to 2000 and to 1000 on cycles 54 and 55, corpse at 60), with the parasite
collecting 990. Then it had a child, and that's where the cost of not looking
at who the tied bot is showed up: kid and parent ended up tied to each other,
both ran the sucking gene, took 1000 per cycle from each other, and the parent
ended up dry on cycle 67. The child, which had started with less, stopped at
548 when the other became a corpse.
<!-- probado: 800x600, semilla 1, 80 ciclos, --cada 1: lazo en el ciclo 1 (puerto 2: el 1 del gen six más el .tie inc del gen 10), multi al 53, huesped 3000 -> 2000 -> 1000 (ciclos 54-55) -> cadaver al 60; hijo al 56, padre e hijo a −300 netos por ciclo, padre cadaver al 67, hijo frena en 548; re-corrido (--cada 10): multi al 60, huesped cadaver al 60, padre cadaver al 70, hijo frena en 548.25 -->

The bot also has a gene that promises to suck 1000 per cycle with `−1`, and a
“hacker” gene that would write a 0 into the tied bot's [[.up]] to stop it.
Together the two do neither: the hacker overwrites `.tieloc` with the address
of `.up` (the transfer asks for a negative `.tieloc`) and leaves `.tienum`
reading a cell that nobody ever wrote, so the write into someone else's memory
doesn't go out either. The host, meanwhile, never let up: it kept pushing flat
out (its [[.vel]] read 40 the whole run) until it ended up pressed against the
field wall, with the stretched tie holding it.
<!-- Leechbot genes 12 y nine: *55 .tienum store lee la celda 55 (0 para siempre); .up .tieloc store deja tieloc positivo; probado: el huesped nunca bajo su velocidad (en el campo chico termina apretado contra el borde) -->

## P1 Parasite bot: the remora {#p1-parasito}

_P1 Parasite bot_ (Fizban, 2004) is a tie parasite with manners. It picks its
host: one that shoots ([[.refshoot]] above 0, so it doesn't waste time on
vegetables), that isn't anchored, that doesn't know how to tie ([[.reftie]],
the tie signature) and that doesn't carry its family code, a 666 that it
publishes in [[.out1]] and checks in [[.in1]]:

```adn
' Only a host that shoots, isn't anchored, can't tie
' and doesn't carry my mark: tie it with port 666
cond
*999 0 =
*.numties 0 =
*.eye5 20 >
*.refshoot 0 >
*.reffixed 0 =
*.in1 666 !=
*.reftie 0 =
start
666 .tie store
0 .aimsx store
0 .up store
-1 999 store
stop
```

After tying, it sets its own tie angle to 0: the host always stays in front of
it and travels hanging on like a remora (in the run, the angle hovered around
−17, a fraction of a turn). And once multicellular, it sucks in sips,
depending on how full the other one is:

```adn
' Suck slowly while the host is full
cond
*999 3 =
*.refnrg 2500 >
start
666 .tienum store
-15 .tieval store
-1 .tieloc store
stop
```

Measured against a host with 3000: it takes 15 per cycle (collecting 10.5) and
drops to 10 when the other falls below 2500. It doesn't kill it: it milks it.
At 3050 it asks for a child… which never arrives, because birth needs free
room in front, and in front there's always the host: in 120 cycles nobody was
born. A parasite that doesn't kill its host also fails to multiply.
<!-- P1_Parasite_bot_F1_Fizban_-26.06.04.txt; probado en una variante sin los dos genes de infancia (400x300, semilla 2): atado al ciclo 8, multi al ~28, −15/ciclo (huesped −150 cada 10) y luego −10 (−100 cada 10); 999=4 desde ~36 sin partos en 120 ciclos; 36-REPRO §2 (colisión en el punto de parto); re-corrido contra un huésped que dispara: multi al 30, huesped −150 cada 10 y luego −100 cada 10, 999=4 desde el ~40, sin partos al 120 -->

One detail of the tactic: it also writes things into the host: a 666 in its
`.tienum` and a 628 in its [[.fixang]], so that it keeps it well out in front.
That order doesn't get anywhere: the host calls that tie by its own order
number, not by the parasite's 666, and the instruction is left without a
recipient. The pair still travels together thanks to the parasite's own
`0 .fixang`.
<!-- 34-TIES §0.2 (el puerto es asimétrico: el receptor lo llama por su número de orden); probado: el par sigue junto igual -->

The original bot has a full state machine (a cell of its own, 999, says what to
do: search, tie, settle in, suck, multiply). By the letter of the DNA, in a
normal simulation the offspring is patient: one gene keeps it still as long as
it has any tie and fewer than 75 cycles, and at 75 it declares itself ready;
but the tying gene demands being without ties, so with the birth tie taking up
its slot it can only take a host once that tie breaks by itself, at 100 cycles
(this is read from the genes; we didn't measure it with real parents). In our
test without parents it tied right away, and that's where the other assumption
showed up: the offspring overwrites with its −2 the −1 that the tying left,
the machine is left asleep and the offspring spends the run towing the host
without sucking anything from it. The lesson holds for this whole chapter:
these designs depend on assumptions (“if I have a tie it's because I was
born”) that are worth rereading when the world changes.
<!-- 34-TIES §1 (lazo de nacimiento: 100 ciclos, puerto 0); P1 genes de cría (*.robage 75, *.numties 0 != → −2; *.robage 75 = → 0; el gen de atado pide *.numties 0 =); probado con el bot original contra un huésped que dispara (400x300, semilla 2, 130 ciclos): atado al ~8, 999=−2 hasta el 75, luego 999=0 con el lazo puesto: remolca y no chupa; re-corrido: idéntico; con un huésped pacífico nunca ata (el gen exige *.refshoot 0 >) -->

## The virus that takes over {#takeover}

The second path doesn't steal the other's energy: it steals its future. A virus
inserts a gene into the victim's DNA and, from the next cycle on, that gene
runs as if it were its own ([[simulacion/virus#infeccion]]); the DNA always
accepts it, unless it's already at the limit of 32000 words. You've seen the
epidemic recipe: package the gene with [[.thisgene]] so the infected one makes
and shoots more copies ([[simulacion/virus#epidemia]]).

_virusparttakeover_ (Spork/Shadowgod, 2014) is an _Animal Minimalis_ with an
extra gene that does exactly that, and incidentally trims the host's DNA:

```adn
' The takeover gene, exactly as it is in the bot
cond
start
*.genes *.thisgene *.genes sub sgn 1 add sub .delgene *51 1 sub abs mult store
1 51 store
0 51 *.repro sgn 0 floor mult store
.tie inc
*.thisgene .mkvirus store
.vshoot inc
stop
```

The first line deletes, with [[.delgene]], the host's last gene that isn't the
virus itself. The third should unlock the deletion for the next cycle… and it
doesn't work: the stack ends up backwards and the command is written to
address 0, which doesn't point to any cell. Measured result: one trimmed gene,
just one, the first time the gene runs. In the maker itself, that
trimmed gene is the reproduction one: the bot castrates itself on its first
cycle and never has children again.
<!-- virusparttakeover_F1_Spork_Shadowgod_8-13-2014.txt.txt; verificado el apilado a mano y probado aislado: borra exactamente un gen (5 -> 4 en el bot entero, 2 -> 1 en la prueba aislada) y *51 queda en 1 para siempre -->

The rest does work, and very well. `.tie inc` ties whoever is nearby, and
`*.thisgene .mkvirus store` with `.vshoot inc` turns it into a continuous
factory: the gene is long (~35 words), so each copy incubates about 70 cycles,
one virus every ~70, in a random direction. What we measured in a small field,
with the gene alone (without the whole bot's hunting genes):

- At cycle ~75 the first victim receives the gene (one went in, one was
  trimmed: same number of genes, longer DNA) and starts making its own
  viruses.
- At ~155 the second victim gets infected, from the first one, not from the
  bot.
- At ~160 the bot itself catches a copy back: it has the gene twice.
- At ~215 the first victim receives a second copy: with its cell 51 already
  at 1, this one trims nothing, it only adds a gene.

Each infected bot pays for its own shots. The epidemic sustains itself.
<!-- probado (variante con el gen solo como --otro, 300x200, semilla 7, 3 victimas, 240 ciclos): victima 1 dnalen 16 -> 43 al ciclo 80 con vtimer 66; victima 2 dnalen 43 al 160; el bot genes 1 -> 2 al 160; victima 1 genes 2 -> 3 al 220; 35-VIRUS §0.3 (vtimer = 2 x palabras) -->

The whole bot, exactly as it is in the Bestiary, keeps the _Animal Minimalis_
hunting genes and eats its victims with shots before the virus reaches them:
in two runs with three victims each, all six died without being infected.
Still, the virus is the better-thought-out weapon: hunting feeds the current
generation, while the inserted gene wins the war against the whole rival
species, because every child of the victim is born infected.
<!-- probado: 300x200 semilla 7 y 900x700 semilla 5, victimas qty 3, nrg 9000: ninguna infectada (genes 2 hasta morir), el bot termina con 12000-32000 -->

## A minimal sedative {#sedante}

To close, a recipe of our own, built on only one of the two paths: a virus that
neither kills nor drains, it just immobilizes. The injected gene writes 1 into [[.fixpos]], and that's it:
`.fixpos` is a switch that the engine never clears and that physics respects
no matter where the gene landed in the other's DNA or what the host writes
afterwards. Your own mark is what saves you: cell 91 is written before the
sedative gene runs.
<!-- .fixpos: latch (el motor nunca la borra), un bot fijo no recibe fuerzas (30-FISICA §2); 35-VIRUS §3 (la inserción cae en cualquier frontera entre genes) -->

```adn
' Gene 1: mark myself (before gene 3 runs) and move forward
cond
start
1 91 store
10 .up store
stop

' Gene 2: make the virus out of gene 3 and shoot it
cond
*.vtimer 0 =
start
3 .mkvirus store
30 .vshoot store
stop

' Gene 3: the sedative: it only runs in whoever lacks the mark
cond
*91 0 =
start
1 .fixpos store
stop
```

Run against a walking target, in a 300×200 field: at cycle ~15 a virus hit it;
the target was stopped dead (speed 40 to 0, position frozen for the rest of
the run) and its DNA went from 1 gene to 2. The maker kept moving: the mark
works. And it kept shooting: since no infection leaves immunity, every copy
that hits the same host adds a gene to it: by cycle 150 its DNA already
carried seven copies of the sedative, eight genes in total. What the maker
pays is the strength of each shot (here 30, which the cost multiplier doesn't
touch), plus the usual cost of the copy and the shot
([[simulacion/virus#costos]]).
<!-- probado: 300x200, semilla 1, 150 ciclos: victima fixed 1 y vel 0 desde el ~15, clavada en (185,7; 85,7), genes 1 -> 2 -> 8; fabricante fixed 0 toda la corrida; −30 de energia por virus (la fuerza), con todos los costos en 0 -->

And now what do you do with the anchored prey? Whatever you like, calmly:
move in and shoot it as in [[tutoriales/dispara]], or tie to it and suck it dry
like the feeder. Make it epidemic, adding `*.thisgene .mkvirus store` to the
sedative gene? You can, but watch out: viruses don't tell species apart, so an
infected relative makes viruses that can hit you. Every contagious weapon needs
its mark, like cell 91 in this one.

## What to try next {#despues}

- **Let go in time.** Both the feeder and the tie parasite live better if they
  leave the host with an energy floor and look for another: the cutoff is in
  [[tutoriales/alimentador#soltar]] and the threshold is yours to set. P1 does
  something elegant like that with its sips.
- **Delete genes on purpose.** The _takeover_ gene trims one by the mistake of
  a single line; a clean design chooses what to delete. The complete eraser,
  gene by gene until the other is left with no DNA, is built and measured in
  [[simulacion/virus#delgene]].
- **The victims' counter.** Slime stops ties and viruses
  ([[simulacion/defensas]], [[estrategias/defensivos]]). And there are real
  antiviruses: _Animal Minimalis Antivirus_ (Shasta) records the number of each
  gene and, if an infection throws its DNA out of order, deletes the intruder.
  We tried it against the sedative: the gene got in (it left it anchored), the
  antivirus deleted it on the spot and its DNA went back to five genes… but
  what the gene had already written into `.fixpos` isn't undone: it stayed
  motionless to the end. And on top of that it ate my sedative with shots: the
  best defense is still attacking.
   <!-- probado: sedante vs Animal_Minimalis_Antivirus_Shasta.txt, 300x200, semilla 1, --cada 1: genes 5 → 6 al recibir el virus y 6 → 5 al ciclo siguiente, con fixed pasando a 1 en ese mismo ciclo (el gen corrió una vez, escribió .fixpos y fue borrado); el antivirus queda inmóvil y come al sedante (nrg 3000 -> 6115) -->
- **The tournament rules.** If you compete, look at [[param:opt:93]]: the
  stricter levels disqualify for making viruses, for sucking a rival's energy
  through a tie and for deleting genes. Your favorite parasite may be illegal
  without you noticing.
