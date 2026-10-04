---
titulo: not
resumen: "Invierte el valor de arriba de la pila booleana: verdadero pasa a falso y falso a verdadero. Sobre la pila vacía da falso."
etiquetas: [lógica, pila booleana, negación]
estado: revisada
---
<!-- 20-VM §6.5 (not: vacía → falso), §6.6; comprobado en el port -->

`not` saca el valor de arriba de la pila booleana y apila el contrario.

En la sección de condiciones sirve para negar una combinación entera. Este
gen hace girar al bot ([[.aimdx]]) cuando no está viendo nada ([[.eye5]]) ni
es recién nacido ([[.robage]]): el `not` niega el resultado del [[op:or]]:

```adn
' gira si no ve nada y ya no es recién nacido
cond
  *.eye5 0 >
  *.robage 5 <
  or
  not
start
  50 .aimdx store
stop
```

Dentro del cuerpo da un «si no»: después de un grupo de stores que dependen de
una condición, `not` la invierte y los stores que siguen corren en el caso
contrario. El ejemplo está en [[operadores/logicos]] y en
[[adn/condiciones#en-linea]].

:::cuidado
Sobre la pila vacía, `not` apila **falso**: la pila vacía cuenta como
verdadera, y lo contrario de verdadero es falso. Un gen que empieza
`cond not start` no corre nunca.
:::

Para negar una sola comparación, suele ser más claro usar la opuesta: `a b <`
en lugar de `a b >= not` (ver [[op:<]]). Para invertir los bits de un número
está [[op:~]], que es otra cosa.
