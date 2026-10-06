---
titulo: Bitwise
resumen: "The operators that look at a number as 32 bits: and, or, exclusive or, inversion, shifts, plus one and minus one, and the sign change."
etiquetas: [bits, flags, integer stack, operators]
estado: revisada
---
<!-- 20-VM §6.3; opcodes.yaml bitwise; comprobado en el port -->

These operators work, like the [[operadores/basicos|basic ones]], only with the
[[adn/pilas#entera|integer stack]]: they pop one or two numbers and leave one.
The difference is that they see each number as a row of 32 bits (in two's
complement, the usual way of storing negatives) and operate bit by bit.

- **Combining two numbers**: [[op:&]] (_and_), [[op:|]] (_or_) and [[op:^]]
  (_exclusive or_).
- **Transforming one**: [[op:~]] inverts all the bits, [[op:<<]] and [[op:>>]]
  shift them one place (doubling or halving), [[op:++]] and [[op:--]] add or
  subtract 1.
- **The loose minus sign**, [[op:-]], is also part of this family even though
  it does not touch bits: it changes the sign of the top. It does not subtract;
  for subtracting there is [[op:sub]].

The most common use is keeping several yes-or-no flags in a single memory cell,
one per bit: `|` with a power of 2 sets a bit, `~` and `&` clear it, and `&`
alone asks whether it is set. A cell holds up to ±32000, so 14 flags fit
without trouble (the bits worth 1, 2, 4… up to 8192). The one worth 16384 fits
only if the sum does not go past 32000.

This bot has a 1 in cell 50 (the bit worth 1). When its age reaches 5 it sets
the one worth 4 and the cell becomes 5; at 10 it clears it and goes back to 1,
without touching the other bit:

```adn
' sets the bit worth 4 in cell 50 and then clears it
cond
  *.robage 5 =
start
  *50 4 | 50 store
stop

cond
  *.robage 10 =
start
  *50 4 ~ & 50 store
stop
```

To ask about the flag, `*50 4 & 0 !=` leaves true if the bit is set (see
[[op:!=]]).

None of them fails with an empty stack: they operate on zeros. At the edge of
32 bits there are two quirks inherited from DarwinBots 2.48.32 (a result that
should be the most negative number comes out as 0); [[op:++]] and [[op:<<]]
describe them. With numbers the size of memory you will never get there.

Every operator of this family that is executed charges the cost
[[param:cost:4]] from the scenario configuration. The overview of all the
families is in [[adn/operadores]].
