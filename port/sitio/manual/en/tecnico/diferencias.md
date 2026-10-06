---
titulo: Differences from the original 2.48.32
resumen: "What was fixed from the original program, what was deliberately left the same, and how certain we are about the questions the original left open."
etiquetas: [differences, original, fixes, fidelity, port]
estado: revisada
---
This is the page the manual points to every time it says “that's how it was in
the original”. This version's engine is that of DarwinBots 2.48.32, translated:
the same numbers, the same cycle order and the same rules. What changes is the
original program's bugs, fixed on purpose, and nothing else.

Here you'll find the criterion used to decide each fix, the fixes grouped by
topic (with a link to the page that explains them in detail), what was left the
same on purpose, and the questions the original left open.

## The criterion {#criterio}
<!-- port/README.md §Bugs del original corregidos (párrafo intro: sin cambiar el lenguaje del ADN, un bot existente sigue cargando y ejecutando lo mismo; las estadísticas de la sim sí cambian) -->

The rule was to fix without changing the language: the loader, DNA
execution, the operators and the meaning of every sysvar stayed as they were, so a
bot written for the original loads and runs the same as ever. In total, 35 bugs were
fixed, which broadly fall into three families:

- **calculation**: something was computed wrongly or was destroyed instead of
  being transformed (the energy of _shock_, the strength of a virus);
- **limits**: a cap that was misplaced or missing (a value that froze, another
  that went out of the 32000 range);
- **comparison and edge**: something was compared against the wrong cell, or at
  the edge of the world what should happen didn't (the protection of the newborn
  child, a teleporter that didn't move).

