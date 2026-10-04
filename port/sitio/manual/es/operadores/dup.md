---
titulo: dup
resumen: "Duplica el número de arriba de la pila entera, para usarlo dos veces sin volver a leerlo ni calcularlo."
etiquetas: [pila, duplicar, básicos]
estado: revisada
---
<!-- 20-VM §3 (DupIntStack muerto), §6.1 (dup: pop + push×2, vacío → dos ceros); opcodes.yaml alias dupint -->

`a dup` deja `a a`. Sirve cuando un valor hace falta dos veces: en lugar de
leer otra vez la celda o repetir la cuenta, se copia. También se puede
escribir `dupint`.

| Palabra | Pila después |
|---|---|
| `*.eye5` | 40 (por ejemplo) |
| `dup` | 40 40 |
| `mult` | 1600 |

Este bot guarda en la celda 50 lo que ve el ojo central ([[.eye5]]) elevado
al cuadrado, y en las celdas 51 y 52 lo que ve más 10, calculado una sola
vez:

```adn
cond
start
  *.eye5 dup mult 50 store
  *.eye5 10 add dup 51 store 52 store
stop
```

El otro uso famoso está en el Bestiario: `x dup div` vale 1 si `x` no es
cero y 0 si lo es, porque [[op:div]] por cero da 0. Con eso se arman
condiciones con pura aritmética (ver [[adn/operadores]]).

Una rareza heredada: con la pila vacía, `dup` no deja la pila vacía sino que
apila **dos ceros**. En cambio [[op:dupbool]], su par de la pila booleana, no
hace nada con la pila vacía.
