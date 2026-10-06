---
titulo: xor
resumen: "Replaces the top two values of the boolean stack with one: true if exactly one of the two is."
etiquetas: [logic, boolean stack, exclusive or]
estado: revisada
---
<!-- 20-VM §6.5 (xor: a ausente → not b); Bestiario: Acer_Runco_of_Vita_The_Weed_of_Life.txt; comprobado en el port -->

`xor`, the _exclusive or_, pops the top two values of the boolean stack and
pushes _true_ if one is true and the other isn't. If both are the same (two
trues or two falses), it gives _false_.

| Stack before (top on the right) | After `xor` |
|---|---|
| true false | true |
| false true | true |
| true true | false |
| false false | false |

It's useful for "one thing or the other, but not both". The bot _Acer Runco of
Vita, The Weed of Life_, from the Bestiary, uses it in a gene that turns and
creates ties (here we show only the part that turns): among other conditions
it requires either that it sees nothing straight ahead ([[.eyef]]) or that what it sees is
of its own species ([[.refeye]], [[.myeye]]), but not both at once:

```adn
' excerpt from Acer Runco of Vita: the conditions of one gene
cond
  *40 11 =
  *.robage 20 >
  *.eyef 0 =
  *.refeye *.myeye =
  xor
start
  40 *.aim add .setaim store
stop
```

Another way to see it: `xor` with a true inverts the other value, just like
[[op:not]], and with a false leaves it the same. And `a b xor` is true exactly
when `a` and `b` are different.

With a single value on the stack, `xor` inverts it (the missing one counts as
true); with an empty stack it pushes false. The bitwise _exclusive or_ between
numbers is [[op:^]].
