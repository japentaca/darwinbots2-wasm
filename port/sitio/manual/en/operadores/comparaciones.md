---
titulo: Comparisons
resumen: "DNA's questions: they pop numbers from the integer stack and leave a true or a false on the boolean one. Equal, not equal, greater, less and the approximate comparisons."
etiquetas: [conditions, comparisons, boolean stack, operators]
estado: revisada
---
<!-- 20-VM §6.4, §6.6, §5.1-5.2; opcodes.yaml condiciones; comprobado en el port -->

Each comparison pops numbers from the [[adn/pilas#entera|integer stack]] and
leaves **one** result, true or false, on the [[adn/pilas#booleana|boolean
stack]]. They read left to right: `a b >` asks “is `a` greater than `b`?”.
There are three groups:

- **Exact**: [[op:=]], [[op:!=]], [[op:<]], [[op:>]], [[op:<=]] and [[op:>=]].
  These are the ones you will use most.
- **Approximate to 10%**: [[op:%=]] and [[op:!%=]], for values that oscillate
  and should not be compared exactly.
- **Approximate with your own percentage**: [[op:~=]] and [[op:!~=]], which pop
  a third number with the margin.

They almost always go between `cond` and `start`, where all the ones you put
are joined with an _and_: the gene body runs only if all of them are true
([[adn/genes]] covers it). That is how you build a range with two comparisons.
This gene runs only between cycles 10 and 20 of the bot's life ([[.robage]]),
both included, and counts in cell 50 how many times it ran (11):

```adn
cond
  *.robage 10 >=
  *.robage 20 <=
start
  50 inc
stop
```

To ask for “this _or_ that” you have to combine them with [[op:or]]; the other
logic words are in [[operadores/logicos]]. A comparison can also go inside the
body, and then it decides whether the stores that follow it run: that is
[[adn/condiciones]].

None of them fails: if the integer stack is short of numbers, they compare
zeros. That is why `=` on an empty stack gives true (0 equals 0) and `<` gives
false.

Every comparison executed charges the cost [[param:cost:5]] from the scenario
configuration.
