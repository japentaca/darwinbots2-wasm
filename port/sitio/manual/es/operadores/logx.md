---
titulo: logx
resumen: "Da el logaritmo del número de abajo en la base del de arriba, redondeado: 1000 10 logx da 3."
etiquetas: [matemática, logaritmo, avanzados]
estado: revisada
---
<!-- 20-VM §6.2 (logx: Abs de ambos; b < 2 o a = 0 → 0; Log(a)/Log(b) redondeado); comprobado en el port -->

`a b logx` deja el logaritmo de `a` en base `b`: el exponente al que hay que
elevar `b` para llegar a `a`. `1000 10 logx` da 3 y `8 2 logx` da 3. Como
siempre, el resultado se redondea: `100 2 logx` da 7 (es 6,64…).

Las reglas para los casos raros:

- A los dos números **se les saca el signo** antes de calcular.
- Si la base es menor que 2 (0 o 1), o si `a` es 0, da **0**.

Sirve para trabajar con órdenes de magnitud, cuando importa más _cuántas
cifras_ tiene un número que el número exacto. Este bot guarda en la celda 50
el orden de magnitud de su energía: 3 mientras ande entre unos 320 y 3160, 2
por debajo y 4 por encima (el redondeo cambia de valor a mitad de camino):

```adn
cond
start
  *.nrg 10 logx 50 store
stop
```

La operación inversa es [[op:pow]]: `10 3 pow` da 1000.
