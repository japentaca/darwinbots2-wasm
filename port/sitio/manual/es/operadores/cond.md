---
titulo: cond
resumen: "Abre un gen nuevo: vacía la pila booleana y empieza la zona de condiciones, que termina en start o else."
etiquetas: [cond, gen, condiciones, flujo]
estado: revisada
---
<!-- 20-VM §5.1 (cond: COND, currgene+1, limpia bools), §1 (stores solo en body/elsebody), §4 (tipo 9 sin gate, FLOWCOST); comprobado en el port -->

`cond` abre un gen. Desde ahí hasta el [[op:start]] (o el [[op:else]]) va la
zona de condiciones: comparaciones como [[op:>]] o [[op:=]] que van dejando
verdaderos y falsos en la [[adn/pilas|pila booleana]]. Al llegar el `start`,
el cuerpo corre solo si todas son verdaderas.

```adn
' se reproduce si tiene más de 5000 de energía y no ve nada adelante
cond
 *.nrg 5000 >
 *.eye5 0 =
start
 50 .repro store
stop
```

<!-- 21-MEMORIA §3 (régimen A, latencia 1); comprobado en el port: con 3000 de energía y umbral 2000 se divide en el ciclo 2 -->
Las dos condiciones, sobre [[.nrg]] y [[.eye5]], se unen con _y_ sin
escribir nada más; para un _o_ hace falta [[op:or]]. Con 6000 de energía el
bot se divide con [[.repro]] en el segundo ciclo, no en el primero: los
sentidos se publican al final de cada ciclo y en el primero todavía valen 0
(ver [[adn/ejecucion]]).

Lo que conviene saber de `cond`:

- **Vacía la pila booleana** al empezar. Es el único marcador que la vacía
  siempre ([[op:start]], [[op:else]] y [[op:stop]] solo lo hacen cuando
  cierran una zona de condiciones), así que empezar un gen con `cond` lo
  protege de condiciones que hayan quedado de antes (ver
  [[adn/pilas#rareza]]).
- En la zona de condiciones se ejecuta todo **menos los stores**: podés
  calcular, pero un [[op:store]] ahí no escribe y no saca nada de la pila.
- Un `cond` sin condiciones, seguido de `start`, corre siempre.
- Un `cond` en medio de un cuerpo cierra ese gen y abre otro, aunque falte el
  [[op:stop]].
- Cada `cond` cuenta como un gen nuevo en [[.genes]] y [[.thisgene]].

La estructura completa del gen está en [[adn/genes]].
