---
titulo: Números y lecturas
resumen: "Las dos palabras más simples del ADN: un número, que se apila tal cual, y una lectura con asterisco, que apila lo que hay en una celda de memoria."
etiquetas: [números, lectura, memoria, asterisco]
estado: revisada
---
<!-- 20-VM §1 (tipos 0 y 1), §2.4, §4; opcodes.yaml pseudo_tokens -->

Toda cuenta del ADN empieza por apilar algo, y para eso hay dos palabras que
no son comandos sino datos:

- **El número** ([[operadores/numero]]): `50`, `-5` o el nombre de una sysvar
  como `.up`, que es solo su dirección (la 1). Se apila tal cual.
- **La lectura** ([[operadores/lectura]]): un asterisco pegado, como `*50` o
  `*.nrg`, apila lo que _hay_ en esa celda de memoria.

Son, de lejos, las palabras más frecuentes de cualquier bot. Una condición
típica como `*.nrg 1000 >` tiene una de cada, y un store como `10 .up store`
tiene dos números: el valor y la dirección. La regla práctica es corta: sin
asterisco cuando querés _escribir_ en una sysvar, con asterisco cuando querés
_saber_ cuánto vale.

Cuando la dirección no la sabés de antemano sino que sale de una cuenta, la
lectura se hace con el operador [[op:*]], que toma la dirección de la pila.

Este bot muestra la diferencia: en la celda 50 guarda su edad
([[.robage]]), que sube de a uno cada ciclo, y en la 51 guarda la dirección
de la edad, que es siempre 9.

```adn
cond
start
  *.robage 50 store
  .robage 51 store
stop
```

Cada número cuesta lo que diga [[param:cost:0]] y cada lectura lo que diga
[[param:cost:1]]; con las reglas F1 los dos son gratis (ver
[[adn/ejecucion#costos]]). Todos los detalles sobre rangos y direcciones están
en [[adn/numeros]].
