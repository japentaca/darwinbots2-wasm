---
titulo: Basic
resumen: "The arithmetic of DNA (addition, subtraction, product, division, remainder, sign, randomness) and the tools for rearranging the integer stack."
etiquetas: [arithmetic, stack, operators, basic]
estado: revisada
---
<!-- 20-VM §6, §6.1, §3; opcodes.yaml basicos -->

The basic operators come in two kinds, and all of them work only with the
[[adn/pilas#entera|integer stack]]: they pop their operands from there and
leave the result there.

- **Calculations**: [[op:add]], [[op:sub]], [[op:mult]], [[op:div]], [[op:mod]],
  [[op:sgn]], [[op:abs]] and [[op:rnd]], plus [[op:*]], which reads memory at a
  computed address.
- **Stack handling**: [[op:dup]], [[op:drop]], [[op:swap]], [[op:over]] and
  [[op:clear]]. They calculate nothing, they just rearrange what is there.

The ones you will write most are `add`, `sub`, `mult` and `div`, almost always
to adjust a reading before storing it (`*.nrg 10 div`), and `rnd` to give the
bot some randomness. The stack ones are for when a value is needed twice: `dup`
saves you from reading the same cell twice.

As everywhere in DNA, the order is _operands first_: `a b sub` is `a − b`, and
the one lower in the stack is the first operand. None of them fails: with an
empty stack they work with zeros. And the integer stack holds much bigger
numbers than memory does, so an intermediate result of 90000 is no problem as
long as you shrink it before storing it (see [[adn/numeros#recorte]]).

One usage idea that combines several: a counter that goes from 0 to 9 and
starts over, kept in cell 50, and a gene that takes advantage of the wraparound
to do something every 10 cycles.

```adn
cond
start
  *50 1 add 10 mod 50 store
stop

cond
  *50 0 =
start
  1256 rnd .setaim store
stop
```

Every basic operator executed costs [[param:cost:2]] (free under the F1
rules). The overview of all the families is in [[adn/operadores]].
