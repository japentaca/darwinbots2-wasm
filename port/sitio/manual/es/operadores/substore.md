---
titulo: substore
resumen: "Le resta un número a lo que ya hay en una celda: la celda menos el valor."
etiquetas: [substore, resta, escritura, temporizador]
estado: revisada
---
<!-- 20-VM §7 (substore: mod32000(mem-v), d=0 deja v en la pila, cost /5, flags de lazo); comprobado en el port -->

`v d substore` deja en la celda `d` lo que tenía menos `v`. Es
`*d v sub d store` en dos palabras, a la quinta parte del costo de un
[[op:store]].

| Palabra | Pila después |
|---|---|
| `3` | 3 |
| `50` | 3 50 |
| `substore` | (vacía); la celda 50 vale 3 menos |

```adn
' cuenta regresiva de a 3, desde 30
cond
 *.robage 0 =
start
 30 50 store
stop
cond
 *50 0 >
start
 3 50 substore
stop
```

En el primer ciclo [[.robage]] vale 0: el primer gen carga 30 y el segundo ya
le resta 3. La celda pasa por 27, 24, 21… y en el ciclo 10 llega a 0, donde
la condición la frena.

:::cuidado
El orden es valor primero, dirección arriba, como en todos los stores. Si lo
escribís al revés, `50 3 substore` le resta 50 a la celda 3, que es [[.sx]].
:::

Con la dirección 0 el valor queda en la pila sin usarse, y el resultado se
recorta a ±32000. Restar 1 sale más barato con [[op:dec]], pero en
[[.tieang1]] o [[.tielen1]] conviene `substore`, que le avisa al sistema de
lazos. La suma es [[op:addstore]].
