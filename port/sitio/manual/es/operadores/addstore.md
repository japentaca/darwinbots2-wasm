---
titulo: addstore
resumen: "Le suma un número a lo que ya hay en una celda, sin tener que leerla antes."
etiquetas: [addstore, suma, escritura, acumulador]
estado: revisada
---
<!-- 20-VM §7 (addstore: mod32000(mem+v), d=0 deja v en la pila, cost /5, flags de lazo); comprobado en el port -->

`v d addstore` le suma `v` a la celda `d`. Equivale a
`*d v add d store`, con menos palabras y a la quinta parte del costo de un
[[op:store]].

| Palabra | Pila después |
|---|---|
| `2` | 2 |
| `50` | 2 50 |
| `addstore` | (vacía); la celda 50 vale 2 más |

Sirve para acumular: sumar lo que va viendo un ojo, llevar un total o hacer
crecer una orden de a poco.

```adn
' acelera de a poco: pide 2 más por ciclo, hasta 40
cond
start
 2 50 addstore
 40 50 ceilstore
 *50 .up store
stop
```

La celda 50 vale 2, 4, 6… y desde el ciclo 20 se queda en 40, el techo que
le pone [[op:ceilstore]]. [[.up]] recibe ese valor en cada ciclo.

Con un `v` negativo resta, así que `-3 50 addstore` hace lo mismo que
`3 50 substore`. El resultado se recorta a ±32000, igual que en
[[op:store]], y con la dirección 0 el valor queda en la pila sin usarse.

A diferencia de [[op:inc]], `addstore` sí le avisa al sistema de lazos cuando
escribís en [[.tieang1]] o [[.tielen1]]: para sumarle 1 al ángulo de un
lazo, `1 .tieang1 addstore` es la forma correcta.
