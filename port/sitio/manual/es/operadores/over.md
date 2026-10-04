---
titulo: over
resumen: "Copia arriba de todo el segundo número de la pila entera: a b over deja a b a."
etiquetas: [pila, copiar, básicos]
estado: revisada
---
<!-- 20-VM §3 (OverIntStack: vacío no-op, un elemento apila 0), §6.1; opcodes.yaml alias overint; comprobado en el port -->

`a b over` deja `a b a`: copia el que está debajo del tope y lo pone arriba,
sin sacar nada. También se puede escribir `overint`. Es como un [[op:dup]]
del segundo, útil cuando un valor hace falta otra vez pero ya tiene algo
encima.

| Palabra | Pila después |
|---|---|
| `7` | 7 |
| `3` | 7 3 |
| `over` | 7 3 7 |

```adn
cond
start
  7 3 over 50 store 51 store 52 store
stop
```

Los tres [[op:store]] sacan de arriba hacia abajo: la celda 50 queda en 7, la
51 en 3 y la 52 en 7.

Una rareza heredada: con un solo número en la pila, `over` no lo copia sino
que **apila un 0** (`5 over` deja `5 0`). Con la pila vacía no hace nada. Su
par de la pila booleana, [[op:overbool]], con un solo valor apila un
_verdadero_.
