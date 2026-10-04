---
titulo: <=
resumen: "a b <= deja verdadero si a es menor o igual que b: como <, pero el límite también cuenta."
etiquetas: [condiciones, comparaciones, menor]
estado: revisada
---
<!-- 20-VM §6.4 (<=: a <= b) -->

`a b <=` saca dos números y apila _verdadero_ si `a` (el de abajo) es menor
que `b` (el de arriba) o igual. `3 5 <=` y `3 3 <=` son verdaderos; `4 3 <=`
es falso.

Es la que conviene para los topes que se pueden alcanzar justo. Este bot se
reproduce ([[.repro]]) cuando tiene más de 3000 de energía ([[.nrg]]), pero
solo mientras tiene 100 ciclos de edad o menos ([[.robage]]):

```adn
' se reproduce de joven, si tiene energía
cond
  *.nrg 3000 >
  *.robage 100 <=
start
  50 .repro store
stop
```

Es exactamente lo contrario de [[op:>]]: `a b <=` es verdadero cuando
`a b >` es falso. Con [[op:>=]] arma rangos cerrados.

Con la pila entera vacía compara 0 con 0 y da verdadero. Las demás
comparaciones están en [[operadores/comparaciones]].
