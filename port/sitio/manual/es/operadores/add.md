---
titulo: add
resumen: "Suma los dos números de arriba de la pila entera y deja el resultado."
etiquetas: [aritmética, suma, básicos]
estado: revisada
---
<!-- 20-VM §0.5, §6.1 (add: Single, envuelve en ±2·10⁹); §7 (inc cuesta COSTSTORE/10); comprobado en el port: 20000001+1 = 20000001, 2,048·10⁹ → 48·10⁶ -->

`a b add` deja `a + b`. Es la suma de toda la vida, con el orden de siempre
en el ADN: primero los dos números, después la palabra.

| Palabra | Pila después |
|---|---|
| `3` | 3 |
| `4` | 3 4 |
| `add` | 7 |

El uso más común es ajustar una lectura antes de guardarla o llevar una cuenta
en memoria libre. Este bot suma 1 a la celda 50 en cada ciclo:

```adn
cond
start
  *50 1 add 50 store
stop
```

Para eso puntual hay un atajo, [[op:inc]] (`50 inc`), que hace lo mismo con
menos palabras y por la décima parte de la energía que cuesta un
[[op:store]] (ver [[adn/ejecucion#costos]]).

Dos rarezas heredadas, que solo se notan con números enormes, más allá de lo
que cabe en la memoria:

- Arriba de 16.777.216, la suma pierde precisión: los operandos se
  redondean antes de sumar y el resultado puede errar por unas unidades (más cuanto más grande
  sea el número). `20000 1000 mult 1 add 1 add` da
  20000001 y no 20000002.
- Si el resultado pasa de 2000 millones, **da la vuelta** en lugar de quedarse
  en el tope: `32000 32000 mult dup add` da 48 millones. [[op:mult]], en
  cambio, satura.

La resta, [[op:sub]], se comporta igual.
