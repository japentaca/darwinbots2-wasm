---
titulo: and
resumen: "Replaces the top two values of the boolean stack with one: true only if both are."
etiquetas: [logic, boolean stack, and]
estado: revisada
---
<!-- 20-VM §6.5 (and: b ausente → verdadero; a ausente → b), §5.2 (AddupCond), §6.6; comprobado en el port -->

`and` pops the top two values of the boolean stack and pushes _true_ if both
are true, and _false_ in any other case.

Between `cond` and `start` you almost never need to write it: `start` already
joins all the conditions with an _and_. You need it when an [[op:or]] is in
play, because each logic word combines only the top two. This gene counts in
cell 50 the cycles in which (it sees something **and** it is not of its own
species) **or** it is less than 10 cycles old:

```adn
' (it sees another bot and it is not one of its own) or it is very young
cond
  *.eye5 0 >
  *.refeye *.myeye !=
  and
  *.robage 10 <
  or
start
  50 inc
stop
```

Run on its own, with nothing in sight, cell 50 reaches 10. Without the `and`, the
`or` would join the last two conditions and `start` would do the _and_ with the
first: “it sees something and (it is not one of its own or it is young)”. Since
it sees nothing, the cell would stay at 0.

Inside the body, `and` lets a store depend on two inline conditions: a new
condition does not add to the previous one, it covers it (see
[[adn/condiciones]]).

With a single value on the stack, `and` leaves it as is; with an empty stack
it pushes true. To combine numbers bit by bit, the operator is [[op:&]].
