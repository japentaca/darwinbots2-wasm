---
titulo: true
resumen: "Pushes a true onto the boolean stack. Inside a gene's body, it re-enables the stores that a condition had blocked."
etiquetas: [logic, boolean stack, constant]
estado: revisada
---
<!-- 20-VM §6.5 (true), §4 (gate de stores: tope sin consumir); comprobado en el port -->

`true` pushes a _true_ onto the boolean stack, without looking at anything.

Its real use is inside a gene's body. There each store looks at the top value
of the boolean stack; after a false inline condition, stores stop writing. A
`true` covers that condition and the stores that follow run again, no matter
what:

```adn
cond
start
  *.robage 3 <
  50 inc
  true
  51 inc
  dropbool
  52 inc
stop
```

After 10 cycles cell 50 holds 3 (it only counted while [[.robage]] was less
than 3), cell 51 holds 10 and cell 52 holds 3 again. The `true` doesn't erase
the condition: it covers it. When [[op:dropbool]] pops the `true`, the
condition underneath rules again. If what you want is to forget it altogether,
use [[op:clearbool]].

In the `cond` section it adds nothing: an empty stack already counts as true,
and `start` does the _and_ of everything. The bot _Animal_Minimalis Antivirus_
(Shasta), from the Bestiary, uses it at the end of a gene so that its last
store always runs; the example is in [[adn/condiciones]].

The opposite is [[op:false]].
