---
titulo: Bit a bit
resumen: "Los operadores que miran un número como 32 bits: y, o, o exclusivo, inversión, corrimientos, más uno y menos uno, y el cambio de signo."
etiquetas: [bits, banderas, pila entera, operadores]
estado: revisada
---
<!-- 20-VM §6.3; opcodes.yaml bitwise; comprobado en el port -->

Estos operadores trabajan, como los [[operadores/basicos|básicos]], solo con la
[[adn/pilas#entera|pila entera]]: sacan uno o dos números y dejan uno. La
diferencia es que ven cada número como una fila de 32 bits (en complemento a
dos, la forma habitual de guardar negativos) y operan bit por bit.

- **Combinar dos números**: [[op:&]] (_y_), [[op:|]] (_o_) y [[op:^]]
  (_o exclusivo_).
- **Transformar uno**: [[op:~]] invierte todos los bits, [[op:<<]] y [[op:>>]]
  los corren un lugar (doblan o parten a la mitad), [[op:++]] y [[op:--]]
  suman o restan 1.
- **El signo menos suelto**, [[op:-]], también es de esta familia aunque no
  toca bits: le cambia el signo al tope. No resta; para restar está
  [[op:sub]].

El uso más común es guardar varias marcas de sí o no en una sola celda de
memoria, una por bit: `|` con una potencia de 2 prende un bit, `~` y `&` lo
apagan, y `&` solo pregunta si está prendido. Una celda guarda hasta ±32000,
así que caben sin problemas 14 marcas (los bits de valor 1, 2, 4… hasta
8192). La de 16384 entra solo si la suma no pasa de 32000.

Este bot tiene un 1 en la celda 50 (el bit de valor 1). Cuando su edad llega a 5
prende el de valor 4 y la celda pasa a 5; a los 10 lo apaga y vuelve a 1, sin tocar
el otro bit:

```adn
' prende el bit de valor 4 de la celda 50 y después lo apaga
cond
  *.robage 5 =
start
  *50 4 | 50 store
stop

cond
  *.robage 10 =
start
  *50 4 ~ & 50 store
stop
```

Para preguntar por la marca, `*50 4 & 0 !=` deja verdadero si el bit está
prendido (ver [[op:!=]]).

Ninguno falla con la pila vacía: operan sobre ceros. En el borde de los 32 bits
hay dos rarezas heredadas del DarwinBots 2.48.32 (un resultado que debería ser
el negativo más grande sale como 0); las cuentan [[op:++]] y [[op:<<]]. Con
números del tamaño de la memoria nunca vas a llegar ahí.

Cada operador de esta familia que se ejecuta cobra el costo [[param:cost:4]]
de la configuración del escenario. El
panorama de todas las familias está en [[adn/operadores]].
