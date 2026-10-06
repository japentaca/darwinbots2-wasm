---
titulo: ~=
resumen: "a b d ~= leaves true if b is within d % of a: an “about equal” with the margin you choose. Pops three numbers."
etiquetas: [conditions, comparisons, approximate, percentage]
estado: revisada
---
<!-- 20-VM §6.4 (~=: c = a/100·d; a−c ≤ b ≤ a+c; c<0 siempre falso); comprobado en el port -->

`a b d ~=` is like [[op:%=]] but with the percentage of your choice: it pops
**three** numbers and pushes _true_ if `b` is no more than `d` % away from
`a`. The reference is `a`, the one lowest in the stack; the percentage goes on top.

| Stack before | Result | Why |
|---|---|---|
| `100 120 25` | true | the margin is 75 to 125 |
| `100 130 25` | false | out of range |
| `1000 1015 1` | false | 1% of 1000 is 10 |
| `100 120 -25` | **false** | negative percentage |
| `-100 -100 5` | **false** | negative reference |

`100 b 10 ~=` is the same as `100 b %=`. The limits count and the margin is
not rounded.

It is useful for detecting whether a reading changed “for real” or just
wobbled. This bot stores in cell 50 what the middle eye ([[.eye5]]) was
seeing, and counts in cell 51 the cycles in which what it sees now is similar,
within 5%, to what it saw in the previous cycle:

```adn
' counts the cycles in which what it sees did not change by more than 5%
cond
  *50 *.eye5 5 ~=
start
  51 inc
stop

cond
start
  *.eye5 50 store
stop
```

The gene that stores comes after the one that compares, so cell 50 still has
the old value when it is read.

:::cuidado
As with `%=`, if the reference or the percentage is negative (only one of the
two), the margin flips and `~=` is **always false**, even if the numbers are
equal. With both negative, the signs cancel and the margin becomes positive
again. Run the values through [[op:abs]] if they may be negative.
:::

If you forget the percentage, `~=` still pops three numbers: it takes as
reference whatever is lower in the stack, or 0 if it is empty. The opposite is
[[op:!~=]].
