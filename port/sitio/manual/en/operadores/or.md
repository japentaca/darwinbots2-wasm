---
titulo: or
resumen: "Replaces the top two values of the boolean stack with one: true if either is. The only way to ask for “this or that”."
etiquetas: [logic, boolean stack, or]
estado: revisada
---
<!-- 20-VM §6.5 (or: a ausente → verdadero), §6.6; comprobado en el port -->

`or` pops the top two values of the boolean stack and pushes _true_ if either
of them (or both) is true. It only gives _false_ if both are false.

It's the logic operator you need most, because between `cond` and `start` the
_and_ is automatic but the _or_ is not. This bot flees backwards ([[.dn]]) if
it has little energy ([[.nrg]]) **or** if what it sees has more eye reads in
its DNA than it does ([[.refeye]], [[.myeye]]), a rough way of sizing up the
other bot:

```adn
' backs off if it is weak or if the other looks bigger
cond
  *.eye5 0 >
  *.nrg 500 <
  *.refeye *.myeye >
  or
start
  20 .dn store
stop
```

`or` combines only the top two; the [[.eye5]] condition lower down is left for
`start`, which joins it with _and_. It reads: “sees something, and (is weak or
the other looks bigger)”.

:::cuidado
If `or` finds a single value on the stack, it gives **true**, whatever that
value is: the missing operand counts as true. A `cond false or start` always
runs. It happens when you forget one of the two conditions, or when the `or`
ends up before the second one.
:::

With an empty stack it also pushes true. For the bitwise _or_ between numbers
there is [[op:|]]; the _or_ that excludes the case of both being true is
[[op:xor]].
