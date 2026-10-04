---
titulo: !=
resumen: "a b != deja verdadero si los dos números son distintos. La de *.refeye *.myeye !=, «no es de los míos»."
etiquetas: [condiciones, comparaciones, desigualdad]
estado: revisada
---
<!-- 20-VM §6.4 (!=: a <> b); sysvars.yaml .refeye, .myeye; comprobado en el port (con otra especie) -->

`a b !=` saca dos números y apila _verdadero_ si son distintos y _falso_ si
son iguales. Es exactamente lo contrario de [[op:=]]: `3 4 !=` es verdadero y
`3 3 !=` es falso.

Su uso más conocido es no atacar a la propia especie. [[.refeye]] es la
cantidad de lecturas de ojo en el ADN de lo que el bot está mirando y
[[.myeye]] la del propio bot; si difieren, casi seguro es otra especie. Este gen dispara
([[.shoot]]) solo si ve algo ([[.eye5]]) y no es de los suyos:

```adn
' dispara a lo que ve, si no es de su especie
cond
  *.eye5 0 >
  *.refeye *.myeye !=
start
  -1 .shoot store
stop
```

La inversa no es tan segura: dos especies distintas pueden tener, por
casualidad, la misma cantidad de ojos.

También sirve para detectar cambios: `*.eye5 *50 !=` es verdadero cuando lo
que ve el ojo del medio cambió respecto de lo que guardaste en la celda 50.
Si el cambio tiene que superar un margen, usá [[op:!%=]] o [[op:!~=]].

Con la pila entera vacía compara 0 con 0 y da falso. Las demás comparaciones
están en [[operadores/comparaciones]].
