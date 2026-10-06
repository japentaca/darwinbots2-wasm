---
titulo: debugbool
resumen: "Notes the value on top of the boolean stack so you can look at it from the bot's console, at no cost."
etiquetas: [debugging, console, boolean, advanced]
estado: revisada
---
<!-- 20-VM §3 (CBool(−5) = True), §6.2 (debugbool: sobre vacío apila True; sin coste); comprobado en el port -->

`debugbool` looks at the value on top of the [[adn/pilas#booleana|boolean
stack]], _true_ or _false_, and notes it in the bot's trace along with the
position of the word in the DNA. It is the counterpart of [[op:debugint]],
useful for finding out what a condition gave. It costs no energy.

```adn
cond
  *.nrg 1000 >
  debugbool
start
  10 .up store
stop
```

You look at the trace with the `debug` command in the bot's console, in the
[[app/inspector|inspector]], and it shows the last cycle.

There is one case in which it does change something: **with an empty boolean
stack it pushes a _true_**. You almost never notice, because an empty stack
already counts as true, but it changes how many values there are. For example,
in `debugbool 1 2 = swapbool` the [[op:swapbool]] has two values to swap and
leaves the _true_ on top; without the `debugbool`, there would be only one
_false_, the `swapbool` would do nothing and that _false_ would block the
stores that follow.
