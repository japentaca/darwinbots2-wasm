---
titulo: Lógicos
resumen: "Los operadores de la pila booleana: and, or, xor y not para combinar condiciones, true y false, y las herramientas para acomodar esa pila."
etiquetas: [lógica, pila booleana, condiciones, operadores]
estado: revisada
---
<!-- 20-VM §6.5, §6.6, §3 (vacío = verdadero), §4 (gate de stores); opcodes.yaml logicos; comprobado en el port -->

Los lógicos trabajan solo con la [[adn/pilas#booleana|pila booleana]], la de
verdaderos y falsos que llenan las [[operadores/comparaciones|comparaciones]].
No tocan la pila entera. Son de tres clases:

- **Combinar**: [[op:and]], [[op:or]] y [[op:xor]] reemplazan los dos valores
  de arriba por uno; [[op:not]] invierte el de arriba.
- **Constantes**: [[op:true]] y [[op:false]] apilan un valor fijo.
- **Acomodar la pila**: [[op:dropbool]], [[op:clearbool]], [[op:dupbool]],
  [[op:swapbool]] y [[op:overbool]], las mismas herramientas que la pila
  entera tiene en los [[operadores/basicos|básicos]].

Entre `cond` y `start` el que más hace falta es `or`, porque el _y_ ya lo pone
el `start`, que une con _y_ todo lo que quede en la pila booleana.

Dentro del cuerpo de un gen cambian de papel: cada store mira el valor de
arriba de la pila booleana y, si es falso, no escribe (lo cuenta
[[adn/condiciones]]). Ahí `not`, `true`, `dropbool` y `clearbool` sirven para
decidir qué stores corren. Este bot avanza si ve algo con el ojo del medio
([[.eye5]]) y, si no, gira; al final deja la pila limpia para el gen que siga:

```adn
' si ve algo, avanza; si no, gira
cond
start
  *.eye5 0 >
  20 .up store
  not
  60 .aimdx store
  clearbool
stop
```

Una regla vale para todos: **la pila booleana vacía cuenta como verdadera**. Cuando
a un operador le falta un operando, lo reemplaza por verdadero, y por eso
algunos dan resultados que sorprenden con la pila vacía o con un solo valor:
`not` sobre la pila vacía da falso, y `or` con un único valor da siempre verdadero. Cada página
lo detalla, y el panorama de las dos pilas está en [[adn/pilas]].

Cada operador lógico ejecutado cobra el costo [[param:cost:6]] de la
configuración del escenario.
