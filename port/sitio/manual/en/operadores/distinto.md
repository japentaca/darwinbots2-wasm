---
titulo: !=
resumen: "a b != leaves true if the two numbers are different. The one in *.refeye *.myeye !=, “it is not one of mine”."
etiquetas: [conditions, comparisons, inequality]
estado: revisada
---
<!-- 20-VM §6.4 (!=: a <> b); sysvars.yaml .refeye, .myeye; comprobado en el port (con otra especie) -->

`a b !=` pops two numbers and pushes _true_ if they are different and _false_
if they are equal. It is exactly the opposite of [[op:=]]: `3 4 !=` is true and
`3 3 !=` is false.

Its best-known use is not attacking your own species. [[.refeye]] is the number
of eye reads in the DNA of whatever the bot is looking at and [[.myeye]] is the
bot's own; if they differ, it is almost certainly another species. This gene
shoots ([[.shoot]]) only if it sees something ([[.eye5]]) and it is not one of
its own:

```adn
' shoots at what it sees, if it is not its own species
cond
  *.eye5 0 >
  *.refeye *.myeye !=
start
  -1 .shoot store
stop
```

The inverse is not as safe: two different species can, by chance, have the same
number of eyes.

It is also useful for detecting changes: `*.eye5 *50 !=` is true when what the
middle eye sees changed compared with what you stored in cell 50. If the change
has to exceed a margin, use [[op:!%=]] or [[op:!~=]].

With an empty integer stack it compares 0 with 0 and gives false. The other
comparisons are in [[operadores/comparaciones]].
