---
titulo: swap
resumen: "Intercambia los dos números de arriba de la pila entera: a b swap deja b a."
etiquetas: [pila, intercambiar, básicos]
estado: revisada
---
<!-- 20-VM §3 (SwapIntStack: no-op con ≤1), §6.1; opcodes.yaml alias swapint -->

`a b swap` deja `b a`. También se puede escribir `swapint`. Sirve cuando los
operandos quedaron en el orden contrario al que pide el operador, algo que
importa en los que no son conmutativos: [[op:sub]], [[op:div]], [[op:mod]],
las comparaciones o [[op:store]].

| Palabra | Pila después |
|---|---|
| `*.eye5` | 30 (por ejemplo) |
| `40` | 30 40 |
| `swap` | 40 30 |
| `sub` | 10 |

Así, `*.eye5 40 swap sub` calcula `40 − *.eye5`. Este bot lo guarda en la
celda 50:

```adn
cond
start
  *.eye5 40 swap sub 50 store
stop
```

Si la pila tiene un solo número, o ninguno, `swap` no hace nada: no inventa
un cero como [[op:over]]. El par de la pila booleana es [[op:swapbool]].
