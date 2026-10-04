---
titulo: Comparaciones
resumen: "Las preguntas del ADN: sacan números de la pila entera y dejan un verdadero o un falso en la booleana. Igual, distinto, mayor, menor y las comparaciones aproximadas."
etiquetas: [condiciones, comparaciones, pila booleana, operadores]
estado: revisada
---
<!-- 20-VM §6.4, §6.6, §5.1-5.2; opcodes.yaml condiciones; comprobado en el port -->

Cada comparación saca números de la [[adn/pilas#entera|pila entera]] y deja
**un** resultado, verdadero o falso, en la [[adn/pilas#booleana|pila
booleana]]. Se leen de izquierda a derecha: `a b >` pregunta «¿`a` es mayor
que `b`?». Hay tres grupos:

- **Exactas**: [[op:=]], [[op:!=]], [[op:<]], [[op:>]], [[op:<=]] y [[op:>=]].
  Son las que más vas a usar.
- **Aproximadas al 10 %**: [[op:%=]] y [[op:!%=]], para valores que oscilan
  y no conviene comparar exacto.
- **Aproximadas con porcentaje propio**: [[op:~=]] y [[op:!~=]], que sacan un
  tercer número con el margen.

Casi siempre van entre `cond` y `start`, donde todas las que pongas se unen
con un _y_: el cuerpo del gen corre solo si todas son verdaderas (lo cuenta
[[adn/genes]]). Así se arma un rango con dos comparaciones. Este gen corre
solo entre los ciclos 10 y 20 de vida del bot ([[.robage]]), ambos incluidos,
y cuenta en la celda 50 cuántas veces corrió (11):

```adn
cond
  *.robage 10 >=
  *.robage 20 <=
start
  50 inc
stop
```

Para pedir «esto _o_ aquello» hay que combinarlas con [[op:or]]; los demás
lógicos están en [[operadores/logicos]]. Una comparación también puede ir
dentro del cuerpo, y entonces decide si corren los stores que la siguen: eso
es [[adn/condiciones]].

Ninguna falla: si a la pila entera le faltan números, comparan ceros. Por eso
`=` sobre una pila vacía da verdadero (0 es igual a 0) y `<` da falso.

Cada comparación ejecutada cobra el costo [[param:cost:5]] de la configuración
del escenario.
