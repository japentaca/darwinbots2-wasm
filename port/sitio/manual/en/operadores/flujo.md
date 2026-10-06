---
titulo: Flow
resumen: "cond, start, else, stop and end: the markers that build genes and decide which parts of the DNA run each cycle."
etiquetas: [flow, gene, cond, start, else, stop]
estado: revisada
---
<!-- 20-VM §4 (tipo 9 sin gate, FLOWCOST siempre; mem(341) = currgene), §5.1-5.6; opcodes.yaml flujo, flujo_maestro; core vm.hpp ExecuteFlowCommands (else corregido, A2-1) -->

These words don't calculate anything and don't touch the integer stack: they
organize the DNA into _genes_. The whole DNA is walked, left to right, every
cycle, and each marker changes the interpreter's state as it goes by:

- [[op:cond]] opens a gene and its condition section.
- [[op:start]] closes the conditions and opens the body, which runs if all the
  conditions came out true.
- [[op:else]] opens an alternative body, which runs if they came out false.
- [[op:stop]] closes the gene.
- [[op:end]] ends the DNA; anything after it is not executed.

Almost every gene has the form `cond … start … stop`, with `else` when you
need an "otherwise":

```adn
' moves forward while it has more than 2000 energy; otherwise turns
cond
 *.nrg 2000 >
start
 20 .up store
else
 50 .aimdx store
stop
```

There is no nesting and there are no blocks: the markers are flat. A `cond`
anywhere opens a new gene even if the previous one is missing its `stop`, and
whatever lies outside a gene (before the first marker, or between a `stop` and
the next one) is not executed.

Unlike the rest of the words, `cond`, `start`, `else` and `stop` are always
processed, even when the gene is being skipped, and they charge their cost
every time. After each one, the engine records the number of the current gene
in [[.thisgene]]. `end` costs nothing: that's where the walk stops.

All of this, with more examples and the numbering of genes, is in
[[adn/genes]]. How conditions combine is in [[adn/condiciones]].
