---
titulo: Logic
resumen: "The boolean stack operators: and, or, xor and not to combine conditions, true and false, and the tools to rearrange that stack."
etiquetas: [logic, boolean stack, conditions, operators]
estado: revisada
---
<!-- 20-VM §6.5, §6.6, §3 (vacío = verdadero), §4 (gate de stores); opcodes.yaml logicos; comprobado en el port -->

The logic operators work only with the [[adn/pilas#booleana|boolean stack]],
the stack of trues and falses that the
[[operadores/comparaciones|comparisons]] fill. They don't touch the integer
stack. They come in three kinds:

- **Combine**: [[op:and]], [[op:or]] and [[op:xor]] replace the top two values
  with one; [[op:not]] inverts the top one.
- **Constants**: [[op:true]] and [[op:false]] push a fixed value.
- **Rearrange the stack**: [[op:dropbool]], [[op:clearbool]], [[op:dupbool]],
  [[op:swapbool]] and [[op:overbool]], the same tools the integer stack has
  among the [[operadores/basicos|basics]].

Between `cond` and `start` the one you need most is `or`, because the _and_ is
already supplied by `start`, which joins with _and_ everything left on the
boolean stack.

Inside the body of a gene they change roles: each store looks at the top value
of the boolean stack and, if it is false, doesn't write (see
[[adn/condiciones]]). There `not`, `true`, `dropbool` and `clearbool` are used
to decide which stores run. This bot moves forward if it sees something with
the middle eye ([[.eye5]]) and, if not, turns; at the end it leaves the stack
clean for the next gene:

```adn
' if it sees something, moves forward; otherwise turns
cond
start
  *.eye5 0 >
  20 .up store
  not
  60 .aimdx store
  clearbool
stop
```

One rule holds for all of them: **an empty boolean stack counts as true**. When
an operator is missing an operand, it replaces it with true, and that's why
some give surprising results with an empty stack or with a single value:
`not` on an empty stack gives false, and `or` with a single value always gives
true. Each page goes into the details, and the overview of the two stacks is in
[[adn/pilas]].

Each logic operator executed charges the cost [[param:cost:6]] from the
scenario settings.
