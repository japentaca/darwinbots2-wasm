---
titulo: *<numero> | *.<sysvar>
resumen: "An asterisk attached to a number or a sysvar pushes the contents of that memory cell: it's how you read the senses and your own variables."
etiquetas: [read, memory, asterisk, senses]
estado: revisada
---
<!-- 20-VM §1 (tipo 1), §4 (normalización Abs Mod 1000, 0 → 1000), §2.4 (.nombre desconocido = 0); 21-MEMORIA (latencia) -->

`*50` pushes what's in cell 50; `*.nrg` pushes what's in the cell of
[[.nrg]], that is, the bot's energy. It is the word a bot uses to find out
about everything: its senses, its state and what it stored in free memory.

A few things worth knowing:

- **The senses arrive one cycle late.** The engine publishes them after the
  DNA runs, so in a bot's first cycle of life almost everything reads as 0
  (see [[adn/ejecucion#retraso]]).
- **The address is normalized.** If it is outside 1 to 1000, its sign is
  dropped and the remainder of dividing by 1000 is taken: `*1050` reads cell
  50 and `*0` reads cell 1000.
- **A misspelled sysvar reads cell 1000.** `*.nrgg` doesn't exist, it counts
  as `*0`, and it pushes whatever is in cell 1000 without any warning (the
  [[app/editor|editor]] does flag it for you).
- **The address is written into the DNA.** If it has to come out of a
  calculation, use the operator [[op:*]]: `60 *` reads the same as `*60`, but
  the 60 can come from the stack.

This bot moves forward only when the central eye ([[.eye5]]) sees something:

```adn
cond
  *.eye5 0 >
start
  10 .up store
stop
```

Each read costs [[param:cost:1]], which under the F1 rules is 0. More in
[[adn/numeros#leer]] and [[adn/memoria]].
