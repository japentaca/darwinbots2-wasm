---
titulo: Inputs and outputs
resumen: "The twenty channels a bot uses to pass numbers to another: .out and .in by sight, .tout and .tin through a tie."
etiquetas: [communication, out, in, ties, species]
estado: revisada
---
A bot can spy on an address in another bot's memory (with [[.memloc]] or, through a
tie, with [[.tmemloc]]), but the intended way to communicate is to _publish_
numbers for others to read. For that there are two sets of ten
channels, each with its output and its input:

| Channel | You write to | The other bot reads from | Reaches |
|---|---|---|---|
| By sight | [[.out1]] … `.out10` | [[.in1]] … `.in10` | whoever has you in their focus eye, or collides with you |
| Through a tie | [[.tout1]] … `.tout10` | [[.tin1]] … `.tin10` | the bot tied to you, if it is listening to that tie |

The outputs are configuration: the engine never clears them, so writing
them once is enough and the value stays published until you change it. The
inputs are senses: the engine fills them after the DNA runs, so
you always read what the other bot had published in the previous cycle. A newborn
bot starts with all of them at 0; it doesn't inherit the parent's outputs.

By far the most common use is recognizing your own species: everyone writes the
same code to `.out1` and, before shooting, compares `*.in1` with `*.out1`. That's
how _Artemis Minimalis_ from the Bestiary does it, for example. Pick a code other
than 0: 0 is what any bot that doesn't use the channel publishes, and also what
`.in1` is when you aren't seeing anyone.

```adn
' I identify myself with a code
start
555 .out1 store
stop

' I shoot only if what is in front of me is not one of mine
cond
*.eye5 0 >
*.in1 *.out1 !=
start
-1 .shoot store
stop
```

The tie channels are for coordinating a multi-bot organism. By sight, `.in1` is cleared after every run of the DNA; through the tie, `.tin1`
is reloaded every cycle from the tie you are reading and only goes to 0
when that tie stops existing. Parent and child are tied at birth and
can talk through it almost right away: the parent receives the child's data from the
first cycle, and the child receives the parent's when its [[.robage]] reaches 3 (see
[[sysvars/lazos|the tie sysvars]] and [[simulacion/lazos]]). If what you want is
to write directly into the other bot's memory, that is done by [[.tieloc]] and
[[.tieval]].
<!-- 34-TIES §1 (maketie: el creador carga los trefvars al crear la tie), §2 (readtie en P1 con newage ≥ 2; EraseTRefVars si no hay lazo); comprobado con probar-adn (padre e hijo con .tout1/.tin1) -->

<!-- sysvars.yaml .out1/.in1/.tout1/.tin1; 21-MEMORIA §3 (in* régimen A: latencia 1, borrado en el paso 12); 10-CICLO §0.2 (lookoccurr también en colisión); 36-REPRO §2 (el hijo no hereda mem) -->
<!-- Artemis_Minimalis.txt: 555 .out1 store / *.in1 *.out1 != ; sysvars.yaml .memloc/.tmemloc (lectura de la memoria del visto / del atado) -->
