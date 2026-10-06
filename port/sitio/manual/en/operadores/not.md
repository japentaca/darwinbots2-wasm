---
titulo: not
resumen: "Inverts the top value of the boolean stack: true becomes false and false becomes true. On an empty stack it gives false."
etiquetas: [logic, boolean stack, negation]
estado: revisada
---
<!-- 20-VM §6.5 (not: vacía → falso), §6.6; comprobado en el port -->

`not` pops the top value of the boolean stack and pushes the opposite.

In the condition section it's useful for negating a whole combination. This
gene makes the bot turn ([[.aimdx]]) when it is not seeing anything
([[.eye5]]) and is not newly born ([[.robage]]): the `not` negates the result
of the [[op:or]]:

```adn
' turns if it sees nothing and is no longer newly born
cond
  *.eye5 0 >
  *.robage 5 <
  or
  not
start
  50 .aimdx store
stop
```

Inside the body it gives an “otherwise”: after a group of stores that depend
on a condition, `not` inverts it and the stores that follow run in the
opposite case. The example is in [[operadores/logicos]] and in
[[adn/condiciones#en-linea]].

:::cuidado
On an empty stack, `not` pushes **false**: the empty stack counts as true,
and the opposite of true is false. A gene that begins `cond not start` never
runs.
:::

To negate a single comparison, it is usually clearer to use the opposite one:
`a b <` instead of `a b >= not` (see [[op:<]]). To invert the bits of a number
there is [[op:~]], which is something else.
