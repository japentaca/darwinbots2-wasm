---
titulo: .ploc
resumen: "La celda de memoria que tu toxina le va a pisar, en cada ciclo, a quien se envenene atacándote."
etiquetas: [defensas, poison, memoria, configuración]
estado: revisada
---
Es la versión defensiva de [[.vloc]]. Cuando alguien se envenena con tu toxina
(te mordió con un disparo de energía, te tiró un disparo de memoria o te quiso
chupar por un lazo; ver [[.poison]]), el motor toma tu `.ploc` y tu [[.pval]] en
el momento en que la toxina sale hacia él y, mientras dure el envenenamiento,
escribe `.pval` en la celda `.ploc` del atacante en cada ciclo.

<!-- sysvars.yaml .ploc (al devolver poison; createshot y ties); 33-SHOTS §2.3 (memloc = mem(834) del emisor) -->

Es configuración: el motor no la borra. Las reglas de la dirección son las mismas
que en `.vloc`: un valor fuera de 1…1000 se lleva al rango, 0 o negativo elige una
celda al azar y la 340 ([[.delgene]]) está protegida. Un hijo nace con 0, así que
conviene fijarla al nacer.

<!-- 21-MEMORIA §3 (ploc persistente), §6 ((v−1) Mod 1000 + 1; 340 → mem(0); ≤ 0 → aleatoria) -->

Muchos bots del Bestiario la apuntan a [[.shoot]] (por ejemplo _A Packus Toxus_ y
_Alga Toxicus_): el envenenado dispara lo que diga `.pval`.

```adn
' al nacer: quien me muerda deja de empujar
cond
*.robage 0 =
start
.up .ploc store
0 .pval store
stop

' y tener toxina para que el castigo funcione
cond
*.poison 500 <
start
100 .strpoison store
stop
```

El valor se escribe en el atacante después de que corre su ADN y antes de que el
motor lea sus órdenes de movimiento, así que su `.up` queda en 0 aunque lo pida.

<!-- 10-CICLO §2 P1 (Poisons antes de NetForces/VoluntaryForces) -->
