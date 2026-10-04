---
titulo: ~=
resumen: "a b d ~= deja verdadero si b está dentro del d % de a: un «más o menos igual» con el margen que elijas. Saca tres números."
etiquetas: [condiciones, comparaciones, aproximada, porcentaje]
estado: revisada
---
<!-- 20-VM §6.4 (~=: c = a/100·d; a−c ≤ b ≤ a+c; c<0 siempre falso); comprobado en el port -->

`a b d ~=` es como [[op:%=]] pero con el porcentaje a elección: saca **tres**
números y apila _verdadero_ si `b` está a no más de un `d` % de `a`. La
referencia es `a`, el de más abajo; el porcentaje va arriba.

| Pila antes | Resultado | Por qué |
|---|---|---|
| `100 120 25` | verdadero | el margen es 75 a 125 |
| `100 130 25` | falso | se pasa |
| `1000 1015 1` | falso | el 1 % de 1000 es 10 |
| `100 120 -25` | **falso** | porcentaje negativo |
| `-100 -100 5` | **falso** | referencia negativa |

`100 b 10 ~=` es lo mismo que `100 b %=`. Los límites cuentan y el margen no
se redondea.

Sirve para detectar si una lectura cambió «de verdad» o solo tembló. Este bot
guarda en la celda 50 lo que veía el ojo del medio ([[.eye5]]) y cuenta en la
51 los ciclos en que lo que ve ahora se parece, dentro de un 5 %, a lo del
ciclo anterior:

```adn
' cuenta los ciclos en que lo que ve no cambió más de un 5 %
cond
  *50 *.eye5 5 ~=
start
  51 inc
stop

cond
start
  *.eye5 50 store
stop
```

El gen que guarda va después del que compara, así la celda 50 todavía tiene
el valor viejo cuando se la lee.

:::cuidado
Como en `%=`, con una referencia negativa el margen queda dado vuelta y `~=` es
**siempre falso**, aunque los números sean iguales. Lo mismo pasa con un
porcentaje negativo. Pasá los valores por [[op:abs]] si pueden ser negativos.
:::

Si te olvidás del porcentaje, `~=` igual saca tres números: toma como
referencia lo que haya más abajo en la pila, o 0 si está vacía. Lo contrario
es [[op:!~=]].
