---
titulo: %=
resumen: "a b %= deja verdadero si b está dentro del 10 % de a, límites incluidos. Con a negativo da siempre falso."
etiquetas: [condiciones, comparaciones, aproximada]
estado: revisada
---
<!-- 20-VM §6.4 (%=: a−a/10 ≤ b ≤ a+a/10 en Single; a<0 siempre falso), §12; comprobado en el port -->

`a b %=` es un «más o menos igual»: apila _verdadero_ si `b` está a no más de
un 10 % de `a`, para arriba o para abajo. El número de abajo, `a`, es la
referencia, y el margen se calcula sobre él:

| Pila antes | Resultado | Por qué |
|---|---|---|
| `100 109` | verdadero | el margen es 90 a 110 |
| `100 110` | verdadero | los límites cuentan |
| `100 111` | falso | se pasa |
| `15 16` | verdadero | el margen es 13,5 a 16,5: no se redondea |
| `0 0` | verdadero | con referencia 0, solo vale 0 |
| `-100 -100` | **falso** | ver abajo |

Sirve para valores que oscilan y que nunca van a coincidir exacto, como la
energía, la velocidad o una lectura de ojo. Este gen cuenta en la celda 50
los ciclos en que la energía ([[.nrg]]) está entre 2700 y 3300:

```adn
' cuenta los ciclos con la energía cerca de 3000
cond
  3000 *.nrg %=
start
  50 inc
stop
```

Fijate en el orden: la referencia, 3000, va abajo. `*.nrg 3000 %=` mediría el
10 % de la energía, que cambia con ella.

:::cuidado
Una rareza heredada del DarwinBots 2.48.32: con una referencia negativa el
margen queda dado vuelta y `%=` es **siempre falso**, aunque los dos números
sean iguales. Si los valores pueden ser negativos (una velocidad lateral, una
diferencia), pasalos antes por [[op:abs]].
:::

Si el margen tiene que ser otro, usá [[op:~=]], que recibe el porcentaje. Lo
contrario es [[op:!%=]]. Con la pila entera vacía compara 0 con 0 y da
verdadero.
