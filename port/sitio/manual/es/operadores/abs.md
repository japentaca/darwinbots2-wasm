---
titulo: abs
resumen: "Cambia el número de arriba de la pila por su valor absoluto: le saca el signo."
etiquetas: [aritmética, valor absoluto, básicos]
estado: revisada
---
<!-- 20-VM §6.1 (abs) -->

`x abs` deja `x` sin signo: `-7 abs` da 7 y `7 abs` también. Aparece casi
siempre después de una resta, cuando importa cuánto difieren dos cosas y no
cuál es mayor.

Este bot avanza solo si los dos ojos vecinos del central, [[.eye4]] y
[[.eye6]], ven más o menos lo mismo (difieren en menos de 10):

```adn
cond
  *.eye4 *.eye6 sub abs 10 <
start
  10 .up store
stop
```

Con [[op:anglecmp]] pasa lo mismo: la diferencia entre dos ángulos viene con
signo, y `abs` la convierte en «cuánto me falta girar», sin importar hacia
qué lado. Para escribir el valor absoluto directamente en una celda está
[[op:absstore]].
