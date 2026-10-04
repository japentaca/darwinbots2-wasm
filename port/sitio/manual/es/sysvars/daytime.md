---
titulo: .daytime
resumen: "Vale 1 si es de día y 0 si es de noche; para un bot con cloroplastos, 1 solo si además le está dando el sol."
etiquetas: [sol, día, noche, sentido, cloroplastos]
estado: revisada
---
<!-- sysvars.yaml .daytime (feedvegs paso 21); 10-CICLO §2 -->
`.daytime` dice si en el último ciclo hubo sol. Si la simulación no tiene ciclo de
día y noche, es siempre de día y vale 1 (salvo en el primer ciclo de vida, en que
vale 0). Con el ciclo activado alterna entre 1 y 0 al ritmo que fije la
configuración, y la simulación también puede apagar o prender el sol según la
energía total del mundo.

Para un bot con cloroplastos hay un matiz: el sol puede iluminar solo una franja del
mundo, y si el bot está fuera de ella lee 0 aunque sea de día. Para él, `.daytime`
quiere decir "me está dando el sol". Uno sin cloroplastos ve 1 en cualquier lugar
mientras sea de día. Lo cuenta [[simulacion/cloroplastos]].

El motor la escribe al final del ciclo, después de todo lo demás, así que tu ADN
lee lo que pasó en el ciclo anterior.

Un uso clásico es ahorrar de noche. _Anon Terifica daynight_, del Bestiario, se
clava en su lugar cuando oscurece y se suelta al amanecer (ver [[.fixed]]):

```adn
cond
*.daytime 0 =
*.fixed 0 =
start
1 .fixpos store
stop
```

No hay que confundirla con [[.sun]], que no tiene que ver con la luz.
