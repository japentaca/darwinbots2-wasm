---
titulo: .repro
resumen: "Orders an asexual reproduction: the number is the percentage of energy, body and chloroplasts that the child takes."
etiquetas: [reproduction, asexual, action]
estado: revisada
---
<!-- 36-REPRO §2 (reparto: hijo nnrg·0,999, padre nrg − nnrg − nnrg·0,001); comprobado: 30 % de 3000/1000 deja 899,1/300 al hijo y 2099,1/700 al padre -->
Write a percentage and, if it can be done, the bot has a child at the end of that
same cycle. With `30 .repro store` and 3000 energy and 1000 body, the child is born with
about 900 energy and 300 body, and the parent keeps about 2100 and 700 (a thousandth
is lost in the handover). Chloroplasts and waste are split
the same way.

```adn
' It splits in two when it gathers energy
cond
 *.nrg 6000 >
start
 50 .repro store
stop
```

<!-- 36-REPRO §0.4, §0.5, §2 (guardas en orden; colisión en el punto de parto) -->
What you need to know:

- **Modulo 100.** The remainder of dividing by 100 is used: `100` is 0 (there is never a child) and
  `150` is 50. A value of 0 or less does nothing.
- **It persists until it succeeds.** The engine clears `.repro` only when the child is born. If
  the birth fails, the order stays there and is retried every cycle, even if the gene that
  wrote it no longer runs. To cancel it, write `0 .repro store`.
- **Why it can fail.** Either the bot has less than 5 body, or it has no
  energy, or the spot where the child has to appear is occupied by another bot,
  occupied by an obstacle, or outside the field. It happens, for example, to a child
  that wants to reproduce as soon as it is born, while still stuck to its parent.
- **Cost.** Besides the thousandth that is lost, the birth can charge for the length
  of the DNA ([[param:cost:25]]).

<!-- 36-REPRO §1 (1 RNG entre repro y mrepro); port/README A1-5 (si procede la sexual, la asexual espera) -->
If `.repro` and [[.mrepro]] are both set in the same cycle, a coin flip decides which of the two
percentages is used. If the bot is fertilized and has [[.sexrepro]] written, that
cycle it only tries sexual reproduction and the asexual one waits, even if the sexual one
ends up failing. The rest of the
process is in [[sysvars/reproduccion]] and [[simulacion/reproduccion]].
