---
titulo: Writing to memory
resumen: "The fourteen stores: the only words that change the bot's memory, and so the only way for it to do anything."
etiquetas: [stores, memory, writing, operators]
estado: revisada
---
<!-- 20-VM §7, §4 (gate tipo 7), §1; opcodes.yaml stores -->

Everything a bot does goes through these words. Moving, turning, shooting or
reproducing is putting a number in a sysvar, and the only things that write to
memory are the _stores_. They all share the following:

- The **address** comes from the top of the [[adn/pilas|integer stack]]; the
  two-operand ones also pop a **value** from underneath. That is why you write
  `value address store`.
- They run only inside a gene body (after [[op:start]] or [[op:else]]) and only
  if the top of the boolean stack is true or empty. A skipped store pops nothing
  from the stack (see [[adn/condiciones]]).
- Address 0 neither writes nor charges. Outside 1 to 1000 it is adjusted into
  the range, and the stored value is clipped to ±32000.

[[op:store]] is, by far, the most used: with it you give all the commands.
[[op:inc]] and [[op:dec]] are the cheap counters (a tenth of the cost). The rest
modify what is already in the cell without having to read it first:
[[op:addstore]], [[op:substore]], [[op:multstore]] and [[op:divstore]] do
arithmetic, [[op:ceilstore]] and [[op:floorstore]] set a ceiling or a floor, and
[[op:rndstore]], [[op:sgnstore]], [[op:absstore]], [[op:sqrstore]] and
[[op:negstore]] transform the number that is stored.

They combine well on the same cell. This gene speeds up gradually and stops at a
cap:

```adn
' asks for 2 more each cycle, up to 40
cond
start
 2 50 addstore
 40 50 ceilstore
 *50 .up store
stop
```

Cell 50 goes up 2, 4, 6… to 40 and stays there, and [[.up]] receives that value
every cycle. It can also be done with `*50 2 add 40 ceil 50 store`, but that
takes more words.

The full explanation, with the family table, which addresses can be written and
when the engine acts on what was written, is in [[adn/stores]].
