---
titulo: .paralyzed
resumen: "Cuántos ciclos de parálisis por veneno le quedan al bot; 0 si no está paralizado."
etiquetas: [defensas, venom, sentidos]
estado: revisada
---
Cuando te pega veneno de otra especie, o cuando alguien te lo pasa por un lazo
([[.tieloc]] `-3`), el motor suma ciclos de parálisis y los descuenta de a uno
por ciclo; esta celda muestra cuántos quedan. Mientras sea mayor que 0, en cada
ciclo el motor escribe en una celda tuya el valor que eligió el atacante (su
[[.venval]] en tu celda [[.vloc]]), _después_ de que corre tu ADN. Fuera de eso
tu bot funciona normal: ejecuta su ADN, se mueve y dispara.

<!-- sysvars.yaml .paralyzed (Poisons P1 = Int(Paracount)); 33-SHOTS §5 (takeven: Paracount += power); port/core ties.hpp tie_transfers −3 (paraliza sin mirar la especie); port/core robots.hpp Poisons (único efecto: mem(Vloc) = Vval) -->

No podés saber directamente qué celda te están pisando, pero sí defenderte:
fabricar caparazón ([[.mkshell]]) frena los próximos golpes, y si sabés qué orden
suele atacar tu enemigo podés compensarla. Algunos bots del Bestiario, como
_Saber_, directamente no atacan mientras están paralizados o envenenados.

<!-- 33-SHOTS §5 (shell absorbe el venom); Bestiario: 1_3.txt (Saber, *.poisoned 0 = y *.paralyzed 0 = en sus ataques) -->

```adn
' mientras me paralizan, acorazarme
cond
*.paralyzed 0 >
start
100 .mkshell store
stop
```

La versión de la toxina es [[.poisoned]].