What was not touched: the **balance** (the costs, the energy economy,
photosynthesis, the population caps), the **world rules** (the draws and their
order: the cycle is still DNA → senses cleared → shots → forces and collisions
→ movement → actions → births and deaths → the sun) and the engine's
**functions**, which were ported whole even if the app doesn't expose some of
them. Fixing a bug is not redesigning: if an oddity was part of the game the
community knew, it stayed (see [[tecnico/diferencias#igual]]).

:::nota
**The single exception, decided deliberately, is the `else` that follows a
`start`** ([[tecnico/diferencias#adn]]): in the original its body never ran, and
several classic bots in the Bestiary use it counting on it to run. The other
fixes change the figures of a simulation (energy, shots, repopulation, random
numbers consumed); this one also changes what some old bots do.
<!-- port/README A2-1 (else tras cond…start: la única excepción; 9 bots del Bestiario lo usan) -->
:::

That is why a simulation here doesn't give exactly the same numbers as in the
original with the same seed: any fix that changes the random numbers consumed separates
the two runs for good. What is kept is repeatability within this version: the
same seed gives the same run, always (see [[tecnico/semillas]]).

There was also a one-by-one review against the original source that fixed
deviations of the translation itself — roundings and numeric promotions — so
that the numbers come out the way they used to.
<!-- REVISION-PORT.md (pilotos 1-14: RV-01 a RV-45, divergencias del port corregidas) -->

### What is not a fix to the original {#host}

Not everything you notice as different comes from the original: the app and the
site have a layer of their own, and its fixes don't count as corrections.

- **Species seeded by the app were born with mutations on.** It was a defect of
  the web version itself, already fixed; it didn't exist in the Windows program.
  <!-- PLAN-SITIO.md §S-C cap. 3 (bug del host, corregido el 2026-10-04: las especies sembradas nacían con la tabla de mutaciones vacía) -->
- **The loader accepts the line endings of the Bestiary files.** The original
  only read its own; several forum bots, as they are, wouldn't load there. It is
  a decision of the port's own.
  <!-- REVISION-PORT.md RV-04 (el cargador tolera LF; los bots del Bestiario son solo-LF) -->
- **The interface is different.** The new app is not the Windows program; the
  closest one is the [[app/clasica]]. See [[empezar/preguntas#diferencias]].

Nothing in that layer writes to the simulation: a run saves and loads the same
with any view on or off.

## The DNA and how it runs {#adn}

```adn
' In the original, the else never ran: address 60 stayed at 0
cond
 *50 0 >
start
 1 60 store
else
 2 60 store
stop
```

With 50 at 0, this bot writes 2 to 60: the `else` runs when the gene's
conditions are false, as the original's help promised. That was the most
awkward bug of 2.48.32: the body of an `else` after a `start` **never** ran,
whether the condition was true or false, even though the documentation said
otherwise. Here it runs, and the numbering of the genes doesn't change. The
Bestiary bots that use it — Lionfish, Zer0Bot, TRON_F1 and several by
Moonfisher — behave the way their authors expected, not the way the program let
them behave. The details are in [[adn/genes#else]] and [[operadores/else]].
<!-- port/README A2-1; probado con probar-adn: *50 en 0 escribe 2, en 5 escribe 1; re-corrido por el revisor: idéntico (60 = 2 con *50 en 0, 60 = 1 con *50 en 5) -->

One more of the same family:

- A file made only of `def`, without a single gene, jammed part of every cycle
  of the entire simulation. Here the bot simply lives without doing anything
  ([[adn/def#rarezas]]).
  <!-- 20-VM §2.3 y §14 (bomba de tick: error 9 cada ciclo); port: comportamiento definido -->

## Shots and viruses {#disparos}
<!-- port/README B3-1, B3-2, B3-5, B3-6, B3b-1, B3b-2, B3b-3 -->

- **The newborn child's protection works.** In the original the bots' numbers
  were compared wrongly, so a parent that was shooting hit the offspring it had
  just had, almost every time. Here the child is immune to its parent's shots
  during its first two cycles of life. We measured it: a parent that shoots
  straight ahead and reproduces leaves the child in the line of fire, and the
  shots pass through it without touching it; the first hit comes later, when the
  protection no longer applies.
  <!-- port/README B3-1; probado con probar-adn: el hijo no pierde energia los primeros ciclos; primer -1 en el ciclo 6 -->
- **A dead bot's shot still hits.** If the shooter dies and another bot takes
  its slot in the list, in the original the shot that was still flying couldn't
  hit that slot's new occupant. Here it hits whoever it reaches, and the deaths
  it causes are credited to the real shooter, not to whoever ended up in its
  slot.
  <!-- port/README B3-2 -->
- **The earliest hit wins.** If two bots cross the same stretch of the same
  shot, the one the shot reaches first wins; in the original the lowest-index
  one or the last one won, depending on the case.
  <!-- port/README B3-5 -->
- **Waste that arrives by shot is capped at 32000** right away, without
  letting a peak through above it.
  <!-- port/README B3-6 -->

Viruses had three bugs: **shooting them was charged twice** (here, once); **the
strength depended on the number of the gene copied** (copying gene 7 infected
seven times harder than gene 1); and **going through slime strengthened the
virus** instead of using it up. All three are fixed, and that is why slime
protects much more than in the original ([[simulacion/virus]]). The complete
shots mechanism is in [[simulacion/disparos]].

## Energy, body and chloroplasts {#energia}
<!-- port/README A1-1, A3-7, A3-10, B6-2, B6-4 -->

- **_Shock_ converts energy into body.** A bot that suddenly loses more than
  half its energy, while still having more than 3000 left, should pour
  everything it has left into its body; the original destroyed it along the way.
  Measured: 10000 energy and a purchase of 6000 chloroplasts leave a corpse with
  1400 body; in the original the corpse ended up at 1000, without the converted
  energy ([[simulacion/energia#shock]]).
  <!-- port/README A1-1; probado con probar-adn: 10000 nrg, 6000 .mkchlr con costo 1 → cadaver con 1400 de cuerpo -->
- **The child's body is the exact share.** In the original it was rounded to an
  integer: with 501 body and a 50% birth, the child ended up with 250. Here it
  gets 250.5, and the parent 250.5 ([[simulacion/reproduccion#reparto]]).
  <!-- port/README B6-4; probado con probar-adn: 1000.5 de cuerpo → dos bots con 500.25 -->
- **A negative command to fatten or slim is ignored.** Writing a negative
  number to `.strbody` or `.fdbody` no longer does anything strange: it is
  cleared with no effect.
  <!-- port/README A3-7 -->
- **Removing chloroplasts with a negative number no longer buys them.** In the
  original, `rmchlr` with −100 added 100 chloroplasts.
  <!-- port/README A3-10 -->
- **The lottery for crowded vegetables is one in eleven in sexual reproduction
  too.** In the original, the sexual kind used one in ten
  ([[simulacion/cloroplastos#tope]]).
  <!-- port/README B6-2 -->

## Senses and vision {#sentidos}
<!-- port/README A3-1, A3-2, A3-3, A3-4, A3-5, B2-1, B2-3, B2-4, B2-5 -->

Five of the usual senses:

- [[.refvelsx]] **was always 0**; now it is the real lateral speed of what is
  seen, with the sign flipped, as expected.
  <!-- port/README A3-1; simulacion/vision -->
- [[.trefshell]] **was never cleared**: once the tie was lost, you kept reading
  the last partner's shell. Now it is cleared along with the other tie sysvars.
  <!-- port/README A3-2; sysvars/trefshell -->
- [[.trefnrg]] **froze at exactly 32000**: a partner with energy at the cap left
  the reading stuck at the previous value. Now it is capped, and that's it.
  <!-- port/README A3-3; sysvars/trefnrg -->
- **Eye spying through a tie read the wrong address**, so a multibot couldn't
  see what its partner was looking at. Now it reads the right one.
  <!-- port/README A3-4 -->
- [[.kills]] **no longer goes past 32000**: the death counter is also capped
  when the victim dies by a shot, which was the path with no cap.
  <!-- port/README A3-5 -->

And the **vision of shapes** had four errors at once: a shape's shadow didn't
match the shape (it was rotated and covered too much), the width of the eyes was
computed differently for shapes than for bots, [[.eyef]] didn't rise to 32000
for a bot inside a shape, and the shape's position was only correct if the focus
eye was the front one. All fixed ([[simulacion/vision]]).
<!-- port/README B2-1, B2-3, B2-4, B2-5 -->

## Ties {#lazos}
<!-- port/README B4-1, B4-2, B1-1, B1-2 -->

- **A new tie is born blank.** In the original it inherited the angle and length
  set by the previous occupant of that slot, and a multibot could end up looking
  twisted without having asked for anything.
  <!-- port/README B4-1 -->
- **Sharing through a tie with full tanks no longer destroys the excess.**
  `sharenrg` and company pass what is left over to the other end, up to its own
  cap; in the original it evaporated ([[simulacion/lazos]]).
  <!-- port/README B4-2 -->
- **The turn that a stiffened tie orders pushes the partner toward the correct
  side**, and the adjustment is applied to the tie you set, not to the first
  free gap in the list. Two bugs in the same routine of the original.
  <!-- port/README B1-1, B1-2 -->

## Reproduction and mutations {#reproduccion}
<!-- port/README A1-5, B6-5, B6-7, B6-9 -->

- **A bot signs up to reproduce only once per cycle.** In the original it could
  end up signed up twice, once for the asexual birth and once for the sexual
  one; here, if the sexual one goes ahead, the asexual one waits
  ([[simulacion/reproduccion]], [[simulacion/ciclo]]).
  <!-- port/README A1-5 -->
- **The safety floors that slow down the mutations of a giant bot are no longer
  written into its rate table.** In the original they were inherited, and
  long-DNA lineages drifted toward them
  ([[simulacion/mutaciones#tasas]]).
  <!-- port/README B6-5 (los suelos anti-congelación ya no reescriben las tasas heredables) -->
- **An insertion counts one mutation** per instruction added; the original
  counted two, and the history ended up inflated.
  <!-- port/README B6-7; simulacion/mutaciones#efectos -->
- **A mutation during a bot's life refreshes the DNA signature.** In the original, what
  others saw with [[sysvars/ref|the `ref*` sysvars]] stayed the old signature
  until the next birth; here it is rebuilt on the spot.
  <!-- port/README B6-9; simulacion/mutaciones#efectos -->

## The world {#mundo}
<!-- port/README A1-3, B7-1, B7-3, B7-4 -->

- **The memory-pressure culling no longer fires without a candidate.** It was a
  leftover of a loop in the original: when it ran out of bots to kill, it still
  called the kill routine, with no bot in it
  ([[simulacion/muerte#memoria]]).
  <!-- port/README A1-3; OPEN_QUESTIONS.md Q03 (KillRobot(0) alcanzable desde la matanza por presión de memoria) -->
- **Vegetable repopulation doesn't draw coordinates just to discard them.** The
  original drew a spot, threw it away if it fell in a species' zone, and started
  over: it consumed extra random numbers. Here it seeds directly.
  <!-- port/README B7-1 -->
- **A teleporter with only one drift axis moves.** In the original it
  accumulated speed that it never applied, and ended up stuck.
  <!-- port/README B7-3 -->
- **The first repopulation after loading a saved simulation takes as long as it
  should.** In the original the wait was paid twice the first time
  ([[simulacion/cloroplastos#repoblacion]]).
  <!-- port/README B7-4 -->

## What was deliberately left the same {#igual}
<!-- port/README §Conservados, y por qué -->

Fixing bugs is not redesigning. Many oddities of 2.48.32 were kept because
**the DNA sees them**: changing them would change what a bot written for that
version means, with the bots the community evolved on top of it. Others were
kept because they are **mechanics, not bugs**: design decisions of the original
that break nothing. And those with no **observable effect** nobody will notice.
The breakdown:

| Oddity kept | Where it is covered |
|---|---|
| With `def` in the DNA, the first token is lost if it doesn't open a gene | [[adn/estructura#cero-inicial]] |
| The asymmetries of the stack operators | [[adn/pilas]] |
| Approximate comparisons are always false with a negative reference | [[operadores/casi-igual]] |
| Setting a tie's angle or length only works with the two-operand stores | [[adn/stores]] |
| `mkvirus` doesn't clear itself: you have to clean it up by hand | [[simulacion/virus]] |
| A negative eye width makes it panoramic | [[simulacion/vision]] |
| A `.shoot` that is an exact multiple of 1000 comes out as sperm | [[simulacion/disparos]] |
| The birth tie uses port 0 | [[simulacion/lazos]] |
| [[.fixang]] with 32000 releases the angle instead of fixing it | [[adn/stores]] |
| [[.hitang]] has a name but nobody writes it: it is free memory | [[adn/memoria]] |
<!-- port/README §Conservados: «los ve el ADN» (A2-2/B6-1, A2-3 a A2-7 — la de las comparaciones aproximadas es A2-4, la de los stores de dos operandos en .tieang/.tielen es A2-6 —, B3b-4, B2-2, B3-3, B4-3, A3-8, A3-6); 70-CASOS-DORADOS §11 (tabla A2-4 = «%=~/~= con referencia negativa siempre falsos», A2-6 = «flags de tie solo en stores de 2 operandos») -->

Mechanics, not bugs: a whole organism respects the edges of the toroidal world
as if it were a single bot; corpses collide; a bot can reproduce in the cycle
it dies ([[simulacion/muerte]]); the mixing in sexual reproduction loses
stretches of DNA, as it came out in the original ([[simulacion/reproduccion]]);
and the rules for switching venom and poison and the floor of the cost of
moving are what they were ([[simulacion/defensas]]). The original's anti-giant
rule wasn't touched either: its threshold is above the body cap, so it never
acts — in either version ([[simulacion/muerte]]).

And the **file format**: the original's simulations and bots are read and
written in the same format as ever, oddities included, so that a `.dbsim` or a
`.txt` from that era keeps working ([[tecnico/formatos]]).

## The questions the original left open {#preguntas}
<!-- OPEN_QUESTIONS.md (Q01-Q17, con sus estados); REVISION-PORT.md RV-31 (criterio de fuente secundaria) -->

Rebuilding the engine raised questions that the source alone can't answer: how
the executable behaved in detail. And the executable doesn't run on today's
Windows, so it can't be checked against the binary. Those questions were closed
where possible, and it is worth knowing how certain each answer is:

- **The random number generator was reconstructed from a secondary source**:
  the runtime reimplementation published by the language's own maker, which
  documents the exact algorithm. By construction, the port draws the same
  numbers in the same order as the original; the seeds, the replicates and the
  repetitions of [[tecnico/semillas]] come from there.
  <!-- OPEN_QUESTIONS.md Q02 (RESUELTA con fuente externa: dotnet/runtime, VBMath.vb/ProjectData.vb, coherente con MS KB231847) -->
- **What the executable did on a number overflow** was settled with the
  documentation of the processor's and the compiler's makers: the binary was
  compiled with the checks on, so an overflow cut the cycle short with an error.
  The port defines an explicit behavior at each of those sites instead of cutting
  it short.
  <!-- OPEN_QUESTIONS.md Q17 (RESUELTA con Intel SDM y la corrección de flags), Q08, Q07 -->
- **Floating-point arithmetic** keeps a residual rounding difference, inherited
  from the hardware of the time, which can't be measured without the binary. The
  physics cases were defined with a tolerance; the port is deterministic with
  itself, platform by platform, with the same operation always giving the same
  number.
  <!-- OPEN_QUESTIONS.md Q07 (RESUELTA como decisión de port: IEEE 754 estricto por operación) -->
- The rest — what consumes random numbers and when (Q01), the birth queue and
  its double queuing (Q13), the absolute identity of the bots (Q14) and what the
  engine writes to memory outside the interpreter (Q15) — was settled by reading
  the original source down to the detail.
  <!-- OPEN_QUESTIONS.md Q01, Q13, Q14, Q15 (RESUELTAS por análisis del fuente) -->

## If you find a new difference {#reportar}

If a simulation behaves differently from what this manual says, it is a bug in
the manual or in the port, and reporting it helps. The project's repository is
public ([github.com/japentaca/darwinbots2-wasm](https://github.com/japentaca/darwinbots2-wasm),
linked on the site's home page): open an issue with what happened, and if you
can, the exported scenario and the seed, since with those the run repeats
exactly ([[tecnico/semillas]]). If it is an oddity of the **original** that
doesn't appear on this page, it probably stayed the same on purpose: say so
anyway, and we'll decide whether it's a bug or character.
<!-- port/sitio/publico/index.html (botón «Código fuente» → https://github.com/japentaca/darwinbots2-wasm); verificado que el enlace existe en la portada -->

How the port was made, layer by layer, is in [[tecnico/como-esta-hecho]]; where
each thing comes from, in [[tecnico/creditos]].
