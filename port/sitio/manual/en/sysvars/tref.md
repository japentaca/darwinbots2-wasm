---
titulo: What it feels through a tie (tref*)
resumen: "The sysvars that tell you how the tied bot on the other side of a tie is doing: energy, body, age, position, velocity, signature and one cell of its memory."
etiquetas: [ties, tref, senses, multibot]
estado: revisada
---
A tie doesn't just join two bots: it is also a channel through which each one _feels_ the
other. The `tref*` sysvars are to ties what the [[sysvars/ref|ref*]] are to sight: instead of
describing what the eye sees, they describe the bot on the other side
of a tie, whether or not you can see it.

## Which tie is read {#que-lazo}
<!-- 34-TIES §1 (el creador carga los trefvars al crear la tie), §2 (readtie P1, gate newage >= 2, puerto o tiepres; si no existe, EraseTRefVars); 10-CICLO §2 (ADN en el paso 10, UpdateBots después); core ties.hpp readtie -->

A bot can have several ties, but the `tref*` describe only one at a time: the one
with the port you put in [[.readtie]] or, if `.readtie` is 0, the one in
[[.tiepres]] (the most recently created tie). If there is no tie with that port, or the
bot has run out of ties, they all go to 0. Ports are explained in
[[simulacion/lazos]].

The engine loads them after the DNA runs, so your DNA always reads the snapshot
taken in the previous cycle. Two timing details, checked by running it:

- A newborn child doesn't feel its parent until its fourth cycle of life (when
  its [[.robage]] is 3). The one that creates the tie, on the other hand, feels it from the next
  cycle.
- When the tie is broken, the `tref*` still keep their last value for one
  cycle. If your gene depends on them, add `*.numties 0 >` ([[.numties]]).

## What you can know {#que-se-sabe}
<!-- sysvars.yaml 437-449, 456-465, 475, 478, 479; core ties.hpp ReadTRefVars (también copia tout1-10 del atado en tin1-10) -->

| What | Sysvars |
|---|---|
| State | [[.trefnrg]], [[.trefbody]], [[.trefage]], [[.trefshell]], [[.treffixed]] |
| Where it is and where it points | [[.trefxpos]], [[.trefypos]], [[.trefaim]] |
| How it moves, seen from you | [[.trefvelmyup]], [[.trefvelmydn]], [[.trefvelmysx]], [[.trefvelmydx]] |
| How it moves, by its own measure | [[.trefvelyourup]], [[.trefvelyourdn]], [[.trefvelyoursx]], [[.trefvelyourdx]], [[.trefvelscalar]] |
| Its signature (what its DNA does) | [[.trefup]], [[.trefdn]], [[.trefsx]], [[.trefdx]], [[.trefaimdx]], [[.trefaimsx]], [[.trefshoot]], [[.trefeye]] |

In addition, the channels [[.tin1]]…`.tin10` arrive through the same tie, along with any one
cell of the other bot's memory via [[.tmemloc]] and [[.tmemval]].

The most used in the Bestiary is, by far, [[.trefeye]] (compared with [[.myeye]] to
tell whether the other is of your species); next come [[.trefnrg]], [[.trefxpos]] and
[[.trefage]] (the latter, to tell which is the parent and which is the child). This bot
reproduces and the child, as soon as it feels that the tied bot is older than it is, breaks
the tie with [[.deltie]]:

```adn
' Reproduces at 10 cycles
cond
*.robage 10 =
start
50 .repro store
stop

' If the tied bot is older than I am (my parent), I break the tie
cond
*.numties 0 >
*.trefage *.robage >
start
*.tiepres .deltie store
stop
```

The parent never breaks it: to it, the tied bot is younger. The child breaks it in its
fourth cycle, the first one in which it feels its parent.
