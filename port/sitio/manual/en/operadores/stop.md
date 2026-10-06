---
titulo: stop
resumen: "Closes the gene: whatever follows, up to the next marker, is not executed."
etiquetas: [stop, gene, flow]
estado: revisada
---
<!-- 20-VM §5.3 (stop: CLEAR, ingene=False; no limpia la pila booleana), §4, §5.5; comprobado en el port -->

`stop` closes the gene. From there to the next [[op:cond]], [[op:start]] or
[[op:else]], nothing is executed: not even numbers are pushed. It is the
normal close of `cond … start … stop`.

Strictly speaking it isn't always needed: a `cond` closes the previous gene
even if its `stop` is missing. But putting it in makes it clear where each gene
ends, and keeps code you add later from ending up inside by accident.

What `stop` does **not** do is empty the [[adn/pilas|boolean stack]]. If you
put an inline condition inside the body, its result stays on top of the stack
and blocks the stores of the next gene if that gene doesn't begin with `cond`:

```adn
' the first gene's condition keeps ruling after the stop
start
 *.robage 5 >
 10 .up store
stop
start
 1 51 store
stop
cond
start
 1 52 store
stop
```

Cell 52 holds 1 from the first cycle. Cell 51, in contrast, stays at 0 for the
first six cycles of life: as long as [[.robage]] doesn't go past 5, the false from the first
gene reaches the second `start` intact and skips its store. The third gene
doesn't have the problem because its `cond` empties the stack. More on this in
[[adn/pilas#rareza]].

An [[op:else]] that comes after a `stop` never runs. Each `stop` charges its
marker cost in every cycle, whether or not the gene runs (see
[[adn/ejecucion]]).
