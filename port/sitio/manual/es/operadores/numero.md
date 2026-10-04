---
titulo: <numero>
resumen: "Un número escrito en el ADN, o el nombre de una sysvar sin asterisco, se apila tal cual en la pila entera."
etiquetas: [números, literal, dirección, rango]
estado: revisada
---
<!-- 20-VM §1 (tipo 0), §2.4 (SysvarTok, val, error 6, bancario), §0.4 -->

Un número suelto en el ADN no hace nada más que apilarse. Es la forma de
darle a los operadores sus datos: en `10 3 sub`, el 10 y el 3 son números y
[[op:sub]] los usa.

Cuentan como número, además de las cifras:

- **El nombre de una sysvar sin asterisco.** `.up` es exactamente lo mismo que
  `1`: apila la dirección de [[.up]], no su contenido. Por eso se usa para
  decir _dónde_ escribe un [[op:store]].
- **Una variable de [[adn/def]].** `def presa 50` hace que `.presa` sea el 50.
- **Cualquier palabra que no se reconozca.** No da error: vale 0 (ver
  [[adn/errores#nombre]]).

Reglas del literal:

- Tiene que estar entre **−32768 y 32767**. Fuera de ese rango, el bot entero
  no carga. Un número más grande se arma con operadores: `200 200 mult`.
- Los negativos se escriben con el signo pegado: `-5`.
- Un decimal se redondea al entero más cercano, y en el empate al par: `1.5` y
  `2.5` valen los dos 2.

```adn
cond
start
  ' pila: 5   después: 5 1   store escribe 5 en la celda 1 (.up)
  5 .up store
stop
```

Este bot empuja hacia adelante con 5 en cada ciclo. Cada número cuesta
[[param:cost:0]], que con las reglas F1 es 0. Más en
[[adn/numeros#literales]].
