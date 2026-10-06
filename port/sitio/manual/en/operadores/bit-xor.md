---
titulo: ^
resumen: "Bitwise exclusive or of the top two numbers: leaves a number whose set bits are those in only one of the two. Good for flipping flags."
etiquetas: [bits, flags, toggling]
estado: revisada
---
<!-- 20-VM §6.3 (^: XOR bit a bit); comprobado en el port -->

`a b ^` pops two numbers and leaves a number whose set bits are those that are
set in only one of them. `12 10 ^` gives 6 (1100 and 1010 differ in the bits worth
4 and 2).

Its typical use is **flipping a flag**: if the bit was set it clears it, and if
it was clear it sets it. This bot toggles cell 50 between 0 and 1 every cycle,
which is useful for doing one thing one cycle and another the next:

```adn
' cell 50 is 1, 0, 1, 0…
cond
start
  *50 1 ^ 50 store
stop
```

Another use: `a b ^` gives 0 only if `a` and `b` are equal bit for bit, so
`a b ^ 0 =` is the same as `a b =`.

Doing `^` twice with the same number leaves everything as it was. With an empty
stack it operates on zeros. The other bit operations are in
[[operadores/bits]]; the _exclusive or_ of trues and falses is [[op:xor]].
