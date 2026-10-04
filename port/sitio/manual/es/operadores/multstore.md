---
titulo: multstore
resumen: "Multiplica lo que hay en una celda por un número y guarda el resultado ahí mismo."
etiquetas: [multstore, multiplicación, escritura]
estado: revisada
---
<!-- 20-VM §7 (multstore: mod32000(mem · mod32000(v)), d=0 deja v en la pila, cost /5, flags de lazo); comprobado en el port -->

`v d multstore` deja en la celda `d` lo que tenía multiplicado por `v`. Es
`*d v mult d store` en dos palabras, a la quinta parte del costo de un
[[op:store]].

| Palabra | Pila después |
|---|---|
| `2` | 2 |
| `50` | 2 50 |
| `multstore` | (vacía); la celda 50 vale el doble |

```adn
' duplica la celda 50 en cada ciclo, empezando en 1
cond
 *50 0 =
start
 1 50 store
stop
start
 2 50 multstore
stop
```

La celda pasa por 2, 4, 8… hasta 16384. El ciclo siguiente no da 32768 sino
**768**: el resultado se recorta a ±32000 de forma circular, como en todos
los stores (ver [[adn/numeros#recorte]]). Con multiplicaciones es fácil
pasarse, así que si el número puede crecer, ponele un techo con
[[op:ceilstore]] antes de que llegue al borde.

Algunos usos: `-1 50 multstore` cambia el signo (lo mismo hace
[[op:negstore]], más barato), y `0 50 multstore` la pone en 0.

Con la dirección 0 el valor queda en la pila sin usarse. Como
[[op:store]], le avisa al sistema de lazos si escribís en [[.tieang1]] o
[[.tielen1]].
