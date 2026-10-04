---
titulo: divstore
resumen: "Divide lo que hay en una celda por un número, redondeando al entero más cercano; dividir por 0 deja la celda en 0."
etiquetas: [divstore, división, escritura, redondeo]
estado: revisada
---
<!-- 20-VM §7 (divstore: v=0 -> 0; mem/v real con redondeo bancario; sin mod32000; d=0 consume v; cost /5, flags de lazo); comprobado en el port -->

`v d divstore` deja en la celda `d` lo que tenía dividido por `v`. Da lo mismo
que `*d v div d store`, con menos palabras y a la quinta parte del costo de un
[[op:store]].

| Palabra | Pila después |
|---|---|
| `2` | 2 |
| `50` | 2 50 |
| `divstore` | (vacía); la celda 50 vale la mitad |

La división **redondea** al entero más cercano, no trunca, y en el empate
exacto va al par. Se ve bien partiendo a la mitad una y otra vez:

```adn
' parte la celda 50 a la mitad en cada ciclo
cond
 *.robage 0 =
start
 100 50 store
stop
start
 2 50 divstore
stop
```

La celda pasa por 50, 25, 12, 6, 3, 2, 1 y 0. Fijate en los empates: 12,5 da
12, 1,5 da 2 y 0,5 da 0.

Dos trampas:

- **Dividir por 0 no deja la celda como estaba: la pone en 0.** Si el
  divisor sale de una lectura que puede valer 0, protegelo con una condición.
- Con la dirección 0, a diferencia de [[op:store]], el valor **sí** se saca
  de la pila y se pierde.

Como [[op:store]], le avisa al sistema de lazos si escribís en [[.tieang1]]
o [[.tielen1]]. La división de la pila, sin guardar, es [[op:div]].
