---
titulo: ^
resumen: "O exclusivo bit a bit de los dos números del tope: deja prendidos los bits que están en uno solo de los dos. Sirve para dar vuelta marcas."
etiquetas: [bits, banderas, alternar]
estado: revisada
---
<!-- 20-VM §6.3 (^: XOR bit a bit); comprobado en el port -->

`a b ^` saca dos números y deja otro con prendidos los bits que están
prendidos en uno solo de ellos. `12 10 ^` da 6 (1100 y 1010 difieren en los
bits de valor 4 y 2).

Su uso típico es **dar vuelta una marca**: si el bit estaba prendido lo
apaga, y si estaba apagado lo prende. Este bot alterna la celda 50 entre 0 y
1 en cada ciclo, algo que sirve para hacer una cosa un ciclo y otra el
siguiente:

```adn
' la celda 50 vale 1, 0, 1, 0…
cond
start
  *50 1 ^ 50 store
stop
```

Otro uso: `a b ^` da 0 solo si `a` y `b` son iguales bit por bit, así que
`a b ^ 0 =` es lo mismo que `a b =`.

Hacer `^` dos veces con el mismo número deja todo como estaba. Con la pila
vacía opera sobre ceros. Las demás operaciones de bits están en
[[operadores/bits]]; el _o exclusivo_ de verdaderos y falsos es [[op:xor]].
