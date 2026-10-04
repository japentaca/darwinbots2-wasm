---
titulo: >=
resumen: "a b >= deja verdadero si a es mayor o igual que b: como >, pero el límite también cuenta."
etiquetas: [condiciones, comparaciones, mayor]
estado: revisada
---
<!-- 20-VM §6.4 (>=: a >= b); comprobado en el port -->

`a b >=` saca dos números y apila _verdadero_ si `a` (el de abajo) es mayor
que `b` (el de arriba) o igual. `5 3 >=` y `3 3 >=` son verdaderos; `3 5 >=`
es falso.

Usala cuando el valor límite tiene que estar incluido. Junto con [[op:<=]]
arma rangos cerrados. Este gen corre en los ciclos 10 a 20 de vida del bot
([[.robage]]), los dos incluidos, y cuenta en la celda 50 cuántas veces corrió:

```adn
cond
  *.robage 10 >=
  *.robage 20 <=
start
  50 inc
stop
```

Al final la celda 50 vale 11. Con [[op:>]] y [[op:<]] en lugar de `>=` y `<=`
valdría 9.

Es exactamente lo contrario de [[op:<]]: `a b >=` es verdadero cuando
`a b <` es falso. Con la pila entera vacía compara 0 con 0 y da verdadero.
Las demás comparaciones están en [[operadores/comparaciones]].
