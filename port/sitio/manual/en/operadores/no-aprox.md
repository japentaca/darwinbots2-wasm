---
titulo: !~=
resumen: "a b d !~= leaves true if b strays more than d % from a. It is the negation of ~= and also pops three numbers."
etiquetas: [conditions, comparisons, approximate, percentage]
estado: revisada
---
<!-- 20-VM §6.4 (!~=: negación de ~=, con clamp de c a ±2e9); comprobado en el port -->

`a b d !~=` pops three numbers and pushes _true_ when `b` is **not** within `d`
% of `a`. It is the opposite of [[op:~=]]: `100 130 25 !~=` is true and
`100 120 25 !~=` is false. The reference is `a`, the lowest one, and the
percentage goes on top.

It's useful for reacting to big changes and ignoring small ones. This bot
counts in cell 51 the cycles in which what the middle eye ([[.eye5]]) sees
changed by more than 5% from the previous cycle, which it keeps in cell 50:

```adn
' counts the cycles in which what it sees changed by more than 5%
cond
  *50 *.eye5 5 !~=
start
  51 inc
stop

cond
start
  *.eye5 50 store
stop
```

Apart from the case of huge numbers explained below, `~=` and `!~=` are
complementary: if you put this counter and the one from the page of
[[op:~=]] in the same bot, in each cycle exactly one of the two goes up.

Since it's the negation, it inherits the quirks of `~=` in reverse: if the
reference or the percentage is negative (only one of the two), it **always
gives true**. And it has a quirk of its own: the computed margin is capped
at two billion, which `~=` doesn't do. It only matters with enormous numbers,
which don't fit in memory; in that case `~=` and `!~=` can both give true at
once.

The bot _Chaotic Swarm ver 1.2_ (SA), from the Bestiary, uses `!~=` with a 5%
margin to decide whether what each eye sees has changed. The version with a
fixed 10% is [[op:!%=]].
