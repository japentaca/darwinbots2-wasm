---
titulo: !%=
resumen: "a b !%= deja verdadero si b se aleja más de un 10 % de a. Es la negación exacta de %=, así que con a negativo da siempre verdadero."
etiquetas: [condiciones, comparaciones, aproximada]
estado: revisada
---
<!-- 20-VM §6.4 (!%=: negación de %=); Bestiario: This_n_That_1.01_F2_Peksa_-_12.05.08.txt; comprobado en el port -->

`a b !%=` apila _verdadero_ cuando `b` **no** está dentro del 10 % de `a`, y
_falso_ cuando sí. Es exactamente lo contrario de [[op:%=]]: `100 111 !%=` es
verdadero y `100 109 !%=` es falso.

Sirve para reaccionar solo cuando algo se desequilibró bastante, sin
gastar energía por diferencias chicas. Este gen convierte energía en cuerpo
([[.strbody]]) cuando la energía ([[.nrg]]) supera al cuerpo ([[.body]]) en
más de un 10 %, y para cuando quedan parejos:

```adn
' pasa energía al cuerpo mientras sobre energía
cond
  *.body *.nrg !%=
  *.nrg *.body >
start
  100 .strbody store
stop
```

La referencia es el cuerpo, el número de abajo. Un bot que arranca con 3000
de energía y 1000 de cuerpo se detiene en 1200 de energía y 1180 de cuerpo
(cada 100 de energía que pasa por [[.strbody]] da solo 10 de cuerpo),
cuando la energía entra en el 10 % del cuerpo. El bot _This'n'That 1.01_ (Peksa), del
Bestiario, usa la misma idea en las dos direcciones; está en
[[op:dupbool]].

Como es la negación exacta, hereda al revés la rareza de `%=`: con una
referencia negativa, `!%=` da **siempre verdadero**. Con la pila entera vacía
compara 0 con 0 y da falso. La versión con porcentaje propio es [[op:!~=]].
