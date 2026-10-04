---
titulo: and
resumen: "Reemplaza los dos valores de arriba de la pila booleana por uno: verdadero solo si los dos lo son."
etiquetas: [lógica, pila booleana, y]
estado: revisada
---
<!-- 20-VM §6.5 (and: b ausente → verdadero; a ausente → b), §5.2 (AddupCond), §6.6; comprobado en el port -->

`and` saca los dos valores de arriba de la pila booleana y apila _verdadero_
si los dos son verdaderos, y _falso_ en cualquier otro caso.

Entre `cond` y `start` casi nunca hace falta escribirlo: el `start` ya une
todas las condiciones con un _y_. Hace falta cuando hay un [[op:or]] en juego,
porque cada lógico combina solo los dos de arriba. Este gen cuenta en la celda
50 los ciclos en que (ve algo **y** no es de su especie) **o** tiene menos de
10 ciclos de edad:

```adn
' (ve a otro y no es de los suyos) o es muy joven
cond
  *.eye5 0 >
  *.refeye *.myeye !=
  and
  *.robage 10 <
  or
start
  50 inc
stop
```

Corrido solo, sin nada a la vista, la celda 50 llega a 10. Sin el `and`, el
`or` uniría las dos últimas condiciones y el `start` haría el _y_ con la
primera: «ve algo y (no es de los suyos o es joven)». Como no ve nada, la
celda se quedaría en 0.

Dentro del cuerpo, `and` sirve para que un store dependa de dos condiciones en
línea: una condición nueva no se suma a la anterior, la tapa (ver
[[adn/condiciones]]).

Con un solo valor en la pila, `and` lo deja tal cual; con la pila vacía apila
verdadero. Para combinar números bit a bit, el operador es [[op:&]].
