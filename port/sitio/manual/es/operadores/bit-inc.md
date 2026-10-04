---
titulo: ++
resumen: "Suma 1 al número del tope de la pila entera, sin tocar la memoria: 5 ++ deja 6."
etiquetas: [bits, contar, pila entera]
estado: revisada
---
<!-- 20-VM §6.3 (++ con acarreo; edge 2147483647 ++ → 0); Bestiario: 1_6.txt (Guardian-0.9); comprobado en el port -->

`x ++` saca un número y apila ese número más 1. `5 ++` da 6, `-1 ++` da 0.
Para los números que vas a manejar es lo mismo que `1 add`, escrito más
corto.

:::cuidado
`++` no es [[op:inc]]. `inc` es un store: suma 1 a una _celda de memoria_ y
solo corre si las condiciones lo dejan. `++` suma 1 al número que está en la
_pila_ y no guarda nada. `50 inc` cuenta en la celda 50; `50 ++` deja un 51
en la pila.
:::

El bot _Guardian-0.9_ (Trafalgar), del Bestiario, lo usa en un truco para
convertir cualquier número en una marca de «es cero»: `x sgn abs - ++` deja 1
si `x` es 0 y 0 si no. Paso a paso, con `x` = −9 y con `x` = 0:

| Palabra | Pila (x = −9) | Pila (x = 0) |
|---|---|---|
| [[op:sgn]] | −1 | 0 |
| [[op:abs]] | 1 | 0 |
| [[op:-]] | −1 | 0 |
| `++` | 0 | 1 |

Multiplicado por un valor, sirve para escribir algo solo cuando una celda está
en 0, sin usar condiciones. Este gen guarda 700 en la celda 80 únicamente si
estaba vacía:

```adn
cond
start
  700 *80 sgn abs - ++ mult *80 add 80 store
stop
```

Si la celda 80 valía 0, la marca es 1 y se guarda 0 + 700; si ya tenía
algo, la marca es 0 y se vuelve a guardar lo que había.

Una rareza heredada, solo en el borde de los 32 bits: `++` sobre el número
más grande que entra en la pila (2147483647) da 0 en lugar de dar la vuelta
al negativo más grande. Con la pila vacía opera sobre 0 y deja 1. Lo opuesto
es [[op:--]].
