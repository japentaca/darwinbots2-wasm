---
titulo: Números y direcciones
resumen: "Qué números podés escribir en el ADN, cómo se lee la memoria con el asterisco, por qué una sysvar es solo una dirección y qué pasa con los valores y direcciones fuera de rango."
etiquetas: [números, direcciones, memoria, sysvar, rango]
estado: revisada
---
En el ADN todo es número. Una cantidad, una dirección de memoria y el nombre
de una sysvar terminan siendo enteros en la [[adn/pilas#entera|pila entera]].
Esta página cuenta qué números podés escribir, cómo se lee y se escribe la
memoria, y qué hace el motor cuando un valor o una dirección se salen de
rango.

## Literales {#literales}
<!-- 20-VM §0.4, §2.4 (val → Integer: fuera de rango, error 6 y el archivo no carga; decimales bancarios), §2.5, §6.3 (- niega) -->

Un número escrito en el ADN se apila tal cual: `50`, `-5`, `32000`.

- **Rango del literal: de −32768 a 32767.** Un literal fuera de ese rango no
  se redondea ni se recorta: **el bot entero no carga**. Junto con una línea [[adn/def]] mal escrita,
  es lo único del ADN que hace rechazar el archivo.
- **Negativos:** se escriben con el signo pegado, `-5`. También podés negar lo
  que está en el tope con [[op:-]] (`5 -` deja −5) o restar desde cero
  (`0 7 sub` deja −7).
- **Decimales:** se redondean al entero más cercano y, en el empate, al par:
  `1.5` vale 2 y `2.5` también vale 2. No hay números con coma en la pila.

Este literal hace que el bot no cargue:

```adn sin-lint
cond
start
  40000 50 store
stop
```

Si necesitás un número grande, armalo con operaciones: `200 200 mult` deja
40000 en la pila sin problema.

:::cuidado
Una palabra que no es un comando, ni un número, ni una sysvar, ni una variable
de [[adn/def]] **no da error: vale 0**. Un error de tipeo como `.upp` en lugar
de [[.up]] se convierte en un 0 silencioso. El [[app/editor]] te lo marca;
mirá también [[adn/errores]].
:::

## Una sysvar es una dirección {#sysvar}
<!-- 20-VM §2.4 (SysvarTok), 21-MEMORIA §1-§2; sysvars.yaml 1 (up), 310 (nrg) -->

La memoria de cada bot tiene 1000 celdas, numeradas del 1 al 1000. Algunas
tienen nombre: son las _sysvars_. [[.up]] es la celda 1, [[.nrg]] es la 310.
Escribir `.up` en el ADN es exactamente lo mismo que escribir `1`: apila la
**dirección**, no el contenido.

Por eso `10 .up store` funciona: apila 10, apila 1 y [[op:store]] escribe 10
en la celda 1. Y por eso este bot guarda en la celda 51 el número 310, la
dirección de la energía, y no la energía:

```adn
cond
start
  .nrg 51 store
stop
```

Las celdas sin nombre son memoria libre para lo que quieras (ver
[[adn/memoria]]). Con [[adn/def]] les ponés nombre propio. La lista completa
de sysvars está en la referencia de sysvars, por ejemplo [[.nrg]].

## Leer la memoria: el asterisco {#leer}
<!-- 20-VM §1 (tipo 1), §4, §6.1 (*); 21-MEMORIA §0.3 (latencia 1 ciclo); 10-CICLO §2 «Flujo de datos de los sentidos» -->

Para apilar el **contenido** de una celda se antepone un asterisco:

| Escribís | Apila |
|---|---|
| `50` | el número 50 |
| `*50` | lo que hay en la celda 50 |
| `.nrg` | el número 310 |
| `*.nrg` | lo que hay en la celda 310: la energía del bot |

Si la dirección la calculás en el momento, usá el operador [[op:*]] separado:
saca una dirección del tope y apila el contenido de esa celda. `50 *` es lo
mismo que `*50`, pero sirve también para `*.nrg 10 div *`, donde la dirección
sale de una cuenta.

Este bot copia lo que hay en la celda 50 a la 60:

```adn
cond
start
  *50 60 store
stop
```

:::nota
Lo que el motor escribe para el bot (energía, sentidos, lo que ven los ojos)
se publica después de que corre el ADN, así que el ADN siempre lee el valor
del ciclo anterior. Un bot recién sembrado lee `*.nrg` en 0 durante su primer
ciclo. Ver [[adn/ejecucion#retraso]] y [[simulacion/ciclo]].
:::

## Direcciones fuera de 1 a 1000 {#fuera}
<!-- 20-VM §0.6, §4 (tipo 1), §6.1 (*), §7 (Abs Mod 1000, 0 → 1000) -->

Desde el ADN no hay forma de leer ni escribir fuera de las 1000 celdas. Toda
dirección, al leer o al escribir, pasa por la misma regla:

1. Se toma el valor absoluto (el signo se ignora).
2. Se toma el resto de dividir por 1000.
3. Si el resto es 0, la celda es la 1000.

| Dirección pedida | Celda usada |
|---|---|
| 50 | 50 |
| 1050 | 50 |
| −51 | 51 |
| 2052 | 52 |
| 1000, 2000 | 1000 |
| 0 al leer (`*0`, `0 *`) | 1000 |
| 0 al escribir | ninguna (ver abajo) |

Este bot escribe 7, 8 y 9 en las celdas 50, 51 y 52 aunque las direcciones
parezcan otras:

```adn
cond
start
  7 1050 store
  8 -51 store
  9 2052 store
stop
```

El bot «Alga_Pair 1.1.1» del Bestiario aprovecha la regla: define variables
como `ninjaShoot` en la 1007 o `ninjaUp` en la 1001, que en la memoria son
[[.shoot]] (7) y [[.up]] (1) con otro nombre. Este bot se mueve aunque nunca
escriba `.up`:

```adn
def ninjaup 1001

cond
start
  10 .ninjaup store
stop
```

### Escribir en la dirección 0 {#cero}
<!-- 20-VM §7 (dirección 0: no-op sin costo; store/addstore/substore/multstore no sacan el valor) -->

Un store cuya dirección es exactamente 0 **no escribe nada y no cuesta
energía**. Con [[op:store]], [[op:addstore]], [[op:substore]] y
[[op:multstore]], además, el valor **queda en la pila** sin consumirse. Acá el
store a 0 no hace nada, el 7 sigue en la pila y el segundo store lo guarda en
la 58:

```adn
cond
start
  7 0 store
  58 store
stop
```

Pasa lo mismo si el 0 sale de una cuenta (`5 5 sub store`). El detalle de
cada store está en [[adn/stores]].

## La aritmética y el recorte a ±32000 {#recorte}
<!-- 20-VM §0.5, §6.1 (add/sub envuelven, mult satura en ±2·10⁹), §7 (mod32000 y excepciones) -->

La memoria guarda valores de −32000 a 32000, pero **la pila entera no**: ahí
los números pueden crecer hasta unos dos mil millones. [[op:mult]] satura en
ese límite y [[op:add]] y [[op:sub]] dan la vuelta, pero en la práctica no vas
a llegar. Un resultado intermedio grande no es problema mientras lo achiques
antes de guardarlo: `300 300 mult 300 div` da 300, aunque en el medio la pila
tuvo 90000.

El recorte pasa **al escribir**. Un store no satura: se queda con el **resto
de dividir por 32000**, conservando el signo. La única excepción son los
múltiplos exactos de 32000, que quedan en 32000 (o −32000). Así un store
nunca escribe 0 salvo que el valor sea 0.

| Valor en la pila | Queda en la memoria |
|---|---|
| 32000 | 32000 |
| 32500 | 500 |
| 32767 | 767 |
| 60000 (`30000 30000 add`) | 28000 |
| 64000 | 32000 |
| 90000 (`300 300 mult`) | 26000 |
| −40000 | −8000 |

Este bot guarda 28000, no 32000:

```adn
cond
start
  30000 30000 add 50 store
stop
```

El mismo recorte vale para [[op:inc]] y [[op:dec]]: un contador en 32000 que
sube uno pasa a **1**, no a −32000; uno en −32000 que baja pasa a −1. Si
llevás la cuenta de algo que puede crecer mucho, controlalo antes de que
llegue al tope.

Algunos stores (como [[op:divstore]] o [[op:sqrstore]]) no aplican el recorte
porque su resultado ya cae en rango; están en [[adn/stores]].

## Números negativos {#negativos}
<!-- 20-VM §6.1 (mod, div), §7; 21-MEMORIA §5 (timer de fundadores Random(-32000,32000)) -->

Los negativos son ciudadanos normales del ADN, con un par de detalles:

- **Como valor**, se guardan con su signo: `-5 50 store` deja −5.
- **Como dirección**, el signo se ignora: `-50` es la celda 50.
- [[op:mod]] deja el signo del dividendo: `-7 3 mod` da −1 y `7 -3 mod` da 1.
- [[op:div]] no trunca, redondea al más cercano y, en el empate, al par:
  `7 2 div` da 4 y `5 2 div` da 2. Dividir por 0 da 0.

Varias sysvars admiten negativos: el [[.timer]] de un bot fundador, por
ejemplo, arranca en un valor al azar entre −32000 y 32000. El rango de cada una está en su ficha de la referencia, y los operadores
aritméticos uno por uno en [[adn/operadores]].

## Resumen {#resumen}

| Qué | Regla |
|---|---|
| Literal | de −32768 a 32767; fuera de eso el bot no carga |
| Decimal | redondea al entero más cercano, al par en el empate |
| Palabra desconocida | vale 0 |
| `.sysvar` | su dirección (un número de 1 a 1000) |
| `*n`, `*.sysvar`, `n *` | el contenido de la celda |
| Dirección fuera de rango | valor absoluto, resto de dividir por 1000, 0 → 1000 |
| Store a la dirección 0 | no hace nada |
| Valores en la pila | hasta unos ±2000 millones |
| Valor al guardar | resto de dividir por 32000, con signo; múltiplos exactos → ±32000 |

<!-- Resumen: 21-MEMORIA §0, §2; 20-VM §0.6, §2.4, §4, §6.1, §7 -->
