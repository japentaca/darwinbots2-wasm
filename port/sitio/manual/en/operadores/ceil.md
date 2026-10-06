---
titulo: ceil
resumen: "Sets a ceiling: of the top two numbers on the stack it leaves the smaller, so x 100 ceil never goes above 100."
etiquetas: [cap, minimum, range, advanced]
estado: revisada
---
<!-- 20-VM §6.2 (ceil = min, comparación en Single; core DNAceil empuja el Single); comprobado en el port -->

`x ceiling ceil` leaves the smaller of the two: `x` if it is below the
ceiling, and the ceiling if not. The name comes from that (_ceiling_), even
though the result is the _minimum_, which confuses more than a few people.
`7 100 ceil` gives 7 and `700 100 ceil` gives 100.

It is used to keep a computed value from going past a limit before storing it.
This bot pushes forward with a tenth of its energy, but never with more than
30:

```adn
cond
start
  *.nrg 10 div 30 ceil .up store
stop
```

Combined with its counterpart, [[op:floor]], it fences a value into a range:
`x 50 ceil 5 floor` ends up between 5 and 50 (see the _Saber_ example in
[[operadores/avanzados]]).

A quirk that only shows with enormous numbers: `ceil` compares with less
precision than `floor`, and above 16,777,216 the result can come out off by a
few units (more the bigger the number is). With numbers the size of memory it
never happens.
To write the minimum straight into a cell there is [[op:ceilstore]].
