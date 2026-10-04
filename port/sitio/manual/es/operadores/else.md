---
titulo: else
resumen: "Abre el cuerpo alternativo de un gen, que corre cuando las condiciones del cond dieron falso."
etiquetas: [else, gen, si no, flujo]
estado: revisada
---
<!-- 20-VM §5.4 describe el original (else tras start muerto); core vm.hpp ExecuteFlowCommands (elseok/elsecond, A2-1); port/README.md «Bugs del original corregidos»; comprobado en el port -->

`else` es el «si no» del gen. En `cond C start A else B stop`, el cuerpo `A`
corre cuando las condiciones `C` son verdaderas y el `B` cuando son falsas.
Nunca corren los dos en el mismo ciclo.

```adn
' avanza mientras tenga más de 2000 de energía; si no, gira
cond
 *.nrg 2000 >
start
 20 .up store
else
 50 .aimdx store
stop
```

<!-- 21-MEMORIA §3 (régimen A, latencia 1); comprobado en el port: el else corre en el ciclo 1 y el start desde el 2 -->
Con 2500 de energía el bot avanza con [[.up]]; con 1500 se queda quieto y
gira con [[.aimdx]]. Fijate en un detalle: en el **primer ciclo** gira
aunque tenga 2500, porque [[.nrg]] todavía vale 0 y la condición da falso. Los sentidos
llegan recién desde el segundo ciclo (ver [[adn/ejecucion]]).

También vale pegado a las condiciones, sin `start`: `cond C else B stop`
corre `B` solo cuando `C` es falsa, y no hay cuerpo para el caso cierto.

Un `else` que no tiene un `cond … start` (o un `cond`) justo antes **no corre
nunca**: después de un `start` sin `cond`, después de un [[op:stop]] o
después de otro `else`.

:::cuidado
En el DarwinBots 2.48.32 original, el cuerpo de un `else` que venía después de
un `start` no se ejecutaba nunca, fuera cierta o falsa la condición. Esta
versión lo corrige, así que los bots viejos que usan `start … else` se
comportan distinto que en el original. Ver [[adn/genes#else]] y
[[tecnico/diferencias]].
:::

El `else` cuenta como un gen aparte en [[.genes]] y [[.thisgene]]: en
`cond … start … else … stop` hay dos genes.
