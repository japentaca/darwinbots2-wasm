---
titulo: !%=
resumen: "a b !%= leaves true if b strays more than 10% from a. It is the exact negation of %=, so with negative a it is always true."
etiquetas: [conditions, comparisons, approximate]
estado: revisada
---
<!-- 20-VM §6.4 (!%=: negación de %=); Bestiario: This_n_That_1.01_F2_Peksa_-_12.05.08.txt; comprobado en el port -->

`a b !%=` pushes _true_ when `b` is **not** within 10% of `a`, and _false_
when it is. It is exactly the opposite of [[op:%=]]: `100 111 !%=` is true
and `100 109 !%=` is false.

It's useful for reacting only when something got quite unbalanced, without
spending energy on small differences. This gene converts energy into body
([[.strbody]]) when the energy ([[.nrg]]) exceeds the body ([[.body]]) by more
than 10%, and stops when they're even:

```adn
' moves energy into the body while there is energy to spare
cond
  *.body *.nrg !%=
  *.nrg *.body >
start
  100 .strbody store
stop
```

The reference is the body, the lower number. A bot that starts with 3000
energy and 1000 body stops at 1200 energy and 1180 body (every 100 energy that goes
through [[.strbody]] gives only 10 body), when the energy comes
within 10% of the body. The bot _This'n'That 1.01_ (Peksa), from the
Bestiary, uses the same idea in both directions; it is covered in
[[op:dupbool]].

Since it's the exact negation, it inherits the quirk of `%=` in reverse: with
a negative reference, `!%=` is **always true**. With the integer stack empty
it compares 0 with 0 and gives false. The version with its own percentage is
[[op:!~=]].
