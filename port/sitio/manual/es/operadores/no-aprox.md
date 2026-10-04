---
titulo: !~=
resumen: "a b d !~= deja verdadero si b se aleja más de un d % de a. Es la negación de ~= y también saca tres números."
etiquetas: [condiciones, comparaciones, aproximada, porcentaje]
estado: revisada
---
<!-- 20-VM §6.4 (!~=: negación de ~=, con clamp de c a ±2e9); comprobado en el port -->

`a b d !~=` saca tres números y apila _verdadero_ cuando `b` **no** está
dentro del `d` % de `a`. Es lo contrario de [[op:~=]]: `100 130 25 !~=` es
verdadero y `100 120 25 !~=` es falso. La referencia es `a`, el de más abajo,
y el porcentaje va arriba.

Sirve para reaccionar a cambios grandes e ignorar los chicos. Este bot cuenta
en la celda 51 los ciclos en que lo que ve el ojo del medio ([[.eye5]])
cambió más de un 5 % respecto del ciclo anterior, que guarda en la 50:

```adn
' cuenta los ciclos en que lo que ve cambió más de un 5 %
cond
  *50 *.eye5 5 !~=
start
  51 inc
stop

cond
start
  *.eye5 50 store
stop
```

Fuera del caso de los números enormes que se cuenta abajo, `~=` y `!~=` son
complementarios: si le ponés al bot este contador y el de la página de
[[op:~=]], en cada ciclo suma exactamente uno de los dos.

Como es la negación, hereda al revés las rarezas de `~=`: con una referencia
negativa o un porcentaje negativo da **siempre verdadero**. Y tiene una
diferencia propia: el margen calculado se planta en dos mil millones, cosa que
`~=` no hace. Solo importa con números enormes, de los que no entran en la
memoria; en ese caso `~=` y `!~=` pueden dar los dos verdadero a la vez.

El bot _Chaotic Swarm ver 1.2_ (SA), del Bestiario, usa `!~=` con un margen
del 5 % para decidir si lo que ve cada ojo cambió. La versión al 10 % fijo es
[[op:!%=]].
