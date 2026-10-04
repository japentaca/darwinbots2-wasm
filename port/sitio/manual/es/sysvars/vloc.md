---
titulo: .vloc
resumen: "La celda de memoria que tu veneno le va a pisar a la víctima en cada ciclo de la parálisis."
etiquetas: [defensas, venom, memoria, configuración]
estado: revisada
---
Es configuración: la escribís una vez y el motor la lee cada vez que disparás
veneno (`-3` en [[.shoot]]) o lo pasás por un lazo ([[.tieloc]] `-3`). No la
borra nunca. Junto con [[.venval]] decide qué le pasa a la víctima: mientras esté
paralizada, el motor escribe `.venval` en su celda `.vloc` en cada ciclo, después
de que corre su ADN, así que la víctima no puede corregirlo.

<!-- sysvars.yaml .vloc (newshot copia mem(835); ties); 21-MEMORIA §3 (persistente), §4.3 (Poisons P1 cada ciclo); 10-CICLO §2 P1 -->

Los blancos más usados son órdenes que la víctima no quiere cumplir: [[.shoot]]
con `-2` (regala energía), [[.up]] (avanza), [[.aimdx]] (gira).

Tres detalles:

- Un valor fuera de 1…1000 se lleva a ese rango igual que una dirección de
  memoria (1050 es la 50).
- Con 0 o un negativo, cada golpe elige una celda al azar.
- La 340 ([[.delgene]]) está protegida: si apuntás ahí, no pasa nada.

<!-- 21-MEMORIA §6 ((memloc−1) Mod 1000 + 1; 340 → mem(0); ≤ 0 → Random(1,1000) sin 340) -->

Como la memoria de un recién nacido arranca en 0, cada hijo tiene que volver a
fijarla; si no, su veneno pega en celdas al azar.

```adn
' al nacer: el veneno hace avanzar a la víctima
cond
*.robage 0 =
start
.up .vloc store
40 .venval store
stop
```
