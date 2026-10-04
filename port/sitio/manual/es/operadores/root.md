---
titulo: root
resumen: "Da la raíz b-ésima del número de abajo: 27 3 root da 3. Ignora los signos y, con b en 0, da 0."
etiquetas: [matemática, raíz, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (root: Abs de ambos; b = 0 → 0; a^(1/b) redondeado); comprobado en el port -->

`a b root` deja la raíz `b`-ésima de `a`, redondeada al entero más cercano:
`27 3 root` da 3, `10 2 root` da 3 (es 3,16…) y `1024 10 root` da 2.

Antes de calcular, **les saca el signo a los dos**: `-27 3 root` da 3, no −3,
y `27 -3 root` también da 3. Con `b` en 0 da 0.

```adn
cond
start
  27 3 root 50 store
  -27 3 root 51 store
  10 0 root 52 store
stop
```

Las celdas 50, 51 y 52 quedan en 3, 3 y 0.

Para la raíz cuadrada hay un atajo, [[op:sqr]], con una diferencia: `sqr` de
un negativo da 0, mientras que `-16 2 root` da 4. La operación inversa es
[[op:pow]].
