---
titulo: false
resumen: "Pushes a false onto the boolean stack. In a gene's condition it turns it off; in the body it blocks the stores that follow."
etiquetas: [logic, boolean stack, constant]
estado: revisada
---
<!-- 20-VM §6.5 (false), §5.2 (AddupCond), §4 (gate de stores; store salteado no hace pops); comprobado en el port -->

`false` pushes a _false_ onto the boolean stack, without looking at anything.

It has a very handy practical use: **turning a gene off** without deleting it.
Since `start` does the _and_ of all the conditions, a `false` between `cond` and
`start` makes the body never run, whatever the others are:

```adn
' gene turned off while you test something else
cond
  false
  *.nrg 1000 >
start
  10 .up store
stop

cond
start
  50 inc
stop
```

The first gene does nothing; the second runs anyway, because its `cond` starts
with a clean boolean stack. To turn it back on, delete the `false`.

Inside the body, a `false` blocks all the stores that come after it, until
something pops it or covers it ([[op:dropbool]], [[op:clearbool]], [[op:true]]
or another condition).

:::cuidado
A blocked store pops nothing from the integer stack: its value and its address
stay there and the next store that does run may find them. It is explained in
[[adn/condiciones#dos-trampas]].
:::

Its opposite is [[op:true]].
