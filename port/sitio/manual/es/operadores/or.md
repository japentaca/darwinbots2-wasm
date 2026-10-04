---
titulo: or
resumen: "Reemplaza los dos valores de arriba de la pila booleana por uno: verdadero si alguno lo es. La única forma de pedir «esto o aquello»."
etiquetas: [lógica, pila booleana, o]
estado: revisada
---
<!-- 20-VM §6.5 (or: a ausente → verdadero), §6.6; comprobado en el port -->

`or` saca los dos valores de arriba de la pila booleana y apila _verdadero_ si
alguno de los dos (o los dos) es verdadero. Solo da _falso_ si los dos son falsos.

Es el lógico que más hace falta, porque entre `cond` y `start` el _y_ es
automático pero el _o_ no. Este bot se escapa hacia atrás ([[.dn]]) si tiene
poca energía ([[.nrg]]) **o** si lo que ve tiene en su ADN más lecturas de ojo que él
([[.refeye]], [[.myeye]]), una forma rústica de medir al otro:

```adn
' retrocede si está débil o si el otro parece más grande
cond
  *.eye5 0 >
  *.nrg 500 <
  *.refeye *.myeye >
  or
start
  20 .dn store
stop
```

`or` combina solo los dos de arriba; el [[.eye5]] de más abajo queda para el
`start`, que lo une con _y_. Se lee: «ve algo, y (está débil o el otro parece
más grande)».

:::cuidado
Si `or` encuentra un solo valor en la pila, da **verdadero**, sea cual sea ese
valor: el operando que falta cuenta como verdadero. Un `cond false or start`
corre siempre. Pasa cuando te olvidás una de las dos condiciones, o cuando el
`or` queda antes de la segunda.
:::

Con la pila vacía también apila verdadero. Para el _o_ bit a bit entre
números está [[op:|]]; el _o_ que excluye el caso de los dos verdaderos es
[[op:xor]].
