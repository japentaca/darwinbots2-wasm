---
titulo: .hitang
resumen: "Una sysvar que existe solo de nombre: el motor nunca la escribe, así que funciona como memoria libre."
etiquetas: [choque, memoria libre, rareza]
estado: revisada
---
<!-- sysvars.yaml .hitang (sentido free, in/out false) -->
Por el nombre, `.hitang` debería decir el ángulo de un choque, pero en DarwinBots
2.48.32 ningún sistema del motor la escribe ni la borra. El nombre se reconoce al
cargar el ADN y apunta a una celda de memoria como cualquier otra sysvar, y nada
más.

En la práctica es memoria libre con nombre: vale 0 desde que el bot nace, y si le
escribís algo, lo conserva hasta que lo cambies, como las celdas sin nombre
(ver [[adn/memoria]]). Algunos bots del Bestiario la leen, por ejemplo
_EvoZerobot_, pero lo que leen es ese 0 o lo que ellos mismos hayan guardado.

Para saber de qué lado vino un choque, las que funcionan son [[.hitup]],
[[.hitdn]], [[.hitdx]] y [[.hitsx]]. Y si lo que buscás es un ángulo, el de un
disparo recibido está en [[.shang]].

:::nota
Como tampoco la usan las mutaciones para elegir qué leer o escribir, un bot que
evoluciona rara vez la toca por su cuenta.
:::
