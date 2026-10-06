---
titulo: else
resumen: "Opens the alternative body of a gene, which runs when the conditions of the cond came out false."
etiquetas: [else, gene, otherwise, flow]
estado: revisada
---
<!-- 20-VM §5.4 describe el original (else tras start muerto); core vm.hpp ExecuteFlowCommands (elseok/elsecond, A2-1); port/README.md «Bugs del original corregidos»; comprobado en el port -->

`else` is the gene's “otherwise”. In `cond C start A else B stop`, body `A`
runs when the conditions `C` are true and `B` when they are false. They never
both run in the same cycle.

```adn
' moves forward while it has more than 2000 energy; otherwise, it turns
cond
 *.nrg 2000 >
start
 20 .up store
else
 50 .aimdx store
stop
```

<!-- 21-MEMORIA §3 (régimen A, latencia 1); comprobado en el port: el else corre en el ciclo 1 y el start desde el 2 -->
With 2500 energy the bot moves forward with [[.up]]; with 1500 it stays still
and turns with [[.aimdx]]. Note one detail: in the **first cycle** it turns even
if it has 2500, because [[.nrg]] is still 0 and the condition comes out false.
The senses arrive only from the second cycle (see [[adn/ejecucion]]).

It is also valid right next to the conditions, without `start`:
`cond C else B stop` runs `B` only when `C` is false, and there is no body for
the true case.

An `else` that has no `cond … start` (or a `cond`) right before it **never
runs**: after a `start` without `cond`, after a [[op:stop]] or after another
`else`.

:::cuidado
In the original DarwinBots 2.48.32, the body of an `else` that came after a
`start` never ran, whether the condition was true or false. This version fixes
it, so old bots that use `start … else` behave differently than in the original.
See [[adn/genes#else]] and [[tecnico/diferencias]].
:::

The `else` counts as a separate gene in [[.genes]] and [[.thisgene]]: in
`cond … start … else … stop` there are two genes.
