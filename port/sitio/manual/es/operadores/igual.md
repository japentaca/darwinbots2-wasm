---
titulo: =
resumen: "a b = deja verdadero si los dos números son iguales. La de *.eye5 0 =, «no veo nada»."
etiquetas: [condiciones, comparaciones, igualdad]
estado: revisada
---
<!-- 20-VM §6.4 (=); §3 (pila vacía: ceros); sysvars.yaml .refeye, .myeye, .aimdx; comprobado en el port -->

`a b =` saca dos números y apila _verdadero_ si son iguales y _falso_ si no.
Acá el orden no importa: `3 3 =` es verdadero y `3 4 =` es falso.

Dos usos clásicos:

- `*.eye5 0 =`: el ojo del medio ([[.eye5]]) no ve nada.
- `*.refeye *.myeye =`: lo que ve tiene la misma cantidad de lecturas de ojo
  en su ADN que el bot ([[.refeye]] y [[.myeye]]); la forma más simple de
  reconocer a la propia especie.

Este bot gira a la derecha ([[.aimdx]]) mientras no ve nada, buscando algo
que mirar:

```adn
' gira mientras no vea nada
cond
  *.eye5 0 =
start
  60 .aimdx store
stop
```

Para comparar valores que oscilan un poco, como una velocidad o una distancia,
`=` exacto suele ser demasiado estricto; en esos casos sirven [[op:%=]] y
[[op:~=]]. Lo contrario de `=` es [[op:!=]].

Con la pila entera vacía compara 0 con 0 y da **verdadero**. Las demás
comparaciones están en [[operadores/comparaciones]].
