---
titulo: -
resumen: "El signo menos suelto le cambia el signo al número del tope: 5 - deja −5. No resta; para restar está sub."
etiquetas: [signo, negativos, pila entera]
estado: revisada
---
<!-- 20-VM §6.3 (- negate: negación directa); comprobado en el port -->

`x -` saca un número y apila el mismo con el signo cambiado: `5 -` da −5 y
`-7 -` da 7. Es un operador de un solo operando, y por eso es fácil
confundirlo.

:::cuidado
El `-` suelto **no resta**. `10 3 -` no da 7: deja 10 y −3 en la pila. Para
restar se usa [[op:sub]] (`10 3 sub`). Y un número negativo se escribe
pegado, `-5`; con espacio, `- 5` le cambia el signo a lo que haya en la pila y
después apila un 5.
:::

Sirve para invertir una lectura. Este bot empuja hacia adelante sus primeros 5
ciclos y después frena empujando, en cada ciclo, tanto como su velocidad
hacia adelante ([[.velup]]) pero al revés. En unos pocos ciclos queda quieto:

```adn
' acelera 5 ciclos y después frena
cond
  *.robage 5 <
start
  10 .up store
stop

cond
  *.robage 5 >=
start
  *.velup - .up store
stop
```

Cuando la velocidad es negativa, `-` la vuelve positiva y [[.up]] empuja hacia
adelante: el mismo gen frena en las dos direcciones.

Para cambiarle el signo a una celda de memoria, sin pasar por la pila, está
[[op:negstore]]. Con la pila vacía, `-` deja 0. Aunque está en la familia
[[operadores/bits|bit a bit]], no toca los bits.
