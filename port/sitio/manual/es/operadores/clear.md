---
titulo: clear
resumen: "Vacía la pila entera de un saque; la pila booleana no la toca."
etiquetas: [pila, vaciar, básicos]
estado: revisada
---
<!-- 20-VM §3, §4 (pila entera no se limpia entre genes), §6.1 (clear); opcodes.yaml alias clearint -->

`clear` tira todo lo que haya en la pila entera. También se puede escribir
`clearint`. La pila booleana queda como estaba; para esa está
[[op:clearbool]].

¿Para qué vaciar la pila, si cada bot arranca su turno con las pilas vacías?
Porque **entre genes del mismo ciclo la pila entera no se vacía**: un número
que sobró en un gen lo encuentra el siguiente. `clear` al principio de un
cuerpo asegura que el gen trabaje solo con lo suyo.

```adn
start
  7
stop

cond
start
  clear 50 store
stop
```

El primer gen deja un 7 olvidado. Sin el `clear`, el segundo gen lo guardaría
en la celda 50; con el `clear`, la pila está vacía, [[op:store]] saca un 0 y la
celda 50 queda en 0. Más sobre esto en [[adn/pilas#cuando]].
