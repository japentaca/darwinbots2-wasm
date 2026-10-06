---
titulo: dup
resumen: "Duplicates the number on top of the integer stack, to use it twice without reading or computing it again."
etiquetas: [stack, duplicating, basic]
estado: revisada
---
<!-- 20-VM §3 (DupIntStack muerto), §6.1 (dup: pop + push×2, vacío → dos ceros); opcodes.yaml alias dupint -->

`a dup` leaves `a a`. It is useful when a value is needed twice: instead of
reading the cell again or repeating the calculation, you copy it. You can also
write `dupint`.

| Word | Stack after |
|---|---|
| `*.eye5` | 40 (for example) |
| `dup` | 40 40 |
| `mult` | 1600 |

This bot stores in cell 50 what the central eye ([[.eye5]]) sees squared, and
in cells 51 and 52 what it sees plus 10, computed only once:

```adn
cond
start
  *.eye5 dup mult 50 store
  *.eye5 10 add dup 51 store 52 store
stop
```

The other famous use is in the Bestiary: `x dup div` is 1 if `x` is not zero and
0 if it is, because [[op:div]] by zero gives 0. With that you build conditions
out of pure arithmetic (see [[adn/operadores]]).

An inherited quirk: with an empty stack, `dup` does not leave the stack empty
but pushes **two zeros**. [[op:dupbool]], its counterpart on the boolean
stack, does nothing with an empty stack.
