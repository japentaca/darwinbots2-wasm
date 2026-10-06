---
titulo: Numbers and reads
resumen: "The two simplest words in the DNA: a number, which is pushed as is, and an asterisk read, which pushes what's in a memory cell."
etiquetas: [numbers, read, memory, asterisk]
estado: revisada
---
<!-- 20-VM §1 (tipos 0 y 1), §2.4, §4; opcodes.yaml pseudo_tokens -->

Every calculation in the DNA starts by pushing something, and for that there
are two words that are not commands but data:

- **The number** ([[operadores/numero]]): `50`, `-5` or the name of a sysvar
  such as `.up`, which is just its address (number 1). It is pushed as is.
- **The read** ([[operadores/lectura]]): an attached asterisk, like `*50` or
  `*.nrg`, pushes what _is_ in that memory cell.

They are, by far, the most frequent words in any bot. A typical condition
like `*.nrg 1000 >` has one of each, and a store like `10 .up store` has two
numbers: the value and the address. The rule of thumb is short: no asterisk
when you want to _write_ to a sysvar, an asterisk when you want to _know_ how
much it holds.

When you don't know the address beforehand but it comes out of a calculation,
the read is done with the operator [[op:*]], which takes the address from the
stack.

This bot shows the difference: in cell 50 it keeps its age
([[.robage]]), which goes up by one every cycle, and in cell 51 it keeps the
address of the age, which is always 9.

```adn
cond
start
  *.robage 50 store
  .robage 51 store
stop
```

Each number costs whatever [[param:cost:0]] says and each read whatever
[[param:cost:1]] says; under the F1 rules both are free (see
[[adn/ejecucion#costos]]). All the details about ranges and addresses are in
[[adn/numeros]].
