---
titulo: xor
resumen: "Reemplaza los dos valores de arriba de la pila booleana por uno: verdadero si exactamente uno de los dos lo es."
etiquetas: [lógica, pila booleana, o exclusivo]
estado: revisada
---
<!-- 20-VM §6.5 (xor: a ausente → not b); Bestiario: Acer_Runco_of_Vita_The_Weed_of_Life.txt; comprobado en el port -->

`xor`, el _o exclusivo_, saca los dos valores de arriba de la pila booleana y
apila _verdadero_ si uno es verdadero y el otro no. Si los dos son iguales
(dos verdaderos o dos falsos), da _falso_.

| Pila antes (tope a la derecha) | Después de `xor` |
|---|---|
| verdadero falso | verdadero |
| falso verdadero | verdadero |
| verdadero verdadero | falso |
| falso falso | falso |

Sirve para «una cosa o la otra, pero no las dos». El bot _Acer Runco of Vita,
The Weed of Life_, del Bestiario, lo usa en un gen que gira y crea lazos (acá
mostramos solo la parte que gira): entre otras
condiciones pide que no vea nada justo al frente ([[.eyef]]) o que lo que ve
sea de su especie ([[.refeye]], [[.myeye]]), pero no las dos cosas a la vez:

```adn
' fragmento de Acer Runco of Vita: las condiciones de un gen
cond
  *40 11 =
  *.robage 20 >
  *.eyef 0 =
  *.refeye *.myeye =
  xor
start
  40 *.aim add .setaim store
stop
```

Otra forma de verlo: `xor` con un verdadero invierte el otro valor, igual que
[[op:not]], y con un falso lo deja igual. Y `a b xor` es verdadero
exactamente cuando `a` y `b` son distintos.

Con un solo valor en la pila, `xor` lo invierte (el que falta cuenta como
verdadero); con la pila vacía apila falso. El _o exclusivo_ bit a bit entre
números es [[op:^]].
