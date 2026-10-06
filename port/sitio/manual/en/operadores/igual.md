---
titulo: =
resumen: "a b = leaves true if the two numbers are equal. The one in *.eye5 0 =, “I see nothing”."
etiquetas: [conditions, comparisons, equality]
estado: revisada
---
<!-- 20-VM §6.4 (=); §3 (pila vacía: ceros); sysvars.yaml .refeye, .myeye, .aimdx; comprobado en el port -->

`a b =` pops two numbers and pushes _true_ if they are equal and _false_ if
not. Here the order doesn't matter: `3 3 =` is true and `3 4 =` is false.

Two classic uses:

- `*.eye5 0 =`: the middle eye ([[.eye5]]) sees nothing.
- `*.refeye *.myeye =`: what it sees has the same number of eye reads in its
  DNA as the bot ([[.refeye]] and [[.myeye]]); the simplest way to recognize
  your own species.

This bot turns right ([[.aimdx]]) while it sees nothing, looking for something
to look at:

```adn
' turns while it sees nothing
cond
  *.eye5 0 =
start
  60 .aimdx store
stop
```

To compare values that wobble a little, such as a speed or a distance, an
exact `=` is usually too strict; in those cases [[op:%=]] and [[op:~=]] are
useful. The opposite of `=` is [[op:!=]].

With the integer stack empty it compares 0 with 0 and gives **true**. The
other comparisons are in [[operadores/comparaciones]].
