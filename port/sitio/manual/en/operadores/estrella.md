---
titulo: *
resumen: "Reads memory at a computed address: pops an address from the stack and pushes what is in that cell."
etiquetas: [memory, read, address, basic]
estado: revisada
---
<!-- 20-VM §6.1 (* deref: Abs Mod 1000, 0 → 1000); sysvars.yaml 501-509 (eye1..eye9) -->

`address *` does the same as the [[operadores/lectura|read with the asterisk
attached]], but with the address taken from the stack: `60 *` pushes the same
as `*60`. The difference is that the address can come out of a calculation, and
that lets you walk through memory as if it were a table.

For example, the eyes [[.eye1]] to [[.eye9]] occupy cells 501 to 509. This bot
stores in cell 50 which eye it wants to look at (1 to 9) and copies what that
eye sees to cell 60:

```adn
cond
start
  ' the address is 500 + the eye number
  500 *50 add * 60 store
stop
```

As in any read, the address goes through the same rule: its sign is removed and
the remainder of dividing by 1000 is taken, and a 0 reads cell 1000 (`0 *`
reads 1000, `1050 *` reads 50). There is no way to read outside the bot's
memory.

:::nota
Careful not to confuse it with the attached asterisk: `*50` is a single word
(it reads cell 50), while `50 *` is two (it pushes 50 and then reads). And a loose
`*` with an empty stack reads cell 1000, because the empty stack gives 0.
:::
