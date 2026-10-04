---
titulo: sgn
resumen: "Cambia el número de arriba de la pila por su signo: −1 si es negativo, 0 si es cero y 1 si es positivo."
etiquetas: [aritmética, signo, básicos]
estado: revisada
---
<!-- 20-VM §6.1 (sgn) -->

`x sgn` deja −1, 0 o 1 según el signo de `x`. Sirve para quedarse con la
_dirección_ de algo y olvidarse del tamaño: hacia qué lado está, si subió o
bajó, si hay o no hay.

| `x` | `x sgn` |
|---|---|
| −250 | −1 |
| 0 | 0 |
| 37 | 1 |

Combinado con [[op:mult]] da un paso de tamaño fijo en la dirección que
haga falta. Este bot guarda en la celda 51 su energía y, en la 50, +5 o −5
según si la energía subió o bajó desde el ciclo anterior (0 si no cambió):

```adn
cond
start
  *.nrg *51 sub sgn 5 mult 50 store
  *.nrg 51 store
stop
```

Para saber solo si un número es distinto de cero (1) o no (0), sin importar
el signo, se usa `sgn abs`; si es para una condición, alcanza con
`x 0 !=` ([[op:!=]]). Si lo que querés escribir es el signo en una celda, está
[[op:sgnstore]].
