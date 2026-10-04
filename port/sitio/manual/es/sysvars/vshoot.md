---
titulo: .vshoot
resumen: "Dispara el virus incubado: el número es la fuerza del disparo, que define hasta dónde llega y cuánto cuesta."
etiquetas: [virus, disparos, acción]
estado: revisada
---
<!-- 35-VIRUS §2 (dispara con vshoot ≠ 0 y Vtimer = 1; resetea vshoot, vtimer, mkvirus); comprobado: escrita de antemano, el virus sale al terminar la incubación -->
Escribí un número distinto de 0 y, si el virus está listo ([[.vtimer]] en 1), sale
en ese mismo ciclo. Si todavía está incubando, la orden queda escrita y el virus sale
apenas termine: no hace falta esperar con una condición. Después del disparo el
motor pone en 0 `.vshoot`, [[.mkvirus]] y [[.vtimer]].

<!-- 35-VIRUS §2 (energía vshoot·20, alcance 11 + vshoot/2, dirección al azar), §3; port/README B3b-1 (un solo cobro) -->
El número es la fuerza. Cuanto más alto, más energía lleva el virus y más lejos
llega (mucho más lejos que un disparo común), y más cuesta: el bot paga la fuerza
más el costo de un disparo ([[param:cost:23]]). Un valor negativo se toma como 1.

Dos cosas que no se controlan:

- **La dirección es al azar.** El virus no sale hacia donde apunta el bot: ni
  [[.aim]] ni [[.aimshoot]] influyen.
- **El resultado.** Si toca a un bot, el gen entra en un lugar al azar de su ADN.
  Los cadáveres no se infectan, y una capa de baba ([[.slime]]) suficiente detiene
  el virus y se gasta en el intento.

```adn
' Fabrica un virus con el gen 2 y deja el disparo pedido de antemano
cond
 *.vtimer 0 =
start
 2 .mkvirus store
 30 .vshoot store
stop
cond
start
 10 .up store
stop
```

El ciclo completo está en [[sysvars/adn-y-virus]] y en [[simulacion/virus]].
