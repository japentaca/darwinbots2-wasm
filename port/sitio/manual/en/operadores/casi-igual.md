---
titulo: %=
resumen: "a b %= leaves true if b is within 10% of a, limits included. With a negative a it is always false."
etiquetas: [conditions, comparisons, approximate]
estado: revisada
---
<!-- 20-VM §6.4 (%=: a−a/10 ≤ b ≤ a+a/10 en Single; a<0 siempre falso), §12; comprobado en el port -->

`a b %=` is an “about equal”: it pushes _true_ if `b` is no more than 10% away
from `a`, above or below. The lower number, `a`, is the reference, and the
margin is computed on it:

| Stack before | Result | Why |
|---|---|---|
| `100 109` | true | the margin is 90 to 110 |
| `100 110` | true | the limits count |
| `100 111` | false | out of range |
| `15 16` | true | the margin is 13.5 to 16.5: it is not rounded |
| `0 0` | true | with reference 0, only 0 matches |
| `-100 -100` | **false** | see below |

It is useful for values that oscillate and will never match exactly, such as
energy, speed or an eye reading. This gene counts in cell 50 the cycles in which
the energy ([[.nrg]]) is between 2700 and 3300:

```adn
' counts the cycles with the energy near 3000
cond
  3000 *.nrg %=
start
  50 inc
stop
```

Note the order: the reference, 3000, goes lower. `*.nrg 3000%=` would measure
10% of the energy, which changes along with it.

:::cuidado
A quirk inherited from DarwinBots 2.48.32: with a negative reference the margin
flips and `%=` is **always false**, even if the two numbers are equal. If the
values may be negative (a lateral speed, a difference), run them through
[[op:abs]] first.
:::

If the margin has to be something else, use [[op:~=]], which takes the
percentage. The opposite is [[op:!%=]]. With an empty integer stack it compares
0 with 0 and gives true.
