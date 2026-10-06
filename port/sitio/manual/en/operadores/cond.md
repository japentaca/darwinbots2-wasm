---
titulo: cond
resumen: "Opens a new gene: empties the boolean stack and starts the condition section, which ends at start or else."
etiquetas: [cond, gene, conditions, flow]
estado: revisada
---
<!-- 20-VM §5.1 (cond: COND, currgene+1, limpia bools), §1 (stores solo en body/elsebody), §4 (tipo 9 sin gate, FLOWCOST); comprobado en el port -->

`cond` opens a gene. From there to the [[op:start]] (or the [[op:else]]) is
the condition section: comparisons such as [[op:>]] or [[op:=]] that leave
trues and falses on the [[adn/pilas|boolean stack]]. When `start` is reached,
the body runs only if all of them are true.

```adn
' reproduces if it has more than 5000 energy and sees nothing ahead
cond
 *.nrg 5000 >
 *.eye5 0 =
start
 50 .repro store
stop
```

<!-- 21-MEMORIA §3 (régimen A, latencia 1); comprobado en el port: con 3000 de energía y umbral 2000 se divide en el ciclo 2 -->
The two conditions, on [[.nrg]] and [[.eye5]], are joined with _and_ without
writing anything more; for an _or_ you need [[op:or]]. With 6000 energy the bot
divides with [[.repro]] in the second cycle, not the first: the senses are
published at the end of each cycle and in the first one they are still 0 (see
[[adn/ejecucion]]).

What is worth knowing about `cond`:

- It **empties the boolean stack** at the start. It is the only marker that
  always empties it ([[op:start]], [[op:else]] and [[op:stop]] do so only when
  they close a condition section), so starting a gene with `cond` protects it
  from conditions left over from before (see [[adn/pilas#rareza]]).
- In the condition section everything runs **except stores**: you can
  calculate, but a [[op:store]] there does not write and pops nothing from the
  stack.
- A `cond` without conditions, followed by `start`, always runs.
- A `cond` in the middle of a body closes that gene and opens another, even if
  the [[op:stop]] is missing.
- Each `cond` counts as a new gene in [[.genes]] and [[.thisgene]].

The complete structure of the gene is in [[adn/genes]].
